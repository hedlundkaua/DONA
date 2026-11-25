import { FormaPagamento, ModalidadeCartao, Prisma } from "@prisma/client";
import { isPositiveInteger, isValidDateInput } from "./validators";

export class PagamentoInvalido extends Error {}

export function bandeiraCanonica(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const nome = value.trim().toUpperCase();
  return nome.length > 0 && nome.length <= 50 ? nome : null;
}

export function combinacaoCartao(modalidade: unknown, parcelas: unknown): modalidade is ModalidadeCartao {
  return isPositiveInteger(parcelas) && parcelas <= 36 &&
    (modalidade === "CREDITO" || (modalidade === "DEBITO" && parcelas === 1));
}

export interface Pagamento {
  forma: FormaPagamento;
  bandeira: string | null;
  modalidade: ModalidadeCartao | null;
  parcelas: number;
  primeiroVencimento: Date;
  recebido: boolean;
}

export function lerPagamento(raw: unknown, dataPedido: Date): Pagamento {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new PagamentoInvalido("Pagamento inválido.");
  const p = raw as Record<string, unknown>;
  if (Object.keys(p).some(k => !["forma","bandeira","modalidade","parcelas","primeiroVencimento","recebido"].includes(k)))
    throw new PagamentoInvalido("Campo inválido no pagamento.");
  if (!Object.values(FormaPagamento).includes(p.forma as FormaPagamento) || !isValidDateInput(p.primeiroVencimento))
    throw new PagamentoInvalido("Informe a forma e a primeira data prevista.");
  const primeiroVencimento = new Date(p.primeiroVencimento + "T00:00:00.000Z");
  if (primeiroVencimento < dataPedido) throw new PagamentoInvalido("A previsão deve ser na data do pedido ou depois.");
  if (p.recebido !== undefined && typeof p.recebido !== "boolean") throw new PagamentoInvalido("recebido deve ser booleano.");
  const forma = p.forma as FormaPagamento;
  if (forma === "CARTAO") {
    const bandeira = bandeiraCanonica(p.bandeira);
    if (!bandeira || !combinacaoCartao(p.modalidade,p.parcelas) || p.recebido)
      throw new PagamentoInvalido("Informe bandeira, modalidade e parcelas válidas para cartão.");
    return { forma, bandeira, modalidade: p.modalidade, parcelas: p.parcelas as number, primeiroVencimento, recebido: false };
  }
  if (p.bandeira != null || p.modalidade != null || (p.parcelas !== undefined && p.parcelas !== 1))
    throw new PagamentoInvalido("Dados de cartão só se aplicam ao cartão.");
  if (p.recebido && dataPedido.toISOString().slice(0,10) > new Date().toISOString().slice(0,10))
    throw new PagamentoInvalido("Um pedido futuro não pode ter recebimento confirmado hoje.");
  return { forma, bandeira: null, modalidade: null, parcelas: 1, primeiroVencimento, recebido: p.recebido === true };
}

export function vencimentoMensal(primeiro: Date, indice: number): Date {
  const vencimento = new Date(primeiro);
  vencimento.setUTCDate(1);
  vencimento.setUTCMonth(vencimento.getUTCMonth() + indice + 1, 0);
  vencimento.setUTCDate(Math.min(primeiro.getUTCDate(), vencimento.getUTCDate()));
  if (vencimento.getUTCFullYear() > 9999) throw new PagamentoInvalido("Datas de parcelas fora do intervalo.");
  return vencimento;
}

export async function calcularPagamento(tx: Prisma.TransactionClient, negocioId: string, p: Pagamento, total: Prisma.Decimal) {
  let percentual = new Prisma.Decimal(0);
  if (p.forma === "CARTAO") {
    const regra = await tx.taxaCartao.findUnique({ where: { negocioId_bandeira_modalidade_parcelas:
      { negocioId, bandeira: p.bandeira!, modalidade: p.modalidade!, parcelas: p.parcelas } } });
    if (!regra) throw new PagamentoInvalido("Configure uma taxa para esta bandeira, modalidade e número de parcelas.");
    percentual = regra.percentual;
  }
  const taxa = total.mul(percentual).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const liquido = total.minus(taxa);
  const valorBase = liquido.div(p.parcelas).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  if (valorBase.lessThan("0.01")) throw new PagamentoInvalido("O valor líquido deve cobrir ao menos um centavo por parcela.");
  const parcelas = Array.from({length:p.parcelas}, (_, i) => ({
    numero: i+1,
    vencimento: vencimentoMensal(p.primeiroVencimento,i),
    valor: i === p.parcelas-1 ? liquido.minus(valorBase.mul(i)) : valorBase,
  }));
  return { snapshot: { forma:p.forma, bandeira:p.bandeira, modalidade:p.modalidade, numeroParcelas:p.parcelas, percentual,taxa,liquido }, parcelas };
}

// Serializa valores da venda sempre com duas casas, inclusive porcentagens de taxa zero.
export function totaisPagamento(venda: { taxa: Prisma.Decimal|null; percentual: Prisma.Decimal|null; liquido: Prisma.Decimal|null }) {
  return {taxa:venda.taxa?.toFixed(2) ?? null, percentual:venda.percentual?.toFixed(2) ?? null, liquido:venda.liquido?.toFixed(2) ?? null};
}

export async function receberParcela(tx: Prisma.TransactionClient, negocioId:string, usuarioId:number, parcelaId:number, data:Date) {
  // Serializa baixas inclusive de parcelas diferentes para fechar a venda uma única vez.
  const [venda] = await tx.$queryRaw<{id:number;data_pedido:Date}[]>`
    SELECT v.id,v.data_pedido FROM vendas v JOIN parcelas_venda p ON p.venda_id=v.id AND p.negocio_id=v.negocio_id
    WHERE v.negocio_id=${negocioId}::uuid AND p.id=${parcelaId} FOR UPDATE OF v`;
  if (!venda) return null;
  const parcela = await tx.parcelaVenda.findUniqueOrThrow({where:{negocioId_id:{negocioId,id:parcelaId}},include:{lancamento:{select:{id:true}}}});
  if (parcela.lancamento && parcela.recebidoEm) {
    return {id:parcelaId,vendaId:venda.id,valor:parcela.valor.toFixed(2),recebidoEm:parcela.recebidoEm,lancamentoId:parcela.lancamento.id};
  }
  if (data < venda.data_pedido) throw new PagamentoInvalido("Data de recebimento anterior à venda.");
  const lancamento = await tx.lancamentoFinanceiro.create({data:{
    negocioId, usuarioId, parcelaId, tipo:"ENTRADA", data, valor:parcela.valor,
    descricao:`Recebimento da venda ${venda.id}, parcela ${parcela.numero}`,
  }});
  await tx.parcelaVenda.update({where:{negocioId_id:{negocioId,id:parcelaId}}, data:{recebidoEm:data}});
  const pendentes = await tx.parcelaVenda.count({where:{negocioId,vendaId:venda.id,recebidoEm:null}});
  if (pendentes === 0) await tx.venda.update({where:{negocioId_id:{negocioId,id:venda.id}},data:{statusPagamento:"PAGO",vencimento:null}});
  return {id:parcelaId,vendaId:venda.id,valor:parcela.valor.toFixed(2),recebidoEm:data,lancamentoId:lancamento.id};
}
