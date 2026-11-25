import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { AlertIcon } from "@/components/ui/icons";

export function SemPermissao({
  descricao = "Seu perfil não tem permissão para esta ação. Fale com a administração do negócio.",
}: {
  descricao?: string;
}) {
  return (
    <EmptyState
      titulo="Acesso restrito"
      descricao={descricao}
      icone={<AlertIcon className="h-6 w-6" />}
      acao={
        <ButtonLink href="/" variante="secundario" className="w-full">
          Voltar ao painel
        </ButtonLink>
      }
    />
  );
}
