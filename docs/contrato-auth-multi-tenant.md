# Autenticação e multi-tenant — contrato confirmado no frontend

**Status:** telas e pass-through implementados; integração real pendente da
publicação dos endpoints atualizados pelo backend.
**Data:** 12/11/2026
**Responsável:** Luma (frontend)
**Contrato de origem:** Cedro via Codex, confirmado em 13/11/2026.
**Referência de backend:** `backend/docs/multi-tenancy-auth.md` (não encontrado
no repositório no momento desta implementação).

O frontend não alterou backend, schema, migrações ou bancos. O fluxo usa apenas
as rotas abaixo, sem mocks, e mantém a sessão/CSRF do login existente.

## 1. Endpoints públicos

| Método | Rota | Payload | Sucesso |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ nome, nomeEmpresa, email, senha }` | `202` genérico com `EMAIL_VERIFICATION_REQUIRED` |
| POST | `/api/auth/verify-email` | `{ email, codigo }` | `200` com `EMAIL_VERIFIED`; não cria sessão |
| POST | `/api/auth/resend-verification` | `{ email }` | `202` genérico |
| POST | `/api/auth/forgot-password` | `{ email }` | `202` genérico |
| POST | `/api/auth/reset-password` | `{ email, codigo, novaSenha }` | `200`; revoga sessões e não autentica |

Regras do contrato:

- Cadastro cria o negócio e um usuário com perfil `ADMINISTRADOR`; perfil não é
  aceito no payload. O payload exato não inclui `nomeUsuario`.
- E-mail é globalmente único; a resposta de cadastro não revela se a conta já
  existia.
- Senha: mínimo de 8 caracteres Unicode e máximo de 72 bytes UTF-8. A lista
  comum combinada com o Cedro é comparada de forma case-insensitive, exata e
  sem trim: `12345678`, `123456789`, `1234567890`, `password`, `password1`,
  `qwerty123`, `letmein`, `welcome1`, `iloveyou`, `admin123`, `senha123` e
  `abc12345`. O login legado não aplica a regra nova.
- OTP: exatamente 6 dígitos, validade de 10 minutos, até 5 tentativas, reenvio
  após 60 segundos e teto de 5 envios por hora por e-mail + propósito.
- Cadastro duplicado, reenvio e pedido de recuperação respondem `202` genérico
  inclusive em cooldown/limite; a interface mantém a mesma mensagem neutra e
  não confirma que o envio aconteceu.
- Nenhum OTP, hash ou token é retornado para a interface ou registrado em log.
- Verificação inválida, expirada, inexistente ou já verificada retorna `400`
  genérico. Cadastro, verificação e reset **não** autenticam automaticamente.
  O login é sempre explícito; o reset invalida todas as sessões.
- Login existente continua com `{ identifier, password, lembrarDeMim? }`, cookie
  opaco `HttpOnly`/`SameSite=Lax`/`Secure` em produção e `csrfToken`.
  `lembrarDeMim=true` mantém a sessão por 30 dias; omitido ou `false` usa o TTL
  padrão (`SESSION_TTL_HOURS`, 12 h). O login legado aceita usuário ou e-mail e
  não aplica a nova regra de senha.

## 2. Rotas de interface

| Rota | Função |
| --- | --- |
| `/login` | Login, link de recuperação e link de cadastro |
| `/cadastro` | Cadastro do negócio e do acesso de administração |
| `/verificar-email` | OTP de 6 dígitos e reenvio com cooldown |
| `/esqueci-senha` | Solicitação genérica de recuperação |
| `/redefinir-senha` | OTP + nova senha |
| `/mais/senha` | Troca de senha autenticada (fora do fluxo OTP) |

Todas são públicas no `proxy.ts`. Os handlers em `app/api/auth/*` são dedicados
e não exigem sessão; as demais rotas `/api/*` continuam usando o pass-through
autenticado com CSRF.

## 3. Decisões de segurança e usabilidade

- Mensagens de cadastro, recuperação e reenvio são genéricas.
- OTP nunca aparece na tela, em URL, query string, log ou resposta de erro.
  A única cópia fica no e-mail enviado pelo backend.
- Não há auto-login após cadastro, verificação ou reset.
- A interface valida os 6 dígitos e a senha localmente para evitar requisições
  inválidas, mas o backend é a autoridade final.
- “Lembrar de mim” começa desmarcado e exibe aviso para uso apenas em
  dispositivo pessoal. Quando marcado, a sessão e o cookie CSRF usam 30 dias;
  sem a opção, usam `SESSION_TTL_HOURS` (12 h por padrão).
- O cookie CSRF é ressincronizado no carregamento do shell a partir de
  `csrfMaxAgeSeconds`/`expiresAt` devolvidos por `GET /api/auth/session`,
  limitado ao tempo restante da sessão e sem renovar a sessão. Logout e troca
  de senha limpam o cookie; a troca autenticada revoga as sessões no backend.
- O limite de tentativas e o teto de envios são do backend; respostas de
  reenvio/recuperação são neutras inclusive em cooldown/limite. A UI mantém
  cooldown visual fixo de 60 segundos e não confirma envio.
- O fluxo usa linguagem neutra sobre a pessoa empreendedora e o próprio
  negócio, sem assumir cooperativa.
- O e-mail de teste deve ser lido pelo harness isolado/Ethereal. O frontend não
  usa Resend real nesta etapa.

## 4. Test IDs

`login-email`, `login-password`, `login-password-toggle`, `login-remember`,
`login-submit`, `login-forgot`,
`login-register`, `login-verify-email`,
`cadastro-nome`, `cadastro-empresa`, `cadastro-email`, `cadastro-senha`,
`cadastro-confirmar-senha`, `cadastro-submit`,
`verificar-email`, `verificar-codigo`, `verificar-submit`,
`verificar-reenviar`,
`esqueci-email`, `esqueci-submit`, `esqueci-redefinir-link`,
`redefinir-email`, `redefinir-codigo`, `redefinir-senha`,
`redefinir-confirmar-senha`, `redefinir-submit`,
`mais-senha`, `senha-atual`, `senha-nova`, `senha-confirmar`, `senha-submit`.

Extras de navegação/estado: `verificar-ir-login`, `redefinir-ir-login`,
`redefinir-novo-codigo`, `cadastro-login-link`, `verificar-login-link`,
`esqueci-login-link`, `redefinir-login-link`, `senha-ir-login`, `*-toggle` para
os campos de senha.

## 5. Verificação executada

- `npm run lint` — passou.
- `npm run build` — passou; as cinco rotas públicas e os cinco handlers de API
  aparecem no build.
- Smoke local isolado, sem backend e sem banco: as cinco páginas responderam
  `200` e continham seus test IDs; a raiz sem sessão respondeu `307`; POSTs
  públicos sem sessão responderam `502` (backend isolado desligado), não `401`,
  confirmando que não passam pelo proxy autenticado.
- Pass-through com stub isolado: `register` **202** genérico, `verify-email`
  inválido **400** genérico, `resend-verification` **202**, `forgot-password`
  em cooldown **202** genérico sem header de conta e `reset-password` **200**.
  Nenhuma sessão foi criada e nenhum OTP real foi gerado, enviado ou lido.

## 6. Pendências e riscos de contrato

- O backend ainda não publicou os endpoints nem o documento
  `backend/docs/multi-tenancy-auth.md`; não houve teste integrado real.
- O contrato é provisório. Se os nomes de campos, códigos ou mensagens mudarem,
  os handlers e formulários precisam ser ajustados.
- Endpoints públicos de autenticação não usam CSRF porque não há sessão; o
  login mantém o fluxo atual. Se o backend exigir CSRF também neles, será uma
  incompatibilidade a resolver antes da integração.
- O teste de e-mail depende do harness isolado/Ethereal; não usar Resend live.
- Falta validar no navegador o fluxo completo com backend de teste isolado,
  incluindo cooldown/limite retornando `202` genérico, expiração de OTP,
  reenvio e revogação de sessões no reset.
