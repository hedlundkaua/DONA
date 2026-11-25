import "server-only";
import { NextRequest } from "next/server";
import { PerfilUsuario, Prisma, StatusPagamentoVenda, TipoMovimento } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { badRequest, created, notFound, serverError, unprocessable } from "@/lib/api-response";
import { parseDateFilter, isValidDateInput, parseId, parseJsonObject } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

import { calcularPagamento, lerPagamento, PagamentoInvalido, receberParcela, totaisPagamento } from "@/lib/venda-pagamento";

const readRoles = Object.values(PerfilUsuario);
const createRoles = [PerfilUsuario.ADMINISTRADOR, PerfilUsuario.GESTOR, PerfilUsuario.ESTOQUISTA, PerfilUsuario.VENDEDOR];
const statuses = Object.values(StatusPagamentoVenda);
const itemInclude = { produto: { select: { id: true, nome: true, unidadeMedida: true } } } as const;
const vendaInclude = {
  cliente: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true, nomeUsuario: true, perfil: true } },
  itens: { include: itemInclude, orderBy: { id: "asc" as const } },
} as const;
function serializeVenda(venda: any) {
  return { ...venda, ...totaisPagamento(venda), total: venda.total.toFixed(2), itens: venda.itens.map((item: any) => ({ ...item, valorUnitario: item.valorUnitario.toFixed(2), subtotal: item.subtotal.toFixed(2) })) };
}

type InputItem = { produtoId: number; quantidade: number };
function integer(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function parseDate(value: unknown): Date | null {
  return isValidDateInput(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}
function compareDates(a: Date, b: Date) { return a.getTime() - b.getTime(); }
function maxMoney(value: Prisma.Decimal) { return value.lessThanOrEqualTo("9999999999.99"); }

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, readRoles);
    if (!auth.ok) return auth.response;
    const sp = req.nextUrl.searchParams;
    const clienteIdRaw = sp.get("clienteId");
    const status = sp.get("statusPagamento");
    const de = sp.get("de");
    const ate = sp.get("ate");
    const page = sp.get("page") === null ? 1 : Number(sp.get("page"));
    const limit = sp.get("limit") === null ? 50 : Number(sp.get("limit"));
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return badRequest("page deve ser positivo e limit deve estar entre 1 e 100.");
    const clienteId = clienteIdRaw === null ? null : parseId(clienteIdRaw);
    if (clienteIdRaw !== null && !clienteId) return badRequest("clienteId inválido.");
    if (status !== null && !statuses.includes(status as StatusPagamentoVenda)) return badRequest("statusPagamento deve ser PAGO ou A_PRAZO.");
    const dataPedido: Prisma.DateTimeFilter = {};
    if (de) { const parsed = parseDateFilter(de); if (!parsed) return badRequest("de inválido; use YYYY-MM-DD ou ISO-8601."); dataPedido.gte = parsed.date; }
    if (ate) { const parsed = parseDateFilter(ate, true); if (!parsed) return badRequest("ate inválido; use YYYY-MM-DD ou ISO-8601."); if (parsed.exclusive) dataPedido.lt = parsed.date; else dataPedido.lte = parsed.date; }
    const where: Prisma.VendaWhereInput = { negocioId: auth.user.negocioId, ...(clienteId ? { clienteId } : {}), ...(status ? { statusPagamento: status as StatusPagamentoVenda } : {}), ...(de || ate ? { dataPedido } : {}) };
    const [vendas, total] = await prisma.$transaction([
      prisma.venda.findMany({ where, include: vendaInclude, orderBy: [{ dataPedido: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
      prisma.venda.count({ where }),
    ]);
    return Response.json({ success: true, data: { items: vendas.map(serializeVenda), page, limit, total } });
  } catch (err) { return serverError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req, createRoles);
    if (!auth.ok) return auth.response;
    const body = await parseJsonObject(req);
    if (!body || !integer(body.clienteId) || (body.pagamento === undefined && !statuses.includes(body.statusPagamento)) || (body.statusPagamento !== undefined && !statuses.includes(body.statusPagamento))) return badRequest("Informe clienteId e statusPagamento PAGO ou A_PRAZO.");
    if (["total", "desconto", "valorUnitario"].some((field) => Object.hasOwn(body, field))) return badRequest("Preço e total são obtidos do cadastro ativo do produto; desconto não está disponível neste contrato.");
    if (!Array.isArray(body.itens) || body.itens.length < 1 || body.itens.length > 100) return badRequest("itens deve conter de 1 a 100 produtos.");
    const items: InputItem[] = [];
    const ids = new Set<number>();
    for (const item of body.itens) {
      if (!item || typeof item !== "object" || !integer(item.produtoId) || !integer(item.quantidade)) return badRequest("Cada item exige produtoId e quantidade inteira positiva.");
      if (["preco", "valorUnitario", "subtotal", "desconto"].some((field) => Object.hasOwn(item, field))) return badRequest("Preço, subtotal e desconto não podem ser enviados nos itens.");
      if (ids.has(item.produtoId)) return badRequest("Cada produto deve aparecer uma única vez em itens.");
      ids.add(item.produtoId);
      items.push({ produtoId: item.produtoId, quantidade: item.quantidade });
    }
    const dataPedido = body.dataPedido === undefined ? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") : parseDate(body.dataPedido);
    if (!dataPedido) return badRequest("dataPedido inválida; use YYYY-MM-DD.");
    const pagamento = body.pagamento === undefined ? null : lerPagamento(body.pagamento, dataPedido);
    const statusPagamento = pagamento ? (pagamento.recebido ? StatusPagamentoVenda.PAGO : StatusPagamentoVenda.A_PRAZO) : body.statusPagamento as StatusPagamentoVenda;
    if (pagamento && body.statusPagamento !== undefined && body.statusPagamento !== statusPagamento)
      return badRequest("Status e confirmação de recebimento incompatíveis.");
    const prazo = statusPagamento === StatusPagamentoVenda.A_PRAZO;
    const vencimento = body.vencimento == null ? (prazo && pagamento ? pagamento.primeiroVencimento : null) : parseDate(body.vencimento);
    if (pagamento && prazo && vencimento && +vencimento !== +pagamento.primeiroVencimento)
      return badRequest("O vencimento deve coincidir com a primeira parcela.");
    if (prazo && !vencimento) return badRequest("vencimento é obrigatório para venda A_PRAZO e deve usar YYYY-MM-DD.");
    if (!prazo && body.vencimento !== undefined && body.vencimento !== null) return badRequest("vencimento deve ser omitido para venda PAGO.");
    if (vencimento && compareDates(vencimento, dataPedido) < 0) return badRequest("vencimento não pode ser anterior a dataPedido.");
    if (body.observacoes !== undefined && body.observacoes !== null && (typeof body.observacoes !== "string" || body.observacoes.length > 1000)) return badRequest("observacoes deve conter até 1000 caracteres.");

    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({ where: { id: body.clienteId, negocioId: auth.user.negocioId }, select: { id: true, ativo: true } });
      if (!cliente) throw new Error("CLIENT_NOT_FOUND");
      if (!cliente.ativo) throw new Error("CLIENT_INACTIVE");
      // Lock product rows in deterministic order, then re-read before checking and decrementing.
      await tx.$queryRaw`SELECT id FROM produtos WHERE negocio_id = ${auth.user.negocioId}::uuid AND id IN (${Prisma.join(items.map((item) => item.produtoId))}) ORDER BY id FOR UPDATE`;
      const products = await tx.produto.findMany({ where: { negocioId: auth.user.negocioId, id: { in: items.map((item) => item.produtoId) } }, include: { categoria: true } });
      if (products.length !== items.length) throw new Error("PRODUCT_NOT_FOUND");
      const byId = new Map(products.map((product) => [product.id, product]));
      const priced: Array<{ produtoId: number; quantidade: number; nomeProduto: string; valorUnitario: Prisma.Decimal; subtotal: Prisma.Decimal }> = [];
      let total = new Prisma.Decimal(0);
      for (const item of items) {
        const product = byId.get(item.produtoId)!;
        if (!product.ativo) throw new Error("PRODUCT_INACTIVE");
        if (!product.categoria.ativo) throw new Error("CATEGORY_INACTIVE");
        if (product.precoVenda.lessThan(product.precoCusto)) throw new Error("SALE_BELOW_COST");
        if (!maxMoney(product.precoVenda)) throw new Error("PRICE_OUT_OF_RANGE");
        const subtotal = product.precoVenda.mul(item.quantidade);
        if (!maxMoney(subtotal)) throw new Error("TOTAL_OUT_OF_RANGE");
        total = total.add(subtotal);
        priced.push({ produtoId: product.id, quantidade: item.quantidade, nomeProduto: product.nome, valorUnitario: product.precoVenda, subtotal });
      }
      if (!maxMoney(total) || total.isZero()) throw new Error("TOTAL_OUT_OF_RANGE");
      for (const item of priced) {
        const changed = await tx.produto.updateMany({ where: { id: item.produtoId, negocioId: auth.user.negocioId, ativo: true, quantidadeEstoque: { gte: new Prisma.Decimal(item.quantidade) } }, data: { quantidadeEstoque: { decrement: new Prisma.Decimal(item.quantidade) } } });
        if (changed.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      }
      const valores = pagamento ? await calcularPagamento(tx, auth.user.negocioId, pagamento, total) : null;
      const venda = await tx.venda.create({ data: {
        negocioId: auth.user.negocioId, clienteId: cliente.id, usuarioId: auth.user.id, dataPedido,
        statusPagamento, ...valores?.snapshot,
        vencimento, observacoes: body.observacoes?.trim() || null, total,
        itens: { create: priced.map((item) => ({ ...item })) },
      }, include: vendaInclude });
      await tx.movimentacaoEstoque.createMany({ data: priced.map((item) => ({
        negocioId: auth.user.negocioId, tipoMovimento: TipoMovimento.SAIDA, produtoId: item.produtoId,
        quantidade: new Prisma.Decimal(item.quantidade), operadorId: auth.user.id,
        vendaId: venda.id, documentoOrigem: `Venda ${venda.id}`, observacoes: `Baixa gerada pela venda ${venda.id}`,
      })) });
      if (valores) {
        await tx.parcelaVenda.createMany({ data: valores.parcelas.map(parcela => ({ ...parcela, negocioId: auth.user.negocioId, vendaId: venda.id })) });
        if (pagamento?.recebido) {
          const parcela = await tx.parcelaVenda.findFirstOrThrow({where:{negocioId:auth.user.negocioId,vendaId:venda.id,numero:1},select:{id:true}});
          const hoje = new Date(new Date().toISOString().slice(0,10) + "T00:00:00.000Z");
          await receberParcela(tx, auth.user.negocioId, auth.user.id, parcela.id, hoje);
        }
      }
      return venda;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 20_000 });
    return created(serializeVenda(result));
  } catch (err) {
    if (err instanceof PagamentoInvalido) return unprocessable(err.message);
    if (err instanceof Error) {
      if (err.message === "CLIENT_NOT_FOUND" || err.message === "PRODUCT_NOT_FOUND") return notFound(err.message === "CLIENT_NOT_FOUND" ? "Cliente" : "Produto");
      if (err.message === "INSUFFICIENT_STOCK") return unprocessable("Saldo insuficiente para concluir a venda.");
      if (["CLIENT_INACTIVE", "PRODUCT_INACTIVE", "CATEGORY_INACTIVE"].includes(err.message)) return unprocessable("Cliente, produto ou categoria inativa não pode participar de nova venda.");
      if (err.message === "SALE_BELOW_COST") return unprocessable("Venda abaixo do custo não é permitida.");
      if (["PRICE_OUT_OF_RANGE", "TOTAL_OUT_OF_RANGE"].includes(err.message)) return unprocessable("O valor da venda excede DECIMAL(12,2).");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return notFound();
    return serverError(err);
  }
}
