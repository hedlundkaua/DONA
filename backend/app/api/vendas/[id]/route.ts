import "server-only";
import { NextRequest } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/validators";

import { totaisPagamento } from "@/lib/venda-pagamento";

type Params = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const venda = await prisma.venda.findFirst({
      where: { id, negocioId: auth.user.negocioId },
      include: {
        parcelas: { orderBy: { numero: "asc" }, select: { id: true, numero: true, vencimento: true, valor: true, recebidoEm: true } },
        cliente: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true, nomeUsuario: true, perfil: true } },
        itens: { include: { produto: { select: { id: true, nome: true, unidadeMedida: true } } }, orderBy: { id: "asc" } },
        movimentacoes: { select: { id: true, vendaId: true, tipoMovimento: true, produtoId: true, quantidade: true, operadorId: true, dataHora: true } },
      },
    });
    if (!venda) return notFound("Venda");
    return ok({ ...venda, ...totaisPagamento(venda), parcelas:venda.parcelas.map(p => ({...p,valor:p.valor.toFixed(2)})), total: venda.total.toFixed(2), itens: venda.itens.map((item) => ({ ...item, valorUnitario: item.valorUnitario.toFixed(2), subtotal: item.subtotal.toFixed(2) })), movimentacoes: venda.movimentacoes.map((m) => ({ ...m, quantidade: m.quantidade.toFixed(2) })) });
  } catch (err) { return serverError(err); }
}
