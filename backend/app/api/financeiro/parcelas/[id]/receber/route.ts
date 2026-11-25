import { NextRequest } from "next/server";
import { PerfilUsuario } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { isValidDateInput, parseId, parseJsonObject } from "@/lib/validators";
import { receberParcela, PagamentoInvalido } from "@/lib/venda-pagamento";

export async function POST(req: NextRequest, {params}:{params:Promise<{id:string}>}) {
  try {
    const auth = await requireUser(req,[PerfilUsuario.ADMINISTRADOR,PerfilUsuario.GESTOR,PerfilUsuario.FINANCEIRO]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id || id > 2147483647) return badRequest("Parcela inválida.");
    const body = await parseJsonObject(req);
    const hoje = new Date().toISOString().slice(0,10);
    const dia = body && Object.hasOwn(body, "data") ? body.data : hoje;
    if (!body || Object.keys(body).some(k => k !== "data") || !isValidDateInput(dia) || dia > hoje)
      return badRequest("Informe uma data de recebimento válida até hoje.");
    const parcela = await prisma.$transaction(tx => receberParcela(tx, auth.user.negocioId, auth.user.id, id, new Date(dia+"T00:00:00.000Z")));
    return parcela ? ok(parcela) : notFound("Parcela");
  } catch (err) {
    if (err instanceof PagamentoInvalido) return badRequest(err.message);
    return serverError(err);
  }
}
