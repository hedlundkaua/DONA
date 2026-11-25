"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputBase } from "@/components/ui/field";
import { apiFetch } from "@/lib/http";
import { hojeISO } from "@/lib/format";

export type Taxa = {
  bandeira: string;
  modalidade: "DEBITO" | "CREDITO";
  parcelas: number;
  percentual: string;
};
function useGravacao() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function gravar(
    path: string,
    method: string,
    body: unknown,
    sucesso: string,
  ) {
    setOcupado(true);
    setMensagem("");
    try {
      const r = await apiFetch(path, { method, body: JSON.stringify(body) });
      setMensagem(r.ok ? sucesso : r.message);
      if (r.ok) router.refresh();
      return r.ok;
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, mensagem, gravar };
}
export function Confirmar({ id }: { id: number }) {
  const { ocupado, mensagem, gravar } = useGravacao();
  async function receber(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget).get("data");
    await gravar(
      "/financeiro/parcelas/" + id + "/receber",
      "POST",
      { data },
      "Recebimento confirmado.",
    );
  }
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-semibold text-plum">
        Registrar recebimento
      </summary>
      <form onSubmit={receber} className="mt-2 space-y-2">
        <label>
          Data efetiva
          <input
            className={inputBase}
            type="date"
            name="data"
            defaultValue={hojeISO()}
            required
          />
        </label>
        <Button type="submit" tamanho="sm" disabled={ocupado}>
          Confirmar recebimento
        </Button>
        <p role="status">{mensagem}</p>
      </form>
    </details>
  );
}
export function Lancar() {
  const { ocupado, mensagem, gravar } = useGravacao();
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const objeto = Object.fromEntries(new FormData(form));
    if (
      await gravar(
        "/financeiro/lancamentos",
        "POST",
        objeto,
        "Lançamento registrado.",
      )
    )
      form.reset();
  }
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-bold text-plum">
          Novo lançamento manual
        </summary>
        <form onSubmit={enviar} className="mt-3 grid gap-3">
          <label>
            Tipo
            <select className={inputBase} name="tipo">
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </label>
          <label>
            Descrição
            <input
              className={inputBase}
              name="descricao"
              required
              maxLength={200}
            />
          </label>
          <label>
            Valor (R$)
            <input
              className={inputBase}
              name="valor"
              inputMode="decimal"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            Data efetiva
            <input
              className={inputBase}
              name="data"
              type="date"
              defaultValue={hojeISO()}
              required
            />
          </label>
          <Button disabled={ocupado} type="submit">
            Salvar lançamento
          </Button>
          <p role="status">{mensagem}</p>
        </form>
      </details>
    </Card>
  );
}
export function Taxas({ iniciais }: { iniciais: Taxa[] }) {
  const [linhas, setLinhas] = useState(iniciais);
  const { ocupado, mensagem, gravar } = useGravacao();
  function alterar(i: number, dados: Partial<Taxa>) {
    setLinhas((antes) =>
      antes.map((t, n) => (n === i ? { ...t, ...dados } : t)),
    );
  }
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const taxas = linhas.map(
      ({ bandeira, modalidade, parcelas, percentual }) => ({
        bandeira: bandeira.trim(),
        modalidade,
        parcelas,
        percentual,
      }),
    );
    await gravar(
      "/financeiro/taxas",
      "PUT",
      { taxas },
      "Tabela de taxas salva.",
    );
  }
  return (
    <Card>
      <CardTitle>Taxas por bandeira</CardTitle>
      <p className="mb-3 text-sm">
        Informe a taxa de cada modalidade e número de parcelas. Para uma
        operação sem taxa, informe 0%.
      </p>
      <form className="space-y-4" onSubmit={salvar}>
        {linhas.map((t, i) => (
          <fieldset
            className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2"
            key={i}
          >
            <legend className="font-bold">Taxa {i + 1}</legend>
            <label>
              Bandeira
              <input
                className={inputBase}
                value={t.bandeira}
                required
                maxLength={50}
                onChange={(e) => alterar(i, { bandeira: e.target.value })}
              />
            </label>
            <label>
              Modalidade
              <select
                className={inputBase}
                value={t.modalidade}
                onChange={(e) =>
                  alterar(
                    i,
                    e.target.value === "DEBITO"
                      ? { modalidade: "DEBITO", parcelas: 1 }
                      : { modalidade: "CREDITO" },
                  )
                }
              >
                <option value="DEBITO">Débito</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </label>
            <label>
              Parcelas
              <input
                className={inputBase}
                type="number"
                min={1}
                max={36}
                step={1}
                required
                disabled={t.modalidade === "DEBITO"}
                value={t.parcelas || ""}
                onChange={(e) =>
                  alterar(i, { parcelas: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Taxa (%)
              <input
                className={inputBase}
                type="number"
                inputMode="decimal"
                min={0}
                max="99.99"
                step="0.01"
                required
                value={t.percentual}
                onChange={(e) => alterar(i, { percentual: e.target.value })}
              />
            </label>
            <Button
              tamanho="sm"
              variante="discreto"
              onClick={() => setLinhas(linhas.filter((_, n) => n !== i))}
            >
              Retirar da tabela
            </Button>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variante="secundario"
            onClick={() =>
              setLinhas([
                ...linhas,
                {
                  bandeira: "",
                  modalidade: "CREDITO",
                  parcelas: 1,
                  percentual: "",
                },
              ])
            }
          >
            Adicionar taxa
          </Button>
          <Button type="submit" disabled={ocupado}>
            Salvar tabela
          </Button>
        </div>
        <p role="status">{mensagem}</p>
      </form>
    </Card>
  );
}
