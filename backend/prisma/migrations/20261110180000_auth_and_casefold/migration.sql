-- Keep legacy category rows and product links. Resolve case-only duplicates by
-- appending a stable suffix to the later row; preserve its original label here.
CREATE TABLE "categorias_nomes_legacy" (
    "categoria_id" INTEGER NOT NULL,
    "nome_original" VARCHAR(100) NOT NULL,
    "nome_migrado" VARCHAR(100) NOT NULL,
    "migrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_nomes_legacy_pkey" PRIMARY KEY ("categoria_id")
);

DO $$
DECLARE
    duplicate_row RECORD;
    candidate_name TEXT;
    suffix TEXT;
    attempt INTEGER;
BEGIN
    FOR duplicate_row IN
        SELECT id, nome
        FROM (
            SELECT id, nome,
                   row_number() OVER (PARTITION BY lower(btrim(nome)) ORDER BY id) AS rn
            FROM categorias_produtos
        ) ranked
        WHERE rn > 1
        ORDER BY id
    LOOP
        attempt := 0;
        LOOP
            suffix := ' [legado ' || duplicate_row.id || CASE WHEN attempt = 0 THEN '' ELSE '-' || attempt END || ']';
            candidate_name := left(duplicate_row.nome, 100 - char_length(suffix)) || suffix;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM categorias_produtos
                WHERE id <> duplicate_row.id AND lower(btrim(nome)) = lower(btrim(candidate_name))
            );
            attempt := attempt + 1;
        END LOOP;

        INSERT INTO categorias_nomes_legacy (categoria_id, nome_original, nome_migrado)
        VALUES (duplicate_row.id, duplicate_row.nome, candidate_name);
        UPDATE categorias_produtos
        SET nome = candidate_name, updated_at = CURRENT_TIMESTAMP
        WHERE id = duplicate_row.id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX "categorias_produtos_nome_ci_key"
    ON categorias_produtos (lower(btrim(nome)));

CREATE TYPE "perfil_usuario" AS ENUM ('ADMINISTRADOR', 'GESTOR', 'ESTOQUISTA', 'VENDEDOR', 'FINANCEIRO');

CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_usuario" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(100) NOT NULL,
    "perfil" "perfil_usuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_nome_usuario_key" ON "usuarios"("nome_usuario");
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_nome_usuario_ci_key" ON "usuarios"(lower(btrim("nome_usuario")));
CREATE UNIQUE INDEX "usuarios_email_ci_key" ON "usuarios"(lower(btrim("email")));

CREATE TABLE "sessoes_usuarios" (
    "id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "revogada_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessoes_usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessoes_usuarios_token_hash_key" ON "sessoes_usuarios"("token_hash");
CREATE INDEX "sessoes_usuarios_usuario_id_expira_em_idx" ON "sessoes_usuarios"("usuario_id", "expira_em");
ALTER TABLE "sessoes_usuarios" ADD CONSTRAINT "sessoes_usuarios_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auditoria_usuarios" (
    "id" BIGSERIAL NOT NULL,
    "ator_id" INTEGER,
    "alvo_id" INTEGER,
    "evento" VARCHAR(50) NOT NULL,
    "detalhes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_usuarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_usuarios_alvo_id_created_at_idx" ON "auditoria_usuarios"("alvo_id", "created_at");
ALTER TABLE "auditoria_usuarios" ADD CONSTRAINT "auditoria_usuarios_ator_id_fkey"
    FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria_usuarios" ADD CONSTRAINT "auditoria_usuarios_alvo_id_fkey"
    FOREIGN KEY ("alvo_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "login_throttles" (
    "chave" CHAR(64) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "janela_inicio" TIMESTAMPTZ(3) NOT NULL,
    "bloqueada_ate" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("chave")
);
