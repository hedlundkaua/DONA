import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page-title";
import { AlterarSenhaForm } from "./alterar-senha-form";

export const metadata: Metadata = { title: "Alterar senha" };
export const dynamic = "force-dynamic";

export default function AlterarSenhaPage() {
  return (
    <>
      <PageTitle
        sobretitulo="Mais / Segurança"
        titulo="Alterar senha"
        descricao="Atualize sua senha de acesso. As outras sessões serão encerradas."
      />
      <Card>
        <AlterarSenhaForm />
      </Card>
    </>
  );
}
