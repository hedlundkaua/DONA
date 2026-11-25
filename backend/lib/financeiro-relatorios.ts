import { PerfilUsuario, Prisma } from "@prisma/client";
import { badRequest, serverError } from "@/lib/api-response";
import { isValidDateInput, parseId } from "@/lib/validators";

export const perfisFinanceiros = [
  PerfilUsuario.ADMINISTRADOR,
  PerfilUsuario.GESTOR,
  PerfilUsuario.FINANCEIRO,
];

class FiltroInvalido extends Error {}

export function erroRelatorio(error: unknown) {
  return error instanceof FiltroInvalido ? badRequest(error.message) : serverError(error);
}

export function opcao<T extends string>(params: URLSearchParams, key: string, options: readonly T[]): T | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  const result = options.find(option => option === value);
  if (!result) throw new FiltroInvalido(`Filtro ${key} inválido.`);
  return result;
}

export function idOpcional(params: URLSearchParams, key: string): number | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  const id = parseId(value);
  if (!id || id > 2147483647) throw new FiltroInvalido(`Filtro ${key} inválido.`);
  return id;
}

export function periodoEPagina(params: URLSearchParams) {
  const page = idOpcional(params, "page") ?? 1;
  const limit = idOpcional(params, "limit") ?? 50;
  const skip = (page - 1) * limit;
  if (limit > 100 || skip > 2147483647) throw new FiltroInvalido("Paginação inválida. Use limit entre 1 e 100.");
  const de = params.get("de");
  const ate = params.get("ate");
  if ((de !== null && !isValidDateInput(de)) || (ate !== null && !isValidDateInput(ate))) {
    throw new FiltroInvalido("Informe as datas no formato YYYY-MM-DD.");
  }
  if (de && ate && de > ate) throw new FiltroInvalido("A data inicial deve ser anterior ou igual à final.");
  const periodo = { gte: de ? new Date(de) : undefined, lte: ate ? new Date(ate) : undefined };
  return { page, limit, skip, periodo };
}

export const duasCasas = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? "0.00";
