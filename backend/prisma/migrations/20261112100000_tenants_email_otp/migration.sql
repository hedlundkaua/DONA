-- R5 tenant/auth migration. Existing rows are quarantined, never assigned to an owner.
BEGIN;
CREATE TYPE "status_negocio" AS ENUM ('ATIVO', 'QUARENTENA');
CREATE TYPE "finalidade_otp" AS ENUM ('VERIFICAR_EMAIL', 'RECUPERAR_SENHA');

CREATE TABLE "negocios" (
  "id" UUID NOT NULL,
  "status" "status_negocio" NOT NULL DEFAULT 'ATIVO',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- Stable, disabled quarantine tenant. Operators must explicitly claim/remap legacy data.
INSERT INTO "negocios" ("id", "status") VALUES ('00000000-0000-4000-8000-000000000005', 'QUARENTENA');

ALTER TABLE "usuarios" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "usuarios" ADD COLUMN "email_verificado_em" TIMESTAMPTZ(3);
ALTER TABLE "usuarios" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sessoes_usuarios" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "sessoes_usuarios" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "auditoria_usuarios" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "categorias_produtos" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "categorias_nomes_legacy" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "produtos" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "movimentacoes_estoque" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "ajustes_inventario" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "clientes" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "vendas" ADD COLUMN "negocio_id" UUID;
ALTER TABLE "itens_venda" ADD COLUMN "negocio_id" UUID;

UPDATE "usuarios" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "sessoes_usuarios" SET "negocio_id" = '00000000-0000-4000-8000-000000000005', "revogada_em" = CURRENT_TIMESTAMP;
UPDATE "auditoria_usuarios" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "categorias_produtos" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "categorias_nomes_legacy" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "produtos" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "movimentacoes_estoque" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "ajustes_inventario" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "clientes" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "vendas" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';
UPDATE "itens_venda" SET "negocio_id" = '00000000-0000-4000-8000-000000000005';

ALTER TABLE "usuarios" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "sessoes_usuarios" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "auditoria_usuarios" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "categorias_produtos" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "categorias_nomes_legacy" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "produtos" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "movimentacoes_estoque" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "ajustes_inventario" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "vendas" ALTER COLUMN "negocio_id" SET NOT NULL;
ALTER TABLE "itens_venda" ALTER COLUMN "negocio_id" SET NOT NULL;

ALTER TABLE "sessoes_usuarios" DROP CONSTRAINT "sessoes_usuarios_usuario_id_fkey";
ALTER TABLE "auditoria_usuarios" DROP CONSTRAINT "auditoria_usuarios_ator_id_fkey";
ALTER TABLE "auditoria_usuarios" DROP CONSTRAINT "auditoria_usuarios_alvo_id_fkey";
ALTER TABLE "clientes" DROP CONSTRAINT "clientes_criado_por_id_fkey";
ALTER TABLE "clientes" DROP CONSTRAINT "clientes_atualizado_por_id_fkey";
ALTER TABLE "vendas" DROP CONSTRAINT "vendas_cliente_id_fkey";
ALTER TABLE "vendas" DROP CONSTRAINT "vendas_usuario_id_fkey";
ALTER TABLE "itens_venda" DROP CONSTRAINT "itens_venda_venda_id_fkey";
ALTER TABLE "itens_venda" DROP CONSTRAINT "itens_venda_produto_id_fkey";
ALTER TABLE "movimentacoes_estoque" DROP CONSTRAINT "movimentacoes_estoque_venda_id_fkey";
ALTER TABLE "produtos" DROP CONSTRAINT "produtos_categoria_id_fkey";
ALTER TABLE "movimentacoes_estoque" DROP CONSTRAINT "movimentacoes_estoque_produto_id_fkey";
ALTER TABLE "ajustes_inventario" DROP CONSTRAINT "ajustes_inventario_produto_id_fkey";

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "sessoes_usuarios" ADD CONSTRAINT "sessoes_usuarios_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "auditoria_usuarios" ADD CONSTRAINT "auditoria_usuarios_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "categorias_produtos" ADD CONSTRAINT "categorias_produtos_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "categorias_nomes_legacy" ADD CONSTRAINT "categorias_nomes_legacy_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX "usuarios_negocio_id_id_key" ON "usuarios"("negocio_id", "id");
CREATE UNIQUE INDEX "sessoes_usuarios_negocio_id_id_key" ON "sessoes_usuarios"("negocio_id", "id");
CREATE UNIQUE INDEX "categorias_produtos_negocio_id_id_key" ON "categorias_produtos"("negocio_id", "id");
CREATE UNIQUE INDEX "produtos_negocio_id_id_key" ON "produtos"("negocio_id", "id");
CREATE UNIQUE INDEX "clientes_negocio_id_id_key" ON "clientes"("negocio_id", "id");
CREATE UNIQUE INDEX "vendas_negocio_id_id_key" ON "vendas"("negocio_id", "id");
CREATE UNIQUE INDEX "itens_venda_negocio_id_id_key" ON "itens_venda"("negocio_id", "id");
CREATE UNIQUE INDEX "movimentacoes_estoque_negocio_id_id_key" ON "movimentacoes_estoque"("negocio_id", "id");
CREATE UNIQUE INDEX "ajustes_inventario_negocio_id_id_key" ON "ajustes_inventario"("negocio_id", "id");

DROP INDEX "categorias_produtos_nome_key";
DROP INDEX "categorias_produtos_nome_ci_key";
DROP INDEX "produtos_nome_key";
CREATE UNIQUE INDEX "categorias_produtos_negocio_nome_key" ON "categorias_produtos"("negocio_id", "nome");
CREATE UNIQUE INDEX "categorias_produtos_negocio_nome_ci_key" ON "categorias_produtos"("negocio_id", lower(btrim("nome")));
CREATE UNIQUE INDEX "produtos_negocio_nome_key" ON "produtos"("negocio_id", "nome");
CREATE UNIQUE INDEX "itens_venda_negocio_venda_produto_key" ON "itens_venda"("negocio_id", "venda_id", "produto_id");
ALTER TABLE "itens_venda" DROP CONSTRAINT "itens_venda_venda_id_produto_id_key";
DROP INDEX IF EXISTS "movimentacoes_estoque_venda_produto_key";
CREATE UNIQUE INDEX "movimentacoes_estoque_negocio_venda_produto_key" ON "movimentacoes_estoque"("negocio_id", "venda_id", "produto_id") WHERE "venda_id" IS NOT NULL;

ALTER TABLE "sessoes_usuarios" ADD CONSTRAINT "sessoes_usuarios_negocio_usuario_fkey" FOREIGN KEY ("negocio_id", "usuario_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "auditoria_usuarios" ADD CONSTRAINT "auditoria_usuarios_negocio_ator_fkey" FOREIGN KEY ("negocio_id", "ator_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "auditoria_usuarios" ADD CONSTRAINT "auditoria_usuarios_negocio_alvo_fkey" FOREIGN KEY ("negocio_id", "alvo_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "categorias_nomes_legacy" ADD CONSTRAINT "categorias_nomes_legacy_negocio_categoria_fkey" FOREIGN KEY ("negocio_id", "categoria_id") REFERENCES "categorias_produtos"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_negocio_categoria_fkey" FOREIGN KEY ("negocio_id", "categoria_id") REFERENCES "categorias_produtos"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_negocio_produto_fkey" FOREIGN KEY ("negocio_id", "produto_id") REFERENCES "produtos"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_negocio_venda_fkey" FOREIGN KEY ("negocio_id", "venda_id") REFERENCES "vendas"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_negocio_operador_fkey" FOREIGN KEY ("negocio_id", "operador_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_negocio_produto_fkey" FOREIGN KEY ("negocio_id", "produto_id") REFERENCES "produtos"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_negocio_usuario_fkey" FOREIGN KEY ("negocio_id", "usuario_responsavel_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_negocio_criador_fkey" FOREIGN KEY ("negocio_id", "criado_por_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_negocio_atualizador_fkey" FOREIGN KEY ("negocio_id", "atualizado_por_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_negocio_cliente_fkey" FOREIGN KEY ("negocio_id", "cliente_id") REFERENCES "clientes"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_negocio_usuario_fkey" FOREIGN KEY ("negocio_id", "usuario_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_negocio_venda_fkey" FOREIGN KEY ("negocio_id", "venda_id") REFERENCES "vendas"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_negocio_produto_fkey" FOREIGN KEY ("negocio_id", "produto_id") REFERENCES "produtos"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX "usuarios_negocio_ativo_idx" ON "usuarios"("negocio_id", "ativo");
CREATE INDEX "sessoes_usuarios_negocio_usuario_exp_idx" ON "sessoes_usuarios"("negocio_id", "usuario_id", "expira_em");
CREATE INDEX "auditoria_usuarios_negocio_created_idx" ON "auditoria_usuarios"("negocio_id", "created_at");
CREATE INDEX "categorias_produtos_negocio_ativo_idx" ON "categorias_produtos"("negocio_id", "ativo");
CREATE INDEX "produtos_negocio_ativo_idx" ON "produtos"("negocio_id", "ativo");
CREATE INDEX "movimentacoes_estoque_negocio_produto_data_idx" ON "movimentacoes_estoque"("negocio_id", "produto_id", "data_hora");
CREATE INDEX "ajustes_inventario_negocio_produto_data_idx" ON "ajustes_inventario"("negocio_id", "produto_id", "data");
CREATE INDEX "clientes_negocio_ativo_nome_idx" ON "clientes"("negocio_id", "ativo", "nome");
CREATE INDEX "vendas_negocio_cliente_data_idx" ON "vendas"("negocio_id", "cliente_id", "data_pedido");
CREATE INDEX "vendas_negocio_usuario_created_idx" ON "vendas"("negocio_id", "usuario_id", "created_at");
CREATE INDEX "vendas_negocio_status_vencimento_idx" ON "vendas"("negocio_id", "status_pagamento", "vencimento");
CREATE INDEX "itens_venda_negocio_produto_idx" ON "itens_venda"("negocio_id", "produto_id");

-- Preserve a migration audit trail; existing users remain unverified and the tenant is disabled.
INSERT INTO "auditoria_usuarios" ("negocio_id", "alvo_id", "evento", "detalhes", "created_at")
SELECT "negocio_id", "id", 'LEGACY_DATA_QUARANTINED', '{"policy":"legacy-quarantine-awaiting-explicit-owner-claim"}'::jsonb, CURRENT_TIMESTAMP
FROM "usuarios";

CREATE TABLE "codigos_otp" (
  "id" UUID NOT NULL,
  "negocio_id" UUID NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "finalidade" "finalidade_otp" NOT NULL,
  "hash_codigo" CHAR(64) NOT NULL,
  "expira_em" TIMESTAMPTZ(3) NOT NULL,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "consumido_em" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "codigos_otp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "codigos_otp_negocio_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "codigos_otp_negocio_usuario_fkey" FOREIGN KEY ("negocio_id", "usuario_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "codigos_otp_attempts_check" CHECK ("tentativas" BETWEEN 0 AND 5),
  CONSTRAINT "codigos_otp_negocio_id_id_key" UNIQUE ("negocio_id", "id"),
  CONSTRAINT "codigos_otp_negocio_usuario_purpose_key" UNIQUE ("negocio_id", "usuario_id", "finalidade")
);
CREATE INDEX "codigos_otp_expiry_idx" ON "codigos_otp"("negocio_id", "expira_em");

CREATE TABLE "limites_envio_otp" (
  "chave" CHAR(64) NOT NULL,
  "finalidade" "finalidade_otp" NOT NULL,
  "envios" INTEGER NOT NULL DEFAULT 0,
  "janela_inicio" TIMESTAMPTZ(3) NOT NULL,
  "ultimo_envio" TIMESTAMPTZ(3) NOT NULL,
  "falhas_codigo" INTEGER NOT NULL DEFAULT 0,
  "janela_falhas" TIMESTAMPTZ(3),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "limites_envio_otp_pkey" PRIMARY KEY ("chave"),
  CONSTRAINT "limites_envio_otp_counts_check" CHECK ("envios" >= 0 AND "falhas_codigo" BETWEEN 0 AND 5)
);

COMMIT;
