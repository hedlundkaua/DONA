/**
 * GET  /api/produtos       — lista produtos (filtros: ?ativo=, ?categoriaId=, ?estoqueBaixo=true)
 * POST /api/produtos       — cria produto
 *
 * Requisitos: Cadastrar Produtos - Requisitos Funcionais_.docx
 *             Produtos_Levantamento_Eduardo.docx
 *
 * RN-01: campos obrigatórios preenchidos
 * RN-02: dados válidos
 * RN-03: categoria deve existir
 * RN-04: fornecedor deve existir quando informado
 * RN-05: nome único (sem produtos duplicados)
 * RN-07: precoCusto, precoVenda, estoqueMinimo não nulos
 * RN-CAT-03: categoria informada deve estar ativa
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ok,
  created,
  badRequest,
  conflict,
  unprocessable,
  serverError,
} from "@/lib/api-response";
import { fitsDecimal, isPositiveDecimal, isPositiveInteger, isOptionalString, isValidDateInput, parseJsonObject } from "@/lib/validators";
import { PerfilUsuario, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, Object.values(PerfilUsuario));
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const ativoParam = searchParams.get("ativo");
    const categoriaIdParam = searchParams.get("categoriaId");
    const estoqueBaixo = searchParams.get("estoqueBaixo");

    const where: Prisma.ProdutoWhereInput = { negocioId: auth.user.negocioId };

    if (ativoParam === "true") where.ativo = true;
    if (ativoParam === "false") where.ativo = false;

    if (categoriaIdParam) {
      if (!/^\d+$/.test(categoriaIdParam) || !Number.isSafeInteger(Number(categoriaIdParam)) || Number(categoriaIdParam) < 1) return badRequest("categoriaId inválido.");
      where.categoriaId = Number(categoriaIdParam);
    }

    const produtos = await prisma.produto.findMany({
      where,
      orderBy: { nome: "asc" },
      include: {
        categoria: { select: { id: true, nome: true } },
      },
    });

    const filtered = estoqueBaixo === "true"
      ? produtos.filter((produto) => produto.ativo && produto.quantidadeEstoque.lessThanOrEqualTo(produto.estoqueMinimo))
      : produtos;
    return ok(auth.user.perfil === PerfilUsuario.VENDEDOR
      ? filtered.map(({ precoCusto: _privateCost, ...produto }) => produto)
      : filtered);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR]);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body) return badRequest("Corpo JSON inválido; envie um objeto.");

    const {
      nome,
      categoriaId,
      unidadeMedida,
      precoCusto,
      precoVenda,
      quantidadeEstoque,
      estoqueMinimo,
      fornecedorId,
      dataValidade,
      observacoes,
    } = body;

    // ---- Validações RN-01, RN-02, RN-07 ----
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return badRequest("O campo 'nome' é obrigatório.");
    }

    if (!isPositiveInteger(categoriaId)) {
      return badRequest("O campo 'categoriaId' é obrigatório e deve ser um número.");
    }
    if (nome.trim().length > 255) return badRequest("nome deve ter no máximo 255 caracteres.");
    if (unidadeMedida !== undefined && (typeof unidadeMedida !== "string" || unidadeMedida.trim().length === 0 || unidadeMedida.length > 50)) return badRequest("unidadeMedida deve conter de 1 a 50 caracteres.");
    if (fornecedorId !== undefined && fornecedorId !== null && !isPositiveInteger(fornecedorId)) return badRequest("fornecedorId inválido.");
    if (dataValidade !== undefined && dataValidade !== null && !isValidDateInput(dataValidade)) return badRequest("dataValidade deve usar uma data válida no formato YYYY-MM-DD.");
    if (!isOptionalString(observacoes, 10000)) return badRequest("observacoes deve ser texto.");

    if (precoCusto === undefined || precoCusto === null || !fitsDecimal(precoCusto, 13)) {
      return badRequest("O campo 'precoCusto' é obrigatório e deve ser um valor numérico >= 0.");
    }

    if (precoVenda === undefined || precoVenda === null || !fitsDecimal(precoVenda, 13)) {
      return badRequest("O campo 'precoVenda' é obrigatório e deve ser um valor numérico >= 0.");
    }

    if (estoqueMinimo === undefined || estoqueMinimo === null || !fitsDecimal(estoqueMinimo, 8)) {
      return badRequest("O campo 'estoqueMinimo' é obrigatório e deve ser um valor numérico >= 0.");
    }

    if (quantidadeEstoque !== undefined && !fitsDecimal(quantidadeEstoque, 8)) {
      return badRequest("quantidadeEstoque deve ser um valor numérico >= 0 com até duas casas decimais.");
    }

    // Preço de venda deve ser maior que preço de custo (Eduardo)
    if (Number(precoVenda) < Number(precoCusto)) {
      return unprocessable("O preço de venda deve ser maior ou igual ao preço de custo.");
    }

    // ---- RN-03: categoria deve existir e estar ativa (RN-CAT-03) ----
    const categoria = await prisma.categoriaProduto.findUnique({
      where: { negocioId_id: { negocioId: auth.user.negocioId, id: categoriaId } },
    });

    if (!categoria) {
      return badRequest("Categoria informada não existe.");
    }

    if (!categoria.ativo) {
      return unprocessable("Categoria informada está inativa. Informe uma categoria ativa.");
    }

    // ---- RN-04: fornecedor deve existir quando informado ----
    // NOTA: tabela fornecedores fora do escopo desta entrega
    // Validação será adicionada quando o módulo de fornecedores estiver disponível
    // Por enquanto apenas aceita o ID ou null

    // ---- Cria produto ----
    const produto = await prisma.produto.create({
      data: {
        negocioId: auth.user.negocioId,
        nome: nome.trim(),
        categoriaId,
        unidadeMedida: unidadeMedida ?? "UNIDADE",
        precoCusto: new Prisma.Decimal(precoCusto),
        precoVenda: new Prisma.Decimal(precoVenda),
        quantidadeEstoque: quantidadeEstoque !== undefined
          ? new Prisma.Decimal(quantidadeEstoque)
          : new Prisma.Decimal(0),
        estoqueMinimo: new Prisma.Decimal(estoqueMinimo),
        fornecedorId: fornecedorId ?? null,
        dataValidade: dataValidade ? new Date(dataValidade) : null,
        observacoes: observacoes ?? null,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
      },
    });

    return created(produto);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return conflict("Já existe um produto com esse nome. (RN-05)");
      if (err.code === "P2000" || err.code === "P2003") return badRequest("Um campo excede o limite ou referencia dados inválidos.");
    }
    return serverError(err);
  }
}
