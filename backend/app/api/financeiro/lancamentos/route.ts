import { NextRequest } from "next/server";
import { Prisma, TipoLancamento } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { badRequest, created, ok } from "@/lib/api-response";
import { parseMoney } from "@/lib/decimal-money";
import { duasCasas, erroRelatorio, opcao, periodoEPagina, perfisFinanceiros } from "@/lib/financeiro-relatorios";
import { prisma } from "@/lib/prisma";
import { isValidDateInput, parseJsonObject } from "@/lib/validators";

const campos = {
  id: true, tipo: true, data: true, descricao: true, valor: true, parcelaId: true,
  parcela: { select: { vendaId: true } }, usuario: { select: { id: true, nome: true } },
} as const;

function serializar({ parcela, ...item }: Prisma.LancamentoFinanceiroGetPayload<{ select: typeof campos }>) {
  return { ...item, data: item.data.toISOString().slice(0, 10), valor: item.valor.toFixed(2),
    origem: parcela ? "VENDA" : "MANUAL", vendaId: parcela?.vendaId ?? null };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, perfisFinanceiros);
    if (!auth.ok) return auth.response;
    const params = req.nextUrl.searchParams;
    const { page, limit, skip, periodo } = periodoEPagina(params);
    const tipo = opcao(params, "tipo", Object.values(TipoLancamento));
    const origem = opcao(params, "origem", ["MANUAL", "VENDA"] as const);
    const where: Prisma.LancamentoFinanceiroWhereInput = {
      negocioId: auth.user.negocioId, data: periodo, tipo,
      parcelaId: origem === "MANUAL" ? null : origem === "VENDA" ? { not: null } : undefined,
    };
    const totalsByType = prisma.lancamentoFinanceiro.groupBy({
      where, by: ["tipo"], _sum: { valor: true }, _count: { _all: true },
    });
    const [rows, groups] = await prisma.$transaction([
      prisma.lancamentoFinanceiro.findMany({ where, select: campos, orderBy: [{ data: "desc" }, { id: "desc" }], skip, take: limit }),
      totalsByType,
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const entradas = groups.find(g => g.tipo === "ENTRADA")?._sum.valor ?? new Prisma.Decimal(0);
    const saidas = groups.find(g => g.tipo === "SAIDA")?._sum.valor ?? new Prisma.Decimal(0);
    return ok({
      items: rows.map(serializar), page, limit, total: groups.reduce((n, group) => n + group._count._all, 0),
      resumo: { entradas: duasCasas(entradas), saidas: duasCasas(saidas), saldo: duasCasas(entradas.minus(saidas)) },
    });
  } catch (error) { return erroRelatorio(error); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, perfisFinanceiros);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || Object.keys(body).some(k => !["data", "tipo", "descricao", "valor"].includes(k))) return badRequest("Campos de lançamento inválidos.");
    const valor = parseMoney(body.valor);
    const descricao = typeof body.descricao === "string" ? body.descricao.trim() : "";
    if (!descricao || descricao.length > 255 || !isValidDateInput(body.data)
      || !Object.values(TipoLancamento).includes(body.tipo) || !valor?.isPositive() || valor.isZero()) {
      return badRequest("Informe tipo, data, descrição de até 255 caracteres e valor positivo com até duas casas decimais.");
    }
    const row = await prisma.lancamentoFinanceiro.create({ data: {
      negocioId: auth.user.negocioId, usuarioId: auth.user.id, tipo: body.tipo, data: new Date(body.data), descricao, valor,
    }, select: campos });
    return created(serializar(row));
  } catch (error) { return erroRelatorio(error); }
}
