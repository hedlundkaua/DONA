import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { duasCasas, erroRelatorio, idOpcional, opcao, periodoEPagina, perfisFinanceiros } from "@/lib/financeiro-relatorios";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, perfisFinanceiros);
    if (!auth.ok) return auth.response;
    const params = req.nextUrl.searchParams;
    const { page, limit, skip, periodo } = periodoEPagina(params);
    const vendaId = idOpcional(params, "vendaId");
    const status = opcao(params, "status", ["PENDENTE", "RECEBIDA"] as const);
    const base = { negocioId: auth.user.negocioId, vendaId, vencimento: periodo };
    const where: Prisma.ParcelaVendaWhereInput = {
      ...base, recebidoEm: status === "PENDENTE" ? null : status === "RECEBIDA" ? { not: null } : undefined,
    };
    const [rows, pending, received] = await prisma.$transaction([
      prisma.parcelaVenda.findMany({ where, orderBy: [{ vencimento: "asc" }, { id: "asc" }], skip, take: limit,
        select: { id: true, vendaId: true, numero: true, vencimento: true, valor: true, recebidoEm: true,
          venda: { select: { numeroParcelas: true, cliente: { select: { id: true, nome: true } } } } },
      }),
      prisma.parcelaVenda.aggregate({ where: { AND: [where, { recebidoEm: null }] }, _count: true, _sum: { valor: true } }),
      prisma.parcelaVenda.aggregate({ where: { AND: [where, { recebidoEm: { not: null } }] }, _count: true, _sum: { valor: true } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const items = rows.map(({ venda, ...item }) => ({ ...item, ...venda, vencimento: item.vencimento.toISOString().slice(0, 10),
      valor: item.valor.toFixed(2), status: item.recebidoEm ? "RECEBIDA" : "PENDENTE" }));
    return ok({ items, page, limit, total: pending._count + received._count,
      resumo: { pendente: duasCasas(pending._sum.valor), recebido: duasCasas(received._sum.valor) } });
  } catch (error) { return erroRelatorio(error); }
}
