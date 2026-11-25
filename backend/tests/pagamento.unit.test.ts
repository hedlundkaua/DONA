import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { calcularPagamento, lerPagamento, vencimentoMensal } from "../lib/venda-pagamento";

test("vencimentos mensais preservam o dia original após fevereiro", () => {
  const primeiro = new Date("2028-01-31T00:00:00Z");
  assert.deepEqual([0, 1, 2].map(i => vencimentoMensal(primeiro, i).toISOString().slice(0, 10)), [
    "2028-01-31", "2028-02-29", "2028-03-31",
  ]);
});

test("taxa arredondada e parcelas mantêm o total líquido exato", async () => {
  const tx = { taxaCartao: { findUnique: async () => ({ percentual: new Prisma.Decimal("3") }) } } as unknown as Prisma.TransactionClient;
  const pagamento = lerPagamento({ forma: "CARTAO", bandeira: "visa", modalidade: "CREDITO", parcelas: 2, primeiroVencimento: "2026-11-25" }, new Date("2026-11-25T00:00:00Z"));
  const cem = await calcularPagamento(tx, "teste", pagamento, new Prisma.Decimal("100"));
  assert.equal(cem.snapshot.taxa.toFixed(2), "3.00");
  assert.deepEqual(cem.parcelas.map(p => p.valor.toFixed(2)), ["48.50", "48.50"]);
  const fracao = await calcularPagamento(tx, "teste", { ...pagamento, parcelas: 3 }, new Prisma.Decimal("1"));
  assert.deepEqual(fracao.parcelas.map(p => p.valor.toFixed(2)), ["0.32", "0.32", "0.33"]);
  assert.equal(fracao.parcelas.reduce((s, p) => s.plus(p.valor), new Prisma.Decimal(0)).toFixed(2), "0.97");
});
