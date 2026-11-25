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

export type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO";
export type ModalidadeCartao = "DEBITO" | "CREDITO";

/**
 * Contrato preliminar combinado com o backend para `POST /api/vendas`.
 * Preço, taxas e parcelas oficiais são calculados pelo servidor.
 */
export interface PagamentoVenda {
  forma: FormaPagamento;
  bandeira?: string;
  modalidade?: ModalidadeCartao;
  parcelas?: number;
  primeiroVencimento: string;
  recebido?: boolean;
}

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
  /** Snapshot financeiro devolvido pelo backend (campos nulos em vendas antigas). */
  forma?: FormaPagamento | null;
  bandeira?: string | null;
  modalidade?: ModalidadeCartao | null;
  numeroParcelas?: number | null;
  percentual?: Decimal | null;
  taxa?: Decimal | null;
  liquido?: Decimal | null;
  parcelas?: ParcelaVenda[];

}

export interface ParcelaVenda {
  id: number;
  numero: number;
  vencimento: string;
  valor: Decimal;
  recebidoEm: string | null;
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

/** GET/PATCH /api/conta */
export interface ContaUsuario {
  id?: number;
  nome: string;
  nomeUsuario: string;
  nomeEmpresa: string | null;
  email: string;
  perfil?: string;
  ativo?: boolean;
}

/** GET/PUT /api/financeiro/taxas */
export interface TaxaCartao {
  id?: number;
  bandeira: string;
  modalidade: ModalidadeCartao;
  parcelas: number;
  /** Percentual em string decimal, ex.: "2.99". */
  percentual: Decimal;
}

/** GET /api/financeiro/parcelas */
export interface ParcelaFinanceira extends ParcelaVenda {
  vendaId: number;
  cliente: { id: number; nome: string };
  numeroParcelas: number;
  status: "PENDENTE" | "RECEBIDA";
}

/** GET/POST /api/financeiro/lancamentos */
export interface LancamentoFinanceiro {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  origem: "MANUAL" | "VENDA";
  descricao: string;
  data: string;
  valor: Decimal;
  usuario: { id: number; nome: string };
  vendaId: number | null;
  parcelaId: number | null;
}

export interface VendaRelatorio {
  id: number;
  cliente: { id: number; nome: string };
  dataPedido: string;
  forma: FormaPagamento | null;
  situacao: "PENDENTE" | "PARCIAL" | "RECEBIDA" | "NAO_INFORMADA";
  total: Decimal;
  taxa: Decimal | null;
  liquido: Decimal | null;
}

export interface ResumoRelatorioVendas {
  bruto: Decimal;
  taxas: Decimal;
  liquidoPrevisto: Decimal;
  quantidade: number;
}

export interface PaginaFinanceira<T, S> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  resumo: S;
}

export type RelatorioVendas = PaginaFinanceira<VendaRelatorio, ResumoRelatorioVendas>;
