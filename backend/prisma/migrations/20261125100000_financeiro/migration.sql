-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO');

-- CreateEnum
CREATE TYPE "modalidade_cartao" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "tipo_lancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "bandeira" VARCHAR(50),
ADD COLUMN     "forma" "forma_pagamento",
ADD COLUMN     "liquido" DECIMAL(12,2),
ADD COLUMN     "modalidade" "modalidade_cartao",
ADD COLUMN     "numero_parcelas" INTEGER,
ADD COLUMN     "percentual" DECIMAL(5,2),
ADD COLUMN     "taxa" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "taxas_cartao" (
    "negocio_id" UUID NOT NULL,
    "bandeira" VARCHAR(50) NOT NULL,
    "modalidade" "modalidade_cartao" NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "taxas_cartao_pkey" PRIMARY KEY ("negocio_id","bandeira","modalidade","parcelas")
);

-- CreateTable
CREATE TABLE "parcelas_venda" (
    "id" SERIAL NOT NULL,
    "negocio_id" UUID NOT NULL,
    "venda_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "recebido_em" DATE,

    CONSTRAINT "parcelas_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_financeiros" (
    "id" SERIAL NOT NULL,
    "negocio_id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "parcela_id" INTEGER,
    "tipo" "tipo_lancamento" NOT NULL,
    "data" DATE NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcelas_venda_negocio_id_vencimento_idx" ON "parcelas_venda"("negocio_id", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_venda_negocio_id_id_key" ON "parcelas_venda"("negocio_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_venda_negocio_id_venda_id_numero_key" ON "parcelas_venda"("negocio_id", "venda_id", "numero");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_negocio_id_data_idx" ON "lancamentos_financeiros"("negocio_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_negocio_id_parcela_id_key" ON "lancamentos_financeiros"("negocio_id", "parcela_id");

-- AddForeignKey
ALTER TABLE "taxas_cartao" ADD CONSTRAINT "taxas_cartao_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas_venda" ADD CONSTRAINT "parcelas_venda_negocio_id_venda_id_fkey" FOREIGN KEY ("negocio_id", "venda_id") REFERENCES "vendas"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_negocio_id_usuario_id_fkey" FOREIGN KEY ("negocio_id", "usuario_id") REFERENCES "usuarios"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_negocio_id_parcela_id_fkey" FOREIGN KEY ("negocio_id", "parcela_id") REFERENCES "parcelas_venda"("negocio_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
