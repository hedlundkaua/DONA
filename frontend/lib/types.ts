/**
 * Tipos espelhando o contrato atual do backend DONA.
 * Backend: Next.js Route Handlers + Prisma (Decimal serializado como string).
 */

export type Decimal = string;

export interface Categoria {
  id: number;
  nome: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { produtos: number };
}

export interface Produto {
  id: number;
  nome: string;
  categoriaId: number;
  unidadeMedida: string;
  /** Omitido pelo backend para o perfil VENDEDOR. */
  precoCusto?: Decimal;
  precoVenda: Decimal;
  quantidadeEstoque: Decimal;
  estoqueMinimo: Decimal;
  fornecedorId: number | null;
  dataValidade: string | null;
  ativo: boolean;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  categoria?: { id: number; nome: string; ativo?: boolean };
}

export interface Cliente {
  id: number;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  criadoPorId: number;
  atualizadoPorId: number | null;
}

/**
 * Forma reduzida prevista para o perfil ESTOQUISTA no GET de clientes:
 * somente id e nome, sem contatos. Usada apenas na seleção de venda.
 */
export type ClienteSelecao = Pick<Cliente, "id" | "nome">;

export type StatusPagamentoVenda = "PAGO" | "A_PRAZO";

export interface ItemVenda {
  id: number;
  vendaId: number;
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  valorUnitario: Decimal;
  subtotal: Decimal;
  produto?: { id: number; nome: string; unidadeMedida: string };
}

export interface MovimentacaoVenda {
  id: number;
  vendaId: number | null;
  tipoMovimento: TipoMovimento;
  produtoId: number;
  quantidade: Decimal;
  operadorId: number | null;
  dataHora: string;
}

export interface Venda {
  id: number;
  clienteId: number;
  usuarioId: number;
  dataPedido: string;
  statusPagamento: StatusPagamentoVenda;
  vencimento: string | null;
  observacoes: string | null;
  total: Decimal;
  createdAt: string;
  cliente?: { id: number; nome: string };
  usuario?: {
    id: number;
    nome: string;
    nomeUsuario: string;
    perfil: string;
  };
  itens: ItemVenda[];
  movimentacoes?: MovimentacaoVenda[];
}

export interface PaginaVendas {
  items: Venda[];
  page: number;
  limit: number;
  total: number;
}

export type TipoMovimento = "ENTRADA" | "SAIDA";

export interface Movimentacao {
  id: number;
  tipoMovimento: TipoMovimento;
  produtoId: number;
  quantidade: Decimal;
  operadorId: number | null;
  documentoOrigem: string | null;
  observacoes: string | null;
  dataHora: string;
  produto?: { id: number; nome: string; unidadeMedida: string };
}

export type TipoAjuste = "AUMENTO" | "REDUCAO";

export interface Ajuste {
  id: number;
  produtoId: number;
  quantidadeSistema: Decimal;
  quantidadeContada: Decimal;
  diferenca: Decimal;
  tipoAjuste: TipoAjuste;
  motivo: string;
  data: string;
  usuarioResponsavelId: number | null;
  observacoes: string | null;
  produto?: { id: number; nome: string; unidadeMedida: string };
}

export interface MovimentacaoCriada {
  movimentacao: Movimentacao;
  saldoAtual: Decimal;
  alertaEstoqueBaixo: boolean;
}

export type NivelEstoque = "normal" | "baixo" | "critico";

export interface UnidadeMedidaOpcao {
  valor: string;
  rotulo: string;
}
