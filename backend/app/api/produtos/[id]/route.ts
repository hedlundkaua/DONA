import { NextRequest } from "next/server";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound, ok, serverError, unprocessable } from "@/lib/api-response";
import { fitsDecimal, isOptionalString, isPositiveInteger, isValidDateInput, parseId, parseJsonObject } from "@/lib/validators";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(_req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const produto = await prisma.produto.findFirst({ where: { id, negocioId: auth.user.negocioId }, include: { categoria: true } });
    if (!produto) return notFound("Produto");
    if (auth.user.perfil === PerfilUsuario.VENDEDOR) {
      const { precoCusto: _privateCost, ...visibleProduct } = produto;
      return ok(visibleProduct);
    }
    return ok(produto);
  } catch (err) { return serverError(err); }
}

async function updateProduct(id: number, negocioId: string, body: Record<string, any>, partial: boolean) {
  const existing = await prisma.produto.findFirst({ where: { id, negocioId } });
  if (!existing) return notFound("Produto");

  if (body.quantidadeEstoque !== undefined) return badRequest("O saldo só pode ser alterado por movimentação ou ajuste de estoque.");
  const required = ["nome", "categoriaId", "precoCusto", "precoVenda", "estoqueMinimo"];
  if (!partial && required.some((key) => body[key] === undefined || body[key] === null)) {
    return badRequest("PUT exige nome, categoriaId, precoCusto, precoVenda e estoqueMinimo.");
  }

  if (body.nome !== undefined && (typeof body.nome !== "string" || body.nome.trim().length === 0 || body.nome.trim().length > 255)) return badRequest("nome deve conter de 1 a 255 caracteres.");
  if (body.categoriaId !== undefined && !isPositiveInteger(body.categoriaId)) return badRequest("categoriaId deve ser um inteiro positivo.");
  if (body.precoCusto !== undefined && !fitsDecimal(body.precoCusto, 13)) return badRequest("precoCusto inválido ou fora da faixa decimal permitida.");
  if (body.precoVenda !== undefined && !fitsDecimal(body.precoVenda, 13)) return badRequest("precoVenda inválido ou fora da faixa decimal permitida.");
  if (body.estoqueMinimo !== undefined && !fitsDecimal(body.estoqueMinimo, 8)) return badRequest("estoqueMinimo inválido ou fora da faixa decimal permitida.");
  if (body.unidadeMedida !== undefined && (typeof body.unidadeMedida !== "string" || body.unidadeMedida.trim().length === 0 || body.unidadeMedida.length > 50)) return badRequest("unidadeMedida deve conter de 1 a 50 caracteres.");
  if (body.fornecedorId !== undefined && body.fornecedorId !== null && !isPositiveInteger(body.fornecedorId)) return badRequest("fornecedorId inválido.");
  if (body.dataValidade !== undefined && body.dataValidade !== null && !isValidDateInput(body.dataValidade)) return badRequest("dataValidade deve usar uma data válida no formato YYYY-MM-DD.");
  if (!isOptionalString(body.observacoes, 10000)) return badRequest("observacoes deve ser texto.");
  if (body.ativo !== undefined && typeof body.ativo !== "boolean") return badRequest("ativo deve ser booleano.");

  const categoriaId = body.categoriaId ?? existing.categoriaId;
  const categoria = await prisma.categoriaProduto.findFirst({ where: { id: categoriaId, negocioId } });
  if (!categoria) return badRequest("Categoria não encontrada.");
  const ativo = body.ativo ?? existing.ativo;
  if (ativo && !categoria.ativo) return unprocessable("Produto ativo não pode pertencer a uma categoria inativa.");

  const precoCusto = body.precoCusto ?? existing.precoCusto.toString();
  const precoVenda = body.precoVenda ?? existing.precoVenda.toString();
  if (Number(precoVenda) < Number(precoCusto)) return unprocessable("O preço de venda deve ser maior ou igual ao preço de custo.");

  const data: Prisma.ProdutoUpdateInput = {
    nome: body.nome === undefined ? existing.nome : body.nome.trim(),
    categoria: { connect: { negocioId_id: { negocioId, id: categoriaId } } },
    precoCusto: new Prisma.Decimal(precoCusto),
    precoVenda: new Prisma.Decimal(precoVenda),
    estoqueMinimo: new Prisma.Decimal(body.estoqueMinimo ?? existing.estoqueMinimo.toString()),
    ativo,
  };
  if (body.unidadeMedida !== undefined) data.unidadeMedida = body.unidadeMedida.trim();
  if (body.fornecedorId !== undefined) data.fornecedorId = body.fornecedorId;
  if (body.dataValidade !== undefined) data.dataValidade = body.dataValidade ? new Date(`${body.dataValidade}T00:00:00.000Z`) : null;
  if (body.observacoes !== undefined) data.observacoes = body.observacoes;

  const updated = await prisma.produto.update({ where: { negocioId_id: { negocioId, id } }, data, include: { categoria: true } });
  return ok(updated);
}

function databaseError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return conflict("Já existe um produto com esse nome.");
    if (err.code === "P2000" || err.code === "P2003") return badRequest("Um dos campos excede o limite ou referencia dados inválidos.");
    if (err.code === "P2025") return notFound("Produto");
  }
  return serverError(err);
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    return await updateProduct(id, auth.user.negocioId, body, false);
  } catch (err) { return databaseError(err); }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");
    return await updateProduct(id, auth.user.negocioId, body, true);
  } catch (err) { return databaseError(err); }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireUser(_req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badRequest("ID inválido.");
    const existing = await prisma.produto.findFirst({ where: { id, negocioId: auth.user.negocioId } });
    if (!existing) return notFound("Produto");
    const updated = await prisma.produto.update({ where: { negocioId_id: { negocioId: auth.user.negocioId, id } }, data: { ativo: false } });
    return ok({ message: "Produto inativado com sucesso.", produto: updated });
  } catch (err) { return databaseError(err); }
}
