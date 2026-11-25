"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, inputBase, selectBase, textareaBase } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/states";
import { PlusIcon, SpinnerIcon } from "@/components/ui/icons";
import { TotalVenda } from "@/components/vendas/total-venda";
import { cn } from "@/lib/cn";
import {
  buscarTaxa,
  calcularTaxa,
  valorEmCentavos,
  opcoesBandeira,
  PARCELAS_CREDITO,
  percentualNumerico,
  rotuloForma,
  rotuloModalidade,
} from "@/lib/financeiro";
import { formatMoeda, formatQuantidade, hojeISO, somarMeses } from "@/lib/format";
import { apiFetch } from "@/lib/http";
import type {
  ClienteSelecao,
  FormaPagamento,
  ModalidadeCartao,
  PagamentoVenda,
  Produto,
  StatusPagamentoVenda,
  TaxaCartao,
  Venda,
} from "@/lib/types";

interface Linha {
  id: number;
  produtoId: string;
  quantidade: string;
}

function parseQuantidade(valor: string): number | null {
  const texto = valor.trim();
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

const FORMAS: Array<{ valor: FormaPagamento; rotulo: string; testId: string }> = [
  { valor: "DINHEIRO", rotulo: "Dinheiro", testId: "venda-forma-dinheiro" },
  { valor: "PIX", rotulo: "Pix", testId: "venda-forma-pix" },
  { valor: "CARTAO", rotulo: "Cartão", testId: "venda-forma-cartao" },
];

export function VendaForm({
  clientes,
  produtos,
  taxas = [],
  avisoTaxas = null,
  podeConfigurarTaxas = false,
  dataHoje = hojeISO(),
}: {
  clientes: ClienteSelecao[];
  produtos: Produto[];
  taxas?: TaxaCartao[];
  avisoTaxas?: string | null;
  podeConfigurarTaxas?: boolean;
  dataHoje?: string;
}) {
  const router = useRouter();
  const proximoId = useRef(2);

  const [clienteId, setClienteId] = useState("");
  const [dataPedido, setDataPedido] = useState(dataHoje);
  const [observacoes, setObservacoes] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([
    { id: 1, produtoId: "", quantidade: "1" },
  ]);

  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [recebido, setRecebido] = useState(true);
  const [bandeira, setBandeira] = useState("");
  const [modalidade, setModalidade] = useState<ModalidadeCartao>("DEBITO");
  const [parcelas, setParcelas] = useState("1");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(
    somarMeses(dataHoje, 1),
  );

  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const produtoPorId = useMemo(
    () => new Map(produtos.map((produto) => [produto.id, produto])),
    [produtos],
  );

  const totalPreview = useMemo(
    () =>
      linhas.reduce((soma, linha) => {
        const produto = produtoPorId.get(Number(linha.produtoId));
        const quantidade = parseQuantidade(linha.quantidade);
        if (!produto || !quantidade) return soma;
        return soma + valorEmCentavos(produto.precoVenda) * quantidade;
      }, 0) / 100,
    [linhas, produtoPorId],
  );

  const quantidadeTotal = useMemo(
    () =>
      linhas.reduce(
        (soma, linha) => soma + (parseQuantidade(linha.quantidade) ?? 0),
        0,
      ),
    [linhas],
  );

  const ehCartao = forma === "CARTAO";
  const ehCredito = ehCartao && modalidade === "CREDITO";
  const parcelasNumero = ehCartao
    ? ehCredito
      ? Number(parcelas) || 1
      : 1
    : 1;
  const bandeiras = useMemo(() => opcoesBandeira(taxas), [taxas]);
  const taxaSelecionada =
    ehCartao && bandeira
      ? buscarTaxa(taxas, bandeira, modalidade, parcelasNumero)
      : null;
  const taxaIndisponivel =
    ehCartao && Boolean(bandeira) && !taxaSelecionada;
  const aliquota = ehCartao
    ? taxaSelecionada
      ? percentualNumerico(taxaSelecionada.percentual)
      : null
    : 0;
  const resumo = calcularTaxa(totalPreview, aliquota ?? 0);

  // O backend deriva status e vencimento a partir de `pagamento`. Cartão fica
  // A_PRAZO até a baixa da parcela; dinheiro/Pix dependem da confirmação.
  const statusPagamento: StatusPagamentoVenda = ehCartao
    ? "A_PRAZO"
    : recebido
      ? "PAGO"
      : "A_PRAZO";

  const exigeData = statusPagamento === "A_PRAZO";
  const dataEfetiva = exigeData ? primeiroVencimento : dataPedido;

  function descricao(id: string, dica?: string) {
    if (erros[id]) return `${id}-error`;
    return dica ? `${id}-hint` : undefined;
  }

  function limparErro(chave: string) {
    setErros((atual) => {
      if (!atual[chave]) return atual;
      const copia = { ...atual };
      delete copia[chave];
      return copia;
    });
  }

  function atualizarLinha(id: number, campo: "produtoId" | "quantidade", valor: string) {
    setLinhas((atual) =>
      atual.map((linha) => (linha.id === id ? { ...linha, [campo]: valor } : linha)),
    );
    limparErro(`linha-${id}-${campo}`);
  }

  function adicionarLinha() {
    setLinhas((atual) => [
      ...atual,
      { id: proximoId.current++, produtoId: "", quantidade: "1" },
    ]);
  }

  function removerLinha(id: number) {
    setLinhas((atual) => (atual.length === 1 ? atual : atual.filter((linha) => linha.id !== id)));
    setErros((atual) => {
      const copia = { ...atual };
      delete copia[`linha-${id}-produto`];
      delete copia[`linha-${id}-quantidade`];
      return copia;
    });
  }

  function escolherForma(nova: FormaPagamento) {
    setForma(nova);
    setErroGeral(null);
    setErros((atual) => {
      const copia = { ...atual };
      delete copia["venda-bandeira"];
      delete copia["venda-parcelas"];
      delete copia["venda-vencimento"];
      delete copia["venda-taxa"];
      return copia;
    });
    if (nova === "CARTAO" && modalidade === "CREDITO") {
      setPrimeiroVencimento(somarMeses(dataPedido || dataHoje, 1));
    }
  }

  function escolherModalidade(nova: ModalidadeCartao) {
    setModalidade(nova);
    setParcelas("1");
    limparErro("venda-parcelas");
    limparErro("venda-vencimento");
    limparErro("venda-taxa");
    if (nova === "CREDITO") {
      setPrimeiroVencimento(somarMeses(dataPedido || dataHoje, 1));
    }
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const novosErros: Record<string, string> = {};
    const ids = new Set<number>();

    if (!clienteId) {
      novosErros["venda-cliente"] = "Selecione o cliente.";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPedido)) {
      novosErros["venda-data"] = "Informe a data do pedido.";
    } else if (!ehCartao && recebido && dataPedido > hojeISO()) {
      novosErros["venda-data"] =
        "Um pedido futuro não pode ter recebimento confirmado hoje.";
    }

    if (ehCartao) {
      if (!bandeira) {
        novosErros["venda-bandeira"] = "Selecione a bandeira do cartão.";
      }
      if (ehCredito && !(parcelasNumero >= 1 && parcelasNumero <= 36)) {
        novosErros["venda-parcelas"] = "Escolha de 1 a 36 parcelas.";
      }
      if (taxaIndisponivel) {
        novosErros["venda-taxa"] =
          "Não há taxa configurada para esta combinação de bandeira, modalidade e parcelas.";
      }
    }

    if (exigeData) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) {
        novosErros["venda-vencimento"] = "Informe a primeira data de recebimento.";
      } else if (primeiroVencimento < dataPedido) {
        novosErros["venda-vencimento"] =
          "A data não pode ser anterior à data do pedido.";
      }
    }

    if (observacoes.length > 1000) {
      novosErros["venda-observacoes"] = "Use no máximo 1.000 caracteres.";
    }

    if (linhas.length === 0) {
      novosErros["venda-itens"] = "Adicione pelo menos um item.";
    }

    for (const linha of linhas) {
      const produtoId = Number(linha.produtoId);
      const quantidade = parseQuantidade(linha.quantidade);
      const chaveProduto = `linha-${linha.id}-produto`;
      const chaveQuantidade = `linha-${linha.id}-quantidade`;

      if (!linha.produtoId || !produtoPorId.has(produtoId)) {
        novosErros[chaveProduto] = "Selecione um produto.";
      } else if (ids.has(produtoId)) {
        novosErros[chaveProduto] =
          "Cada produto deve aparecer uma vez na venda.";
      } else {
        ids.add(produtoId);
      }

      if (quantidade === null) {
        novosErros[chaveQuantidade] = "Informe uma quantidade inteira maior que zero.";
      } else {
        const produto = produtoPorId.get(produtoId);
        if (produto && quantidade > Number(produto.quantidadeEstoque)) {
          novosErros[chaveQuantidade] = `Saldo insuficiente (${formatQuantidade(
            produto.quantidadeEstoque,
            produto.unidadeMedida,
          )}).`;
        }
      }
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      document.getElementById(Object.keys(novosErros)[0])?.focus();
      return;
    }

    const pagamento: PagamentoVenda = {
      forma,
      primeiroVencimento: dataEfetiva,
      ...(ehCartao
        ? { bandeira, modalidade, parcelas: parcelasNumero }
        : { recebido }),
    };

    const corpo: Record<string, unknown> = {
      clienteId: Number(clienteId),
      dataPedido,
      observacoes: observacoes.trim() || null,
      itens: linhas.map((linha) => ({
        produtoId: Number(linha.produtoId),
        quantidade: parseQuantidade(linha.quantidade),
      })),
      // O servidor deriva status e vencimento do pagamento.
      pagamento,
    };

    setSalvando(true);
    const resultado = await apiFetch<Venda>("/vendas", {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    setSalvando(false);

    if (!resultado.ok) {
      setErroGeral(resultado.message);
      return;
    }

    router.push(`/vendas/${resultado.data.id}`);
    router.refresh();
  }

  const rotuloData =
    ehCredito
      ? "Primeiro vencimento"
      : statusPagamento === "A_PRAZO"
        ? "Data prevista de recebimento"
        : "";

  return (
    <form onSubmit={salvar} noValidate className="space-y-4" data-testid="venda-form">
      {erroGeral ? <InlineAlert tom="erro">{erroGeral}</InlineAlert> : null}

      <Card>
        <CardTitle>Cliente e pedido</CardTitle>
        <div className="mt-3 space-y-4">
          <Field
            label="Cliente"
            htmlFor="venda-cliente"
            required
            error={erros["venda-cliente"]}
            hint="Apenas clientes ativos podem receber uma nova venda."
          >
            <select
              id="venda-cliente"
              data-testid="venda-cliente"
              name="clienteId"
              value={clienteId}
              onChange={(evento) => {
                setClienteId(evento.target.value);
                limparErro("venda-cliente");
              }}
              disabled={salvando}
              aria-invalid={Boolean(erros["venda-cliente"]) || undefined}
              aria-describedby={descricao("venda-cliente", "dica")}
              className={cn(selectBase, !clienteId && "text-muted")}
            >
              <option value="">Selecione o cliente…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={String(cliente.id)}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Data do pedido"
            htmlFor="venda-data"
            required
            error={erros["venda-data"]}
            hint="Data comercial usada no histórico e nos filtros."
          >
            <input
              id="venda-data"
              data-testid="venda-data"
              name="dataPedido"
              type="date"
              value={dataPedido}
              onChange={(evento) => setDataPedido(evento.target.value)}
              disabled={salvando}
              aria-invalid={Boolean(erros["venda-data"]) || undefined}
              aria-describedby={descricao("venda-data", "dica")}
              className={inputBase}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Itens</CardTitle>
            <p className="mt-1 text-xs text-muted">
              O preço é o atual do cadastro do produto; o servidor calcula os
              subtotais e o total.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {linhas.map((linha, indice) => {
            const produto = produtoPorId.get(Number(linha.produtoId));
            const quantidade = parseQuantidade(linha.quantidade);
            const subtotal =
              produto && quantidade ? Number(produto.precoVenda) * quantidade : 0;
            const saldoInsuficiente =
              Boolean(produto && quantidade) &&
              Number(produto?.quantidadeEstoque ?? 0) < Number(quantidade);
            const idProduto = `linha-${linha.id}-produto`;
            const idQuantidade = `linha-${linha.id}-quantidade`;

            return (
              <div
                key={linha.id}
                className="rounded-xl border border-line bg-slate-50/50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Item {indice + 1}
                  </p>
                  {linhas.length > 1 ? (
                    <Button
                      type="button"
                      variante="discreto"
                      tamanho="sm"
                      onClick={() => removerLinha(linha.id)}
                      disabled={salvando}
                      aria-label={`Remover item ${indice + 1}`}
                      data-testid={`venda-remover-item-${indice}`}
                    >
                      Remover
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <Field
                    label="Produto"
                    htmlFor={idProduto}
                    required
                    error={erros[idProduto]}
                  >
                    <select
                      id={idProduto}
                      data-testid={`venda-item-produto-${indice}`}
                      value={linha.produtoId}
                      onChange={(evento) =>
                        atualizarLinha(linha.id, "produtoId", evento.target.value)
                      }
                      disabled={salvando}
                      aria-invalid={Boolean(erros[idProduto]) || undefined}
                      aria-describedby={descricao(idProduto)}
                      className={cn(selectBase, !linha.produtoId && "text-muted")}
                    >
                      <option value="">Selecione o produto…</option>
                      {produtos.map((opcao) => {
                        const usadoEmOutraLinha = linhas.some(
                          (outra) =>
                            outra.id !== linha.id &&
                            outra.produtoId === String(opcao.id),
                        );
                        return (
                          <option
                            key={opcao.id}
                            value={String(opcao.id)}
                            disabled={usadoEmOutraLinha}
                          >
                            {opcao.nome} — {formatMoeda(opcao.precoVenda)}
                          </option>
                        );
                      })}
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Quantidade"
                      htmlFor={idQuantidade}
                      required
                      error={erros[idQuantidade]}
                    >
                      <input
                        id={idQuantidade}
                        data-testid={`venda-item-quantidade-${indice}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={linha.quantidade}
                        onChange={(evento) =>
                          atualizarLinha(linha.id, "quantidade", evento.target.value)
                        }
                        disabled={salvando}
                        aria-invalid={Boolean(erros[idQuantidade]) || undefined}
                        aria-describedby={descricao(idQuantidade)}
                        className={inputBase}
                      />
                    </Field>

                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-navy">
                        Valor unitário
                      </p>
                      <div className="flex h-12 items-center rounded-xl border border-line bg-white px-3.5 text-[15px] text-navy">
                        {produto ? formatMoeda(produto.precoVenda) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-xs text-muted">
                      {produto
                        ? `Saldo: ${formatQuantidade(
                            produto.quantidadeEstoque,
                            produto.unidadeMedida,
                          )}`
                        : "Selecione um produto para ver o saldo."}
                    </span>
                    <span className="font-semibold text-plum">
                      Subtotal: {formatMoeda(subtotal)}
                    </span>
                  </div>

                  {saldoInsuficiente ? (
                    <p className="text-xs font-medium text-danger">
                      A quantidade escolhida é maior que o saldo atual.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variante="secundario"
          tamanho="sm"
          onClick={adicionarLinha}
          disabled={salvando}
          className="mt-3 w-full"
          data-testid="venda-add-item"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar item
        </Button>

        {erros["venda-itens"] ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {erros["venda-itens"]}
          </p>
        ) : null}
      </Card>

      <TotalVenda total={totalPreview.toFixed(2)} quantidadeItens={quantidadeTotal} />
      <p className="-mt-2 text-center text-[11px] text-muted">
        Total bruto dos itens. O valor oficial é recalculado pelo servidor.
      </p>

      <Card>
        <CardTitle>Pagamento</CardTitle>

        <fieldset className="mt-3" disabled={salvando}>
          <legend className="mb-1.5 block text-sm font-semibold text-navy">
            Forma de pagamento
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {FORMAS.map((opcao) => {
              const selecionado = forma === opcao.valor;
              return (
                <button
                  key={opcao.valor}
                  type="button"
                  data-testid={opcao.testId}
                  aria-pressed={selecionado}
                  onClick={() => escolherForma(opcao.valor)}
                  disabled={salvando}
                  className={cn(
                    "min-h-12 rounded-xl border px-2 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40",
                    selecionado
                      ? "border-pink bg-pink-50 text-plum"
                      : "border-line bg-white text-navy hover:bg-pink-50/60",
                  )}
                >
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>

        {!ehCartao ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-line bg-slate-50/50 p-3">
              <label
                htmlFor="venda-recebido"
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  id="venda-recebido"
                  name="recebido"
                  data-testid="venda-recebido"
                  type="checkbox"
                  checked={recebido}
                  onChange={(evento) => {
                    setRecebido(evento.target.checked);
                    limparErro("venda-vencimento");
                  }}
                  disabled={salvando}
                  aria-describedby="venda-recebido-hint"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
                />
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    Recebimento confirmado
                  </span>
                  <span
                    id="venda-recebido-hint"
                    className="mt-0.5 block text-xs leading-relaxed text-muted"
                  >
                    Marque somente depois de conferir o {rotuloForma(forma).toLowerCase()}.
                    Sem a confirmação, a venda fica com data prevista de recebimento.
                  </span>
                </span>
              </label>
            </div>

            {statusPagamento === "A_PRAZO" ? (
              <Field
                label={rotuloData}
                htmlFor="venda-vencimento"
                required
                error={erros["venda-vencimento"]}
                hint="Data prevista para a entrada do valor no caixa."
              >
                <input
                  id="venda-vencimento"
                  data-testid="venda-primeiro-vencimento"
                  name="primeiroVencimento"
                  type="date"
                  value={primeiroVencimento}
                  min={dataPedido || undefined}
                  onChange={(evento) => {
                    setPrimeiroVencimento(evento.target.value);
                    limparErro("venda-vencimento");
                  }}
                  disabled={salvando}
                  aria-invalid={Boolean(erros["venda-vencimento"]) || undefined}
                  aria-describedby={descricao("venda-vencimento", "dica")}
                  className={inputBase}
                />
              </Field>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Field
              label="Bandeira"
              htmlFor="venda-bandeira"
              required
              error={erros["venda-bandeira"]}
            >
              <select
                id="venda-bandeira"
                data-testid="venda-bandeira"
                value={bandeira}
                onChange={(evento) => {
                  setBandeira(evento.target.value);
                  limparErro("venda-bandeira");
                  limparErro("venda-taxa");
                }}
                disabled={salvando}
                aria-invalid={Boolean(erros["venda-bandeira"]) || undefined}
                aria-describedby={descricao("venda-bandeira")}
                className={cn(selectBase, !bandeira && "text-muted")}
              >
                <option value="">Selecione a bandeira…</option>
                {bandeiras.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset disabled={salvando}>
              <legend className="mb-1.5 block text-sm font-semibold text-navy">
                Modalidade
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { valor: "DEBITO", rotulo: "Débito", testId: "venda-modalidade-debito" },
                    { valor: "CREDITO", rotulo: "Crédito", testId: "venda-modalidade-credito" },
                  ] as const
                ).map((opcao) => {
                  const selecionado = modalidade === opcao.valor;
                  return (
                    <button
                      key={opcao.valor}
                      type="button"
                      data-testid={opcao.testId}
                      aria-pressed={selecionado}
                      onClick={() => escolherModalidade(opcao.valor)}
                      disabled={salvando}
                      className={cn(
                        "min-h-12 rounded-xl border px-2 text-sm font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40",
                        selecionado
                          ? "border-pink bg-pink-50 text-plum"
                          : "border-line bg-white text-navy hover:bg-pink-50/60",
                      )}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {ehCredito ? (
              <Field
                label="Parcelas"
                htmlFor="venda-parcelas"
                required
                error={erros["venda-parcelas"]}
                hint="O número de parcelas define a taxa aplicada."
              >
                <select
                  id="venda-parcelas"
                  data-testid="venda-parcelas"
                  value={parcelas}
                  onChange={(evento) => {
                    setParcelas(evento.target.value);
                    limparErro("venda-parcelas");
                    limparErro("venda-taxa");
                  }}
                  disabled={salvando}
                  aria-invalid={Boolean(erros["venda-parcelas"]) || undefined}
                  aria-describedby={descricao("venda-parcelas", "dica")}
                  className={selectBase}
                >
                  {PARCELAS_CREDITO.map((numero) => (
                    <option key={numero} value={String(numero)}>
                      {numero}x
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="rounded-xl border border-line bg-slate-50/50 px-3.5 py-3 text-xs text-muted">
                Débito é liquidado em parcela única.
              </p>
            )}

            <Field
              label="Primeiro vencimento"
              htmlFor="venda-vencimento"
              required
              error={erros["venda-vencimento"]}
              hint="As demais parcelas vencem mensalmente a partir desta data."
            >
              <input
                id="venda-vencimento"
                data-testid="venda-primeiro-vencimento"
                name="primeiroVencimento"
                type="date"
                value={primeiroVencimento}
                min={dataPedido || undefined}
                onChange={(evento) => {
                  setPrimeiroVencimento(evento.target.value);
                  limparErro("venda-vencimento");
                }}
                disabled={salvando}
                aria-invalid={Boolean(erros["venda-vencimento"]) || undefined}
                aria-describedby={descricao("venda-vencimento", "dica")}
                className={inputBase}
              />
            </Field>

            {taxaIndisponivel ? (
              <InlineAlert tom="atencao">
                <span className="block">
                  {avisoTaxas
                    ? `Tabela de taxas indisponível: ${avisoTaxas}`
                    : `Sem taxa configurada para ${bandeira || "a bandeira selecionada"} · ${rotuloModalidade(modalidade)} · ${parcelasNumero}x.`}
                </span>
                <span className="mt-1 block text-xs">
                  A venda no cartão fica bloqueada até a combinação ser
                  configurada.
                </span>
                {podeConfigurarTaxas ? (
                  <ButtonLink
                    href="/financeiro?aba=taxas"
                    variante="secundario"
                    tamanho="sm"
                    className="mt-2"
                  >
                    Configurar taxas
                  </ButtonLink>
                ) : null}
              </InlineAlert>
            ) : taxaSelecionada ? (
              <p className="rounded-xl bg-pink-50 px-3.5 py-2.5 text-xs font-medium text-plum">
                Taxa configurada: {resumo.percentual.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}
                % para {bandeira} · {rotuloModalidade(modalidade)} · {parcelasNumero}x.
              </p>
            ) : null}

            {erros["venda-taxa"] ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {erros["venda-taxa"]}
              </p>
            ) : null}
          </div>
        )}

        <div
          className="mt-4 rounded-xl border border-line bg-white p-3"
          data-testid="venda-resumo-pagamento"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Resumo do recebimento
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Bruto</dt>
              <dd className="font-semibold text-navy" data-testid="venda-bruto">
                {formatMoeda(totalPreview)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">
                Taxa{aliquota !== null ? ` (${resumo.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""}
              </dt>
              <dd className="font-semibold text-amber-700" data-testid="venda-taxa">
                {ehCartao && aliquota === null ? "—" : formatMoeda(resumo.taxa)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-1.5">
              <dt className="font-semibold text-navy">Líquido</dt>
              <dd className="text-base font-bold text-plum" data-testid="venda-liquido">
                {ehCartao && aliquota === null ? "—" : formatMoeda(resumo.liquido)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {rotuloForma(forma)}
            {ehCartao
              ? ` · ${rotuloModalidade(modalidade)} · ${parcelasNumero}x`
              : recebido
                ? " · recebimento confirmado"
                : " · aguardando recebimento"}
            . Valores estimados; o servidor recalcula a taxa oficial.
          </p>
        </div>
      </Card>

      <Card>
        <Field
          label="Observações"
          htmlFor="venda-observacoes"
          error={erros["venda-observacoes"]}
          hint="Opcional, até 1.000 caracteres."
        >
          <textarea
            id="venda-observacoes"
            data-testid="venda-observacoes"
            name="observacoes"
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            maxLength={1000}
            rows={3}
            disabled={salvando}
            aria-invalid={Boolean(erros["venda-observacoes"]) || undefined}
            aria-describedby={descricao("venda-observacoes", "dica")}
            className={textareaBase}
            placeholder="ex.: entregar na feira de sábado"
          />
        </Field>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          type="submit"
          className="w-full sm:flex-1"
          disabled={salvando || taxaIndisponivel}
          data-testid="venda-salvar"
        >
          {salvando ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
          Concluir venda
        </Button>
        <ButtonLink href="/vendas" variante="secundario" className="w-full sm:flex-1">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
