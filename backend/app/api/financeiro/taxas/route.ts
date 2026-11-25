import { NextRequest } from "next/server";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { isValidDecimal, parseJsonObject } from "@/lib/validators";
import { bandeiraCanonica, combinacaoCartao } from "@/lib/venda-pagamento";

const select = {bandeira:true, modalidade:true, parcelas:true, percentual:true} as const;
export async function GET(req:NextRequest) {
  try {
    const auth = await requireUser(req,Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const taxas = await prisma.taxaCartao.findMany({where:{negocioId:auth.user.negocioId},select, orderBy:[{bandeira:"asc"},{modalidade:"asc"},{parcelas:"asc"}]});
    return ok({taxas:taxas.map(t => ({...t,percentual:t.percentual.toFixed(2)}))});
  } catch (err) {return serverError(err);}
}

export async function PUT(req:NextRequest) {
  try {
    const auth = await requireUser(req,[PerfilUsuario.ADMINISTRADOR,PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || Object.keys(body).length !== 1 || !Array.isArray(body.taxas) || body.taxas.length > 500)
      return badRequest("Informe a tabela de taxas.");
    const taxas: Prisma.TaxaCartaoCreateManyInput[] = [];
    const chaves = new Set<string>();
    for (const t of body.taxas) {
      if (!t || typeof t !== "object" || Array.isArray(t)
        || Object.keys(t).some(k => !["bandeira", "modalidade", "parcelas", "percentual"].includes(k)))
        return badRequest("Cada taxa deve conter somente bandeira, modalidade, parcelas e percentual.");
      const bandeira = bandeiraCanonica(t?.bandeira);
      if (!bandeira || !combinacaoCartao(t.modalidade,t.parcelas)
        || typeof t.percentual !== "string" || !isValidDecimal(t.percentual) || Number(t.percentual)>=100)
        return badRequest("Bandeira, modalidade, parcelas ou percentual inválidos.");
      const chave = JSON.stringify([bandeira,t.modalidade,t.parcelas]);
      if (chaves.has(chave)) return badRequest("Taxa duplicada.");
      chaves.add(chave);
      taxas.push({negocioId:auth.user.negocioId,bandeira,modalidade:t.modalidade,parcelas:t.parcelas,percentual:new Prisma.Decimal(String(t.percentual).trim())});
    }
    const negocioId = auth.user.negocioId;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM negocios WHERE id=${negocioId}::uuid FOR UPDATE`;
      await tx.taxaCartao.deleteMany({where:{negocioId}});
      if (taxas.length) await tx.taxaCartao.createMany({data:taxas});
    });
    return ok({taxas:taxas.map(t => ({bandeira:t.bandeira,modalidade:t.modalidade,parcelas:t.parcelas,percentual:new Prisma.Decimal(String(t.percentual)).toFixed(2)}))});
  } catch(err) {return serverError(err);}
}
