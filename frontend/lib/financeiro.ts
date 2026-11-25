import type {
  FormaPagamento,
  ModalidadeCartao,
  TaxaCartao,
} from "./types";

export const BANDEIRAS_CARTAO = [
  "VISA",
  "MASTERCARD",
  "ELO",
  "AMEX",
  "HIPERCARD",
  "OUTRA",
] as const;

export const PARCELAS_CREDITO = Array.from({ length: 36 }, (_, indice) => indice + 1);

export const ROTULOS_FORMA: Record<FormaPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO: "Cartão",
};

export function rotuloForma(forma?: string | null): string {
  if (!forma) return "—";
  return ROTULOS_FORMA[forma as FormaPagamento] ?? forma;
}

export function rotuloModalidade(modalidade?: string | null): string {
  if (modalidade === "DEBITO") return "Débito";
  if (modalidade === "CREDITO") return "Crédito";
  return modalidade || "—";
}

/** Decimal da API convertido em centavos inteiros antes de somar valores. */
export function valorEmCentavos(valor: string): number {
  const [inteiro, decimal = ""] = valor.split(".");
  return Number(inteiro) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
}

export function percentualNumerico(percentual: string | number): number {
  return Math.max(0, Number(percentual));
}

export function buscarTaxa(
  taxas: TaxaCartao[],
  bandeira: string,
  modalidade: ModalidadeCartao,
  parcelas: number,
): TaxaCartao | null {
  const alvo = bandeira.trim().toUpperCase();
  if (!alvo) return null;
  return (
    taxas.find(
      (taxa) =>
        taxa.bandeira?.trim().toUpperCase() === alvo &&
        taxa.modalidade === modalidade &&
        Number(taxa.parcelas) === parcelas,
    ) ?? null
  );
}

export function calcularTaxa(valorBruto: number, percentual: string | number) {
  const aliquota = percentualNumerico(percentual);
  const brutoCentavos = Math.round(valorBruto * 100);
  const percentualCentimos = Math.round(aliquota * 100);
  // ROUND_HALF_UP: arredonda a taxa uma vez; líquido é bruto menos taxa.
  const taxaCentavos = Number((BigInt(brutoCentavos) * BigInt(percentualCentimos) + BigInt(5000)) / BigInt(10000));
  return {
    percentual: aliquota,
    taxa: taxaCentavos / 100,
    liquido: (brutoCentavos - taxaCentavos) / 100,
  };
}

export function opcoesBandeira(taxas: TaxaCartao[]): string[] {
  const configuradas = taxas
    .map((taxa) => taxa.bandeira?.trim().toUpperCase())
    .filter((bandeira): bandeira is string => Boolean(bandeira));
  return Array.from(new Set([...BANDEIRAS_CARTAO, ...configuradas])).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

