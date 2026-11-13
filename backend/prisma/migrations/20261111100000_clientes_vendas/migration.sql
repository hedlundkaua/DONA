CREATE TABLE "clientes" (
  "id" SERIAL NOT NULL,
  "nome" VARCHAR(150) NOT NULL,
  "whatsapp" VARCHAR(16) NOT NULL,
  "instagram" VARCHAR(30),
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id" INTEGER NOT NULL,
  "atualizado_por_id" INTEGER,
  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clientes_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "clientes_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "clientes_ativo_nome_idx" ON "clientes"("ativo", "nome");
CREATE INDEX "clientes_whatsapp_idx" ON "clientes"("whatsapp");

CREATE TYPE "status_pagamento_venda" AS ENUM ('PAGO', 'A_PRAZO');

CREATE TABLE "vendas" (
  "id" SERIAL NOT NULL,
  "cliente_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "data_pedido" DATE NOT NULL,
  "status_pagamento" "status_pagamento_venda" NOT NULL,
  "vencimento" DATE,
  "observacoes" VARCHAR(1000),
  "total" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vendas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vendas_pago_vencimento_check" CHECK (("status_pagamento" = 'PAGO' AND "vencimento" IS NULL) OR ("status_pagamento" = 'A_PRAZO' AND "vencimento" IS NOT NULL AND "vencimento" >= "data_pedido")),
  CONSTRAINT "vendas_total_positive_check" CHECK ("total" > 0)
);
CREATE INDEX "vendas_cliente_id_data_pedido_idx" ON "vendas"("cliente_id", "data_pedido");
CREATE INDEX "vendas_usuario_id_created_at_idx" ON "vendas"("usuario_id", "created_at");
CREATE INDEX "vendas_pago_vencimento_idx" ON "vendas"("status_pagamento", "vencimento");

CREATE TABLE "itens_venda" (
  "id" SERIAL NOT NULL,
  "venda_id" INTEGER NOT NULL,
  "produto_id" INTEGER NOT NULL,
  "nome_produto" VARCHAR(255) NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "valor_unitario" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "itens_venda_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "itens_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "itens_venda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "itens_venda_venda_id_produto_id_key" UNIQUE ("venda_id", "produto_id"),
  CONSTRAINT "itens_venda_quantidade_positive_check" CHECK ("quantidade" > 0),
  CONSTRAINT "itens_venda_valores_positive_check" CHECK ("valor_unitario" > 0 AND "subtotal" > 0)
);
CREATE INDEX "itens_venda_produto_id_idx" ON "itens_venda"("produto_id");

ALTER TABLE "movimentacoes_estoque" ADD COLUMN "venda_id" INTEGER;
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "movimentacoes_estoque_venda_produto_key" ON "movimentacoes_estoque"("venda_id", "produto_id") WHERE "venda_id" IS NOT NULL;

