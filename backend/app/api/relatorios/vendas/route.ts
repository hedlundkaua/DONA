import { NextRequest } from "next/server";
import { FormaPagamento, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import { duasCasas, erroRelatorio, idOpcional, opcao, periodoEPagina, perfisFinanceiros } from "@/lib/financeiro-relatorios";
import { prisma } from "@/lib/prisma";

const situacoes = ["PENDENTE", "PARCIAL", "RECEBIDA", "NAO_INFORMADA"] as const;
const aguardando = { recebidoEm: null };
const recebida = { recebidoEm: { not: null } };
const condicao: Record<typeof situacoes[number], Prisma.VendaWhereInput> = {
  NAO_INFORMADA: { forma: null },
  PENDENTE: { parcelas: { some: aguardando, none: recebida } },
  RECEBIDA: { parcelas: { some: recebida, none: aguardando } },
  PARCIAL: { AND: [{ parcelas: { some: aguardando } }, { parcelas: { some: recebida } }] },
};

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, perfisFinanceiros);
    if (!auth.ok) return auth.response;
    const params = req.nextUrl.searchParams;
    const { page, limit, skip, periodo } = periodoEPagina(params);
    const clienteId = idOpcional(params, "clienteId");
    const forma = opcao(params, "forma", [...Object.values(FormaPagamento), "NAO_INFORMADA"] as const);
    const situacao = opcao(params, "situacao", situacoes);
    const where: Prisma.VendaWhereInput = {
      negocioId: auth.user.negocioId, clienteId, dataPedido: periodo, forma: forma === "NAO_INFORMADA" ? null : forma,
      ...(situacao ? { AND: condicao[situacao] } : {}),
    };
    const [rows, sums] = await prisma.$transaction([
      prisma.venda.findMany({ where, skip, take: limit, orderBy: [{ dataPedido: "desc" }, { id: "desc" }],
        select: { id: true, dataPedido: true, total: true, taxa: true, liquido: true, forma: true, numeroParcelas: true,
          cliente: { select: { id: true, nome: true } }, _count: { select: { parcelas: { where: recebida } } } },
      }),
      prisma.venda.aggregate({ where, _sum: { total: true, taxa: true, liquido: true }, _count: true }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const items = rows.map(({ _count, numeroParcelas, ...venda }) => {
      const status = !venda.forma ? "NAO_INFORMADA" : _count.parcelas === 0 ? "PENDENTE" : _count.parcelas === numeroParcelas ? "RECEBIDA" : "PARCIAL";
      return { ...venda, dataPedido: venda.dataPedido.toISOString().slice(0, 10), situacao: status,
        forma: venda.forma ?? "NAO_INFORMADA", total: venda.total.toFixed(2), taxa: venda.taxa?.toFixed(2) ?? null, liquido: venda.liquido?.toFixed(2) ?? null };
    });
    return ok({ items, page, limit, total: sums._count, resumo: {
      bruto: duasCasas(sums._sum.total), taxas: duasCasas(sums._sum.taxa), liquidoPrevisto: duasCasas(sums._sum.liquido), quantidade: sums._count,
    } });
  } catch (error) { return erroRelatorio(error); }
}
