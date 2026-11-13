import type { NivelEstoque, Produto } from "./types";

export function formatMoeda(valor: string | number | null | undefined): string {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numero) ? numero : 0);
}

/** Formata WhatsApp canônico brasileiro (+55DDDNÚMERO) para leitura. */
export function formatWhatsapp(valor: string | null | undefined): string {
  if (!valor) return "—";
  const digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    const ddd = digitos.slice(2, 4);
    const numero = digitos.slice(4);
    const corte = numero.length - 4;
    return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
  }
  return valor;
}

export function formatQuantidade(
  valor: string | number | null | undefined,
  unidade?: string | null,
): string {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  const texto = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(numero) ? numero : 0);
  return unidade ? `${texto} ${unidade.toLowerCase()}` : texto;
}

/** Datas de calendário (sem hora) — evita deslocamento por fuso. */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(data);
}

export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

/** Data local do negócio (America/Sao_Paulo) no formato YYYY-MM-DD. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/** Converte texto digitado ("1.234,56" ou "1234.56") em número. */
export function parseDecimal(value: string, casas = 2): number | null {
  const limpo = value.replace(/R\$\s?/g, "").trim();
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const padrao = new RegExp(`^\\d+(\\.\\d{1,${casas}})?$`);
  if (!padrao.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function statusEstoque(produto: Pick<Produto, "quantidadeEstoque" | "estoqueMinimo">): NivelEstoque {
  const saldo = Number(produto.quantidadeEstoque ?? 0);
  const minimo = Number(produto.estoqueMinimo ?? 0);
  if (saldo <= 0) return "critico";
  if (saldo <= minimo) return "baixo";
  return "normal";
}

export function margemPercentual(
  custo: string | number,
  venda: string | number,
): number | null {
  const c = Number(custo);
  const v = Number(venda);
  if (!Number.isFinite(c) || !Number.isFinite(v) || v <= 0) return null;
  return ((v - c) / v) * 100;
}

export function formatPercentual(valor: number | null): string {
  if (valor === null) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(valor)}%`;
}
