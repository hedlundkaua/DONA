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

/** Primeiro dia do mês corrente no fuso do negócio (YYYY-MM-01). */
export function inicioMesISO(): string {
  return `${hojeISO().slice(0, 8)}01`;
}

/**
 * Soma meses a uma data de calendário (YYYY-MM-DD) sem deslocamento de fuso.
 * Se o dia não existir no mês destino, usa o último dia daquele mês.
 */
export function somarMeses(iso: string, meses: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [ano, mes, dia] = iso.split("-").map(Number);
  const destino = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimoDia));
  return destino.toISOString().slice(0, 10);
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
  if (saldo < minimo) return saldo <= 0 ? "critico" : "baixo";
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
