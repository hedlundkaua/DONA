/**
 * Regras compartilhadas pelas telas públicas de autenticação.
 * O backend continua sendo a autoridade final; aqui só evitamos idas
 * desnecessárias ao servidor e mantemos as mensagens públicas genéricas.
 */

export const SENHA_MIN_CARACTERES = 12;
export const SENHA_MAX_BYTES = 72;
export const NOME_MIN_CARACTERES = 2;
export const NOME_MAX_CARACTERES = 150;
export const NOME_USUARIO_MIN_CARACTERES = 3;
export const NOME_USUARIO_MAX_CARACTERES = 50;
export const NOME_USUARIO_REGEX = /^[A-Za-z0-9._-]{3,50}$/;
export const EMAIL_MAX_CARACTERES = 254;
export const OTP_DIGITOS = 6;
export const OTP_VALIDADE_MINUTOS = 10;
export const OTP_MAX_TENTATIVAS = 5;
export const OTP_REENVIO_SEGUNDOS = 60;

export const MENSAGEM_CADASTRO_GENERICA =
  "Se o cadastro puder ser processado, enviaremos instruções para verificar o e-mail.";

export const MENSAGEM_RECUPERACAO_GENERICA =
  "Se houver uma conta com esse e-mail, enviaremos instruções para redefinir a senha.";

export const MENSAGEM_REENVIO_GENERICA =
  "Se houver uma conta pendente com esse e-mail, enviaremos um novo código.";

export function emailValido(email: string): boolean {
  const valor = email.trim();
  if (valor.length === 0 || valor.length > EMAIL_MAX_CARACTERES) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return false;

  const at = valor.indexOf("@");
  const local = valor.slice(0, at);
  const dominio = valor.slice(at + 1);
  if (!local || !dominio) return false;
  if (
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return false;
  }
  if (
    dominio.startsWith(".") ||
    dominio.endsWith(".") ||
    dominio.includes("..")
  ) {
    return false;
  }

  return true;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nomeValido(nome: string): boolean {
  const valor = nome.trim();
  return (
    valor.length >= NOME_MIN_CARACTERES &&
    valor.length <= NOME_MAX_CARACTERES
  );
}

export function nomeUsuarioValido(nomeUsuario: string): boolean {
  return NOME_USUARIO_REGEX.test(nomeUsuario.trim());
}

export function validarSenha(senha: string): string | null {
  if (Array.from(senha).length < SENHA_MIN_CARACTERES) {
    return `A senha precisa ter pelo menos ${SENHA_MIN_CARACTERES} caracteres.`;
  }

  if (new TextEncoder().encode(senha).length > SENHA_MAX_BYTES) {
    return `A senha pode ter no máximo ${SENHA_MAX_BYTES} bytes.`;
  }

  return null;
}

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, "").slice(0, OTP_DIGITOS);
}

export function codigoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${OTP_DIGITOS}}$`).test(codigo);
}

export function mensagemEspera(segundos: number): string {
  const valor = Math.max(1, Math.ceil(segundos));
  return `Muitas solicitações. Aguarde ${valor}s e tente novamente.`;
}
