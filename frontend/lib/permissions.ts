export type Perfil =
  | "ADMINISTRADOR"
  | "GESTOR"
  | "ESTOQUISTA"
  | "VENDEDOR"
  | "FINANCEIRO";

export function podeGerirCatalogo(perfil?: string | null): boolean {
  return perfil === "ADMINISTRADOR" || perfil === "GESTOR";
}

/** GET /api/clientes permite administração, gestão e vendedoras. */
export function podeVerClientes(perfil?: string | null): boolean {
  return (
    perfil === "ADMINISTRADOR" ||
    perfil === "GESTOR" ||
    perfil === "VENDEDOR"
  );
}

/** POST/PATCH /api/clientes permite administração e gestão. */
export function podeGerirClientes(perfil?: string | null): boolean {
  return podeGerirCatalogo(perfil);
}

/**
 * POST /api/vendas aceita ESTOQUISTA. No ajuste coordenado, esse perfil recebe
 * somente a coleção de clientes ativos com id/nome. A interface usa
 * `ClienteSelecao` nesse formulário, sem contatos, detalhe ou escrita.
 */
export function podeCriarVenda(perfil?: string | null): boolean {
  return (
    perfil === "ADMINISTRADOR" ||
    perfil === "GESTOR" ||
    perfil === "ESTOQUISTA" ||
    perfil === "VENDEDOR"
  );
}

export function podeMovimentar(perfil?: string | null): boolean {
  return (
    perfil === "ADMINISTRADOR" ||
    perfil === "GESTOR" ||
    perfil === "ESTOQUISTA" ||
    perfil === "VENDEDOR"
  );
}

export function apenasSaidas(perfil?: string | null): boolean {
  return perfil === "VENDEDOR";
}

export function podeAjustar(perfil?: string | null): boolean {
  return perfil === "ADMINISTRADOR" || perfil === "ESTOQUISTA";
}

export function podeVerAjustes(perfil?: string | null): boolean {
  return podeAjustar(perfil);
}

export function podeVerCusto(perfil?: string | null): boolean {
  return perfil !== "VENDEDOR";
}

export function rotuloPerfil(perfil?: string | null): string {
  const rotulos: Record<string, string> = {
    ADMINISTRADOR: "Administradora",
    GESTOR: "Gestora",
    ESTOQUISTA: "Estoquista",
    VENDEDOR: "Vendedora",
    FINANCEIRO: "Financeiro",
  };
  return perfil ? (rotulos[perfil] ?? perfil) : "Operadora";
}
