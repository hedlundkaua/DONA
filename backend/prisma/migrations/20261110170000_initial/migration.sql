-- CreateEnum
CREATE TYPE "tipo_movimento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "tipo_ajuste" AS ENUM ('AUMENTO', 'REDUCAO');

-- CreateTable
CREATE TABLE "categorias_produtos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "unidade_medida" VARCHAR(50) NOT NULL DEFAULT 'UNIDADE',
    "preco_custo" DECIMAL(15,2) NOT NULL,
    "preco_venda" DECIMAL(15,2) NOT NULL,
    "quantidade_estoque" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estoque_minimo" DECIMAL(10,2) NOT NULL,
    "fornecedor_id" INTEGER,
    "data_validade" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" SERIAL NOT NULL,
    "tipo_movimento" "tipo_movimento" NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "operador_id" INTEGER,
    "documento_origem" VARCHAR(100),
    "observacoes" TEXT,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_inventario" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "quantidade_sistema" DECIMAL(10,2) NOT NULL,
    "quantidade_contada" DECIMAL(10,2) NOT NULL,
    "diferenca" DECIMAL(10,2) NOT NULL,
    "tipo_ajuste" "tipo_ajuste" NOT NULL,
    "motivo" TEXT NOT NULL,
    "data" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_responsavel_id" INTEGER,
    "observacoes" TEXT,

    CONSTRAINT "ajustes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_produtos_nome_key" ON "categorias_produtos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_nome_key" ON "produtos"("nome");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_inventario" ADD CONSTRAINT "ajustes_inventario_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
