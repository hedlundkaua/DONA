import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { PageTitle } from "@/components/ui/page-title";
import { backendFetch } from "@/lib/api";
import { formatData, formatMoeda } from "@/lib/format";
import { podeGerirTaxas, podeVerFinanceiro } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { Confirmar, Lancar, Taxas } from "./formularios";

import type { LancamentoFinanceiro, PaginaFinanceira, ParcelaFinanceira, RelatorioVendas, TaxaCartao } from "@/lib/types";

export const metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

type Caixa = PaginaFinanceira<LancamentoFinanceiro, { entradas: string; saidas: string; saldo: string }>;
type Parcelas = PaginaFinanceira<ParcelaFinanceira, { pendente: string; recebido: string }>;
type Vendas = RelatorioVendas;
const abas = {
  resumo: "Visão geral",
  parcelas: "A receber",
  caixa: "Entradas e saídas",
  vendas: "Relatório de vendas",
  taxas: "Taxas da maquininha",
};
type Aba = keyof typeof abas;
const rotulos: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  MANUAL: "Manual",
  VENDA: "Venda",
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO: "Cartão",
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  RECEBIDA: "Recebida",
  NAO_INFORMADA: "Não informada",
};
const label = (key: string | null) => rotulos[key ?? "NAO_INFORMADA"] ?? key;
function Totais({ dados }: { dados: [string, string | number][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {dados.map(([nome, valor]) => (
        <div className="rounded-xl bg-pink-50 p-3" key={nome}>
          <dt className="text-xs text-muted">{nome}</dt>
          <dd className="break-words font-bold text-navy">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
function Falha({ texto }: { texto: string }) {
  return (
    <p role="alert" className="rounded-xl bg-pink-50 p-3 text-danger">
      {texto}
    </p>
  );
}
function Paginacao({
  aba,
  busca,
  pagina,
  total,
  limite,
}: {
  aba: Aba;
  busca: URLSearchParams;
  pagina: number;
  total: number;
  limite: number;
}) {
  const paginas = Math.ceil(total / limite);
  function href(n: number) {
    const q = new URLSearchParams(busca);
    q.set("aba", aba);
    q.set("page", String(n));
    return "/financeiro?" + q;
  }
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      {pagina > 1 && <Link href={href(pagina - 1)}>Anterior</Link>}
      <span>
        {total
          ? `Página ${pagina} de ${paginas}`
          : "Nenhum registro encontrado."}
      </span>
      {pagina < paginas && <Link href={href(pagina + 1)}>Próxima</Link>}
    </div>
  );
}
function Filtros({ aba, q }: { aba: Aba; q: URLSearchParams }) {
  const opcoes: Record<string, string[]> =
    aba === "caixa"
      ? { tipo: ["ENTRADA", "SAIDA"], origem: ["MANUAL", "VENDA"] }
      : aba === "vendas"
        ? {
            forma: ["DINHEIRO", "PIX", "CARTAO", "NAO_INFORMADA"],
            situacao: ["PENDENTE", "PARCIAL", "RECEBIDA", "NAO_INFORMADA"],
          }
        : { status: ["PENDENTE", "RECEBIDA"] };
  const nomes: Record<string, string> = {
    tipo: "Tipo",
    origem: "Origem",
    forma: "Forma de pagamento",
    situacao: "Situação",
    status: "Situação",
  };
  return (
    <Card>
      <form method="get" className="grid grid-cols-2 gap-3 text-sm">
        <input type="hidden" name="aba" value={aba} />
        {["de", "ate"].map((k) => (
          <label key={k}>
            {k === "de" ? "De" : "Até"}
            <input
              className={inputBase}
              type="date"
              name={k}
              defaultValue={q.get(k) ?? ""}
            />
          </label>
        ))}
        {Object.entries(opcoes).map(([k, op]) => (
          <label key={k}>
            {nomes[k]}
            <select
              className={inputBase}
              name={k}
              defaultValue={q.get(k) ?? ""}
            >
              <option value="">Todas</option>
              {op.map((o) => (
                <option key={o} value={o}>
                  {label(o)}
                </option>
              ))}
            </select>
          </label>
        ))}
        {aba === "vendas" && (
          <label>
            Cliente (ID)
            <input
              className={inputBase}
              name="clienteId"
              type="number"
              min="1"
              defaultValue={q.get("clienteId") ?? ""}
            />
          </label>
        )}
        <div className="col-span-2 flex items-center gap-3">
          <Button type="submit" tamanho="sm">
            Aplicar filtros
          </Button>
          <Link href={"/financeiro?aba=" + aba}>Limpar</Link>
        </div>
      </form>
    </Card>
  );
}
export default async function Financeiro({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const perfil = session.status === "autenticado" ? session.user.perfil : null;
  if (!podeVerFinanceiro(perfil))
    return (
      <SemPermissao descricao="Financeiro disponível para administração, gestão e financeiro." />
    );
  const params = await searchParams;
  const aba: Aba =
    typeof params.aba === "string" && Object.hasOwn(abas, params.aba)
      ? (params.aba as Aba)
      : "resumo";
  if (aba === "taxas" && !podeGerirTaxas(perfil)) return <SemPermissao />;
  const campos =
    aba === "caixa"
      ? ["tipo", "origem"]
      : aba === "vendas"
        ? ["forma", "situacao", "clienteId"]
        : ["status"];
  const q = new URLSearchParams();
  for (const k of ["de", "ate", "page", ...campos]) {
    const v = params[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  q.set("limit", "20");
  let conteudo;
  if (aba === "resumo") {
    const [c, p, v] = await Promise.all([
      backendFetch<Caixa>("/api/financeiro/lancamentos?limit=1"),
      backendFetch<Parcelas>("/api/financeiro/parcelas?limit=1"),
      backendFetch<Vendas>("/api/relatorios/vendas?limit=1"),
    ]);
    conteudo = (
      <Card>
        <CardTitle>Acumulado do negócio</CardTitle>
        {!c.ok ? (
          <Falha texto={c.message} />
        ) : !p.ok ? (
          <Falha texto={p.message} />
        ) : !v.ok ? (
          <Falha texto={v.message} />
        ) : (
          <Totais
            dados={[
              ["Vendas brutas", formatMoeda(v.data.resumo.bruto)],
              ["A receber", formatMoeda(p.data.resumo.pendente)],
              ["Entradas", formatMoeda(c.data.resumo.entradas)],
              ["Saídas", formatMoeda(c.data.resumo.saidas)],
              ["Saldo do caixa", formatMoeda(c.data.resumo.saldo)],
            ]}
          />
        )}
      </Card>
    );
  } else if (aba === "taxas") {
    const r = await backendFetch<{ taxas: TaxaCartao[] }>("/api/financeiro/taxas");
    conteudo = r.ok ? (
      <Taxas iniciais={r.data.taxas} />
    ) : (
      <Falha texto={r.message} />
    );
  } else if (aba === "parcelas") {
    const r = await backendFetch<Parcelas>("/api/financeiro/parcelas?" + q);
    conteudo = !r.ok ? (
      <Falha texto={r.message} />
    ) : (
      <>
        <Totais
          dados={[
            ["A receber", formatMoeda(r.data.resumo.pendente)],
            ["Recebido", formatMoeda(r.data.resumo.recebido)],
          ]}
        />
        {r.data.items.map((i) => (
          <Card key={i.id}>
            <Link href={"/vendas/" + i.vendaId} className="font-bold text-plum">
              Venda #{i.vendaId} · {i.cliente.nome}
            </Link>
            <p>
              Parcela {i.numero}/{i.numeroParcelas} · {formatMoeda(i.valor)}
            </p>
            <p className="text-sm">Vencimento {formatData(i.vencimento)}</p>
            {i.status === "RECEBIDA" ? (
              <p>Recebida em {formatData(i.recebidoEm)}</p>
            ) : (
              <Confirmar id={i.id} />
            )}
          </Card>
        ))}
        <Paginacao
          aba={aba}
          busca={q}
          pagina={r.data.page}
          limite={r.data.limit}
          total={r.data.total}
        />
      </>
    );
  } else if (aba === "caixa") {
    const r = await backendFetch<Caixa>("/api/financeiro/lancamentos?" + q);
    conteudo = !r.ok ? (
      <Falha texto={r.message} />
    ) : (
      <>
        <Totais
          dados={[
            ["Entradas", formatMoeda(r.data.resumo.entradas)],
            ["Saídas", formatMoeda(r.data.resumo.saidas)],
            ["Saldo do período", formatMoeda(r.data.resumo.saldo)],
          ]}
        />
        <Lancar />
        {r.data.items.map((i) => (
          <Card key={i.id}>
            <strong>
              {label(i.tipo)} · {formatMoeda(i.valor)}
            </strong>
            <p>{i.descricao}</p>
            <p className="text-sm text-muted">
              {formatData(i.data)} · {label(i.origem)} · {i.usuario?.nome}
            </p>
            {i.vendaId && (
              <Link
                className="text-plum underline"
                href={"/vendas/" + i.vendaId}
              >
                Ver venda #{i.vendaId} · parcela #{i.parcelaId}
              </Link>
            )}
          </Card>
        ))}
        <Paginacao
          aba={aba}
          busca={q}
          pagina={r.data.page}
          limite={r.data.limit}
          total={r.data.total}
        />
      </>
    );
  } else {
    const r = await backendFetch<Vendas>("/api/relatorios/vendas?" + q);
    conteudo = !r.ok ? (
      <Falha texto={r.message} />
    ) : (
      <>
        <Totais
          dados={[
            ["Vendas", r.data.resumo.quantidade],
            ["Bruto", formatMoeda(r.data.resumo.bruto)],
            ["Taxas", formatMoeda(r.data.resumo.taxas)],
            ["Líquido previsto", formatMoeda(r.data.resumo.liquidoPrevisto)],
          ]}
        />
        {r.data.items.map((i) => (
          <Card key={i.id}>
            <Link className="font-bold text-plum" href={"/vendas/" + i.id}>
              Venda #{i.id} · {formatMoeda(i.total)}
            </Link>
            <p>
              {i.cliente.nome} (#{i.cliente.id}) · {formatData(i.dataPedido)}
            </p>
            <p>
              {label(i.forma)} · {label(i.situacao)}
            </p>
          </Card>
        ))}
        <Paginacao
          aba={aba}
          busca={q}
          pagina={r.data.page}
          limite={r.data.limit}
          total={r.data.total}
        />
      </>
    );
  }
  return (
    <div className="space-y-4">
      <PageTitle
        sobretitulo="Meu negócio"
        titulo="Financeiro"
        descricao={abas[aba]}
      />
      <nav aria-label="Seções do financeiro" className="flex flex-wrap gap-2">
        {(Object.keys(abas) as Aba[])
          .filter((k) => k !== "taxas" || podeGerirTaxas(perfil))
          .map((k) => (
            <ButtonLink
              key={k}
              aria-current={k === aba ? "page" : undefined}
              href={"/financeiro?aba=" + k}
              tamanho="sm"
              variante={k === aba ? "primario" : "secundario"}
            >
              {abas[k]}
            </ButtonLink>
          ))}
      </nav>
      {!["resumo", "taxas"].includes(aba) && <Filtros aba={aba} q={q} />}{" "}
      {conteudo}
    </div>
  );
}
