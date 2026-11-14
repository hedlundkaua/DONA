# Multi-tenancy, cadastro e autenticaÃ§Ã£o R5

Este documento descreve o contrato provisÃ³rio implementado no backend. As decisÃµes de negÃ³cio ainda sem confirmaÃ§Ã£o formal permanecem identificadas como provisÃ³rias; nÃ£o se deve interpretÃ¡-las como requisito definitivo.

## Tenant e isolamento

Cada cadastro pÃºblico cria um `Negocio` prÃ³prio e um `Usuario` inicial `ADMINISTRADOR`. UsuÃ¡rios adicionados por administrador sÃ£o associados ao `negocioId` da sessÃ£o e nunca criam outro negÃ³cio. O identificador do tenant Ã© interno: nÃ£o Ã© retornado Ã  UI nem aceito no payload. O backend o obtÃ©m da sessÃ£o validada.

Todas as operaÃ§Ãµes de categorias, produtos, clientes, vendas, itens, movimentos, ajustes e usuÃ¡rios filtram pelo `negocioId` no servidor. RelaÃ§Ãµes comerciais usam chaves estrangeiras compostas `(negocio_id, id)` para impedir ligaÃ§Ãµes cruzadas, inclusive em operaÃ§Ãµes concorrentes. Nomes de categoria e produto sÃ£o Ãºnicos por tenant; categorias nÃ£o distinguem caixa. RestriÃ§Ãµes de exclusÃ£o preservam histÃ³rico (RESTRICT), sem cascata comercial.

Para perfis com permissÃ£o na operaÃ§Ã£o, ID inexistente e ID de outro tenant retornam o mesmo 404, apÃ³s a checagem do perfil. Perfil sem permissÃ£o recebe 403 antes de qualquer consulta sobre o ID. Em `/api/usuarios`, colisÃµes retornam 409 genÃ©rico sem indicar campo nem tenant.

## Cadastro, OTP e sessÃ£o

### Cadastro pÃºblico

`POST /api/auth/register`

Payload exato: `{ "nome": string, "nomeUsuario": string, "email": string, "senha": string }`.

Senha: mÃ­nimo 8 caracteres Unicode e mÃ¡ximo 72 bytes UTF-8. `nomeUsuario` aceita letras ASCII, nÃºmeros, ponto, sublinhado e hÃ­fen, com 3â€“50 caracteres. Email tem validaÃ§Ã£o sintÃ¡tica e atÃ© 254 caracteres. Payload malformado retorna 400 antes de consulta de existÃªncia. Payload vÃ¡lido sempre retorna 202 genÃ©rico, inclusive quando email/nomeUsuario jÃ¡ existem; nÃ£o cria sessÃ£o. Resposta: `{ success: true, data: { status: "EMAIL_VERIFICATION_REQUIRED", message: string } }`.

O usuÃ¡rio pÃºblico inicial recebe perfil `ADMINISTRADOR`, mas nÃ£o autentica atÃ© confirmar o email. NÃ£o existe perfil/senha padrÃ£o.

### VerificaÃ§Ã£o e recuperaÃ§Ã£o

| MÃ©todo | Rota | Payload | Resposta vÃ¡lida |
|---|---|---|---|
| POST | `/api/auth/verify-email` | `{ email, codigo }` | 200 `EMAIL_VERIFIED`; nunca emite cookie |
| POST | `/api/auth/resend-verification` | `{ email }` | 202 genÃ©rico |
| POST | `/api/auth/forgot-password` | `{ email }` | 202 genÃ©rico |
| POST | `/api/auth/reset-password` | `{ email, codigo, novaSenha }` | 200; requer login posterior |

Os cÃ³digos tÃªm seis dÃ­gitos, expiram em dez minutos, sÃ£o gerados com `crypto.randomInt`, e o banco guarda HMAC-SHA-256 com `OTP_PEPPER` (nÃ£o o cÃ³digo). O OTP tem uso Ãºnico; a emissÃ£o nova invalida o anterior. SÃ£o aceitas no mÃ¡ximo cinco falhas por email normalizado e finalidade em janela de dez minutos contada da primeira falha. Reenvio nÃ£o zera nem reinicia essa janela; bloqueio dura atÃ© seu fim. HÃ¡ cooldown de 60 segundos e teto de cinco envios por hora. Cooldown/teto nÃ£o mudam a resposta genÃ©rica 202.

`verify-email` retorna o mesmo 400 genÃ©rico para cÃ³digo invÃ¡lido, expirado, inexistente, usado ou email jÃ¡ verificado. Reset de conta nÃ£o verificada nÃ£o confirma email nem cria sessÃ£o. Reset permite repetir a senha anterior, revoga todas as sessÃµes da conta e nÃ£o devolve cookie. Todas as rotas de autenticaÃ§Ã£o evitam enumerar contas em respostas de cadastro, reenvio e recuperaÃ§Ã£o. Senha, OTP e tokens nÃ£o entram em auditoria nem logs da aplicaÃ§Ã£o.

UsuÃ¡rios criados por `POST /api/usuarios` tambÃ©m ficam com email nÃ£o verificado e precisam usar o mesmo fluxo OTP antes do primeiro login. A resposta Ã© 201, contÃ©m o usuÃ¡rio seguro e nÃ£o informa outros tenants. Uma colisÃ£o de identidade resulta em 409 `{ success: false, error: "Conflito ao criar usuÃ¡rio." }` (mensagem genÃ©rica).

### Transporte de sessÃ£o e CSRF

Login: `POST /api/auth/login` com `{ identifier, password }`; login aceita email ou nomeUsuario globalmente Ãºnico. Login de email ainda nÃ£o verificado/inativo usa a resposta genÃ©rica 401. SessÃ£o Ã© token aleatÃ³rio de 256 bits; banco guarda somente SHA-256 do token. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, e `Secure` em produÃ§Ã£o (`__Host-dona_session` em produÃ§Ã£o; `dona_session` fora dela). TTL padrÃ£o 12h, configurÃ¡vel por `SESSION_TTL_HOURS` (1â€“168h).

Login e `/api/auth/session` entregam `csrfToken`; toda mutaÃ§Ã£o autenticada exige `x-csrf-token`. GET/HEAD nÃ£o exige CSRF. Logout revoga a sessÃ£o e limpa o cookie. InativaÃ§Ã£o, alteraÃ§Ã£o de perfil e reset/troca de senha revogam as sessÃµes imediatamente. AlteraÃ§Ã£o administrativa de email desverifica a conta, revoga sessÃµes e envia OTP ao endereÃ§o novo.

NÃ£o hÃ¡ endpoint de trava/recuperaÃ§Ã£o de conta por operador implementado; recuperaÃ§Ã£o de senha Ã© exclusivamente pelo fluxo OTP. Lockout de OTP Ã© persistente no banco. Limite global por IP estÃ¡ pendente: a aplicaÃ§Ã£o nÃ£o confia em `X-Forwarded-For`/cabeÃ§alhos do cliente e ainda nÃ£o tem uma origem de proxy confiÃ¡vel configurada. Lockout de login existente Ã© por identificador, nÃ£o por IP.

## Provedores de email e configuraÃ§Ã£o

- `OTP_PEPPER` Ã© obrigatÃ³rio em todos os ambientes, deve conter pelo menos 32 bytes UTF-8 e ser diferente de `SESSION_SECRET`. Use segredo aleatÃ³rio prÃ³prio. Testes geram ambos efemeramente.
- `SESSION_SECRET` continua obrigatÃ³rio em produÃ§Ã£o (mÃ­nimo 32 bytes); em desenvolvimento sem valor, a chave de sessÃ£o Ã© efÃªmera e reinicializaÃ§Ã£o invalida sessÃµes.
- `EMAIL_PROVIDER=resend` Ã© aceito somente em produÃ§Ã£o e exige `RESEND_API_KEY` e `EMAIL_FROM`; erro de configuraÃ§Ã£o/envio falha fechado, sem fallback.
- `EMAIL_PROVIDER=ethereal` pode ser usado em `NODE_ENV=test` ou no runner R5 de producao com `DONA_TEST_MODE=1`. Em ambos os modos, o destino deve ser localhost/127.0.0.1/::1 na porta 5433 e no banco `dona_test_r5`; configure `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD` e `EMAIL_FROM`. Testes nunca chamam o Resend real.
- O envio SMTP tem limites de conexao/greeting/socket de 5s/3s/8s. Falha ou lentidao do provedor deixa o OTP pendente para reenvio e mantem o contrato generico 202 dentro do timeout do frontend.
- `EMAIL_PROVIDER=disabled` sÃ³ Ã© permitido fora de produÃ§Ã£o e nÃ£o imprime cÃ³digos. O endereÃ§o `ETHEREAL_TEST_CAPTURE_URL`, se usado pelo harness, recebe somente o `messageId`.

Os valores ficam no ambiente de execuÃ§Ã£o, nunca commitados. Consulte `.env.example` para nomes, sem preencher segredos nele.

Antes de consulta de existência em cadastro, reenvio ou recuperação, o backend valida a configuração estática do provedor. Configuração ausente/inválida retorna 503 genérico para qualquer endereço e não cria usuário nem consulta a conta alvo. `/api/usuarios` aplica a validação antes de criar a conta.

Se a configuração estiver válida mas a entrega falhar transitoriamente, as respostas permanecem genéricas para impedir enumeração (cadastro 202, reenvio/recuperação 202, criação administrativa 201). O desafio não consumido fica marcado `codigos_otp.envio_pendente=true`; sessão continua bloqueada até verificação. Não há OTP em logs nem respostas. O usuário solicita novo envio após o cooldown de 60 segundos pelo endpoint de verificação ou recuperação. Isso gera novo código e invalida o anterior sem reiniciar a janela de falhas. Não existe worker automático de retry nesta versão.

## Modelo e migraÃ§Ã£o

Tabelas/escopo:

| Tabela | ConteÃºdo / isolamento |
|---|---|
| `negocios` | tenant/conta e estado `ATIVO` ou `QUARENTENA` |
| `usuarios`, `sessoes_usuarios`, `auditoria_usuarios` | identidade, sessÃµes e auditoria com `negocio_id` |
| `categorias_produtos`, `categorias_nomes_legacy`, `produtos` | catÃ¡logo e nomes originais preservados de categorias renomeadas pela migraÃ§Ã£o anterior |
| `clientes`, `vendas`, `itens_venda` | dados comerciais com relaÃ§Ãµes compostas no mesmo tenant |
| `movimentacoes_estoque`, `ajustes_inventario` | histÃ³rico de estoque com relaÃ§Ãµes compostas no mesmo tenant |
| `codigos_otp`, `limites_envio_otp` | desafios HMAC, consumo, expiraÃ§Ã£o, contagem de falhas e throttle persistente |
| `login_throttles` | bloqueio de login por identificador; nÃ£o contÃ©m senha/token |

MigraÃ§Ã£o R5: `prisma/migrations/20261112100000_tenants_email_otp/migration.sql`. Ela nÃ£o apaga registros comerciais nem escolhe um usuÃ¡rio como proprietÃ¡rio. Todos os registros anteriores recebem `negocio_id` da conta `QUARENTENA` desativada; emails legados permanecem nÃ£o verificados. Todas as sessÃµes prÃ©-R5 sÃ£o revogadas. RelaÃ§Ãµes cruzadas passam a ser impedidas por FKs compostas e deleÃ§Ãµes/cascatas comerciais sÃ£o bloqueadas.

ApÃ³s validar a titularidade do conjunto legado, um operador pode explicitamente executar `npm run auth:claim-legacy` apontando `DATABASE_URL` para o banco alvo e fornecendo `LEGACY_DATASET_OWNER_CONFIRMED=YES`, `LEGACY_EMAIL_VERIFICATION_POLICY=trust-existing-email` e uma referÃªncia nÃ£o sensÃ­vel em `LEGACY_OWNER_REFERENCE`. Em uma transaÃ§Ã£o serializÃ¡vel, o script move o conjunto inteiro da quarentena para um novo tenant, registra `LEGACY_TENANT_CLAIMED`, ativa esse tenant e marca contas antigas como verificadas sob a polÃ­tica atestada, com um evento `LEGACY_EMAIL_VERIFIED` por usuÃ¡rio. Esse evento grava a polÃ­tica, referÃªncia, origem e fato de que sessÃµes anteriores foram revogadas; nÃ£o inclui email, OTP, senha ou token. A quarentena permanece vazia para auditoria. O comando nÃ£o deve ser executado sem aprovaÃ§Ã£o documentada do titular.

O histÃ³rico de migraÃ§Ã£o anterior `20261110180000_auth_and_casefold` renomeia categorias duplicadas apenas quanto Ã  caixa/acentuaÃ§Ã£o de espaÃ§os, anexando sufixo `[legado ID]`; o nome original estÃ¡ preservado em `categorias_nomes_legacy`. A migraÃ§Ã£o nÃ£o remove linhas/produtos. Essa divergÃªncia histÃ³rica Ã© mantida explÃ­cita; nÃ£o reexecute ou altere migraÃ§Ãµes aplicadas.

## DecisÃµes provisÃ³rias e limitaÃ§Ãµes

Implementado conforme as decisÃµes R5 recebidas: categorias Ãºnicas sem distinÃ§Ã£o de caixa; estoque nÃ£o negativo e saldo inicial permitido; ajuste sem diferenÃ§a continua gerando registro; venda abaixo do custo bloqueada; fornecedor opcional e sem FK enquanto mÃ³dulo nÃ£o existe; produto pode ser inativado mantendo histÃ³rico. O reset nÃ£o registra pagamento, e nenhuma venda Ã© apagada. NÃ£o hÃ¡ pagamentos financeiros quitados, verificaÃ§Ã£o de domÃ­nio/SMTP, infraestrutura confiÃ¡vel para limitaÃ§Ã£o por IP, fluxo de recuperaÃ§Ã£o manual, nem configuraÃ§Ã£o de Resend real validada. `resend` estÃ¡ implementado mas nÃ£o foi enviado para Resend real nesta entrega.

## ValidaÃ§Ã£o segura

Use apenas banco PostgreSQL recÃ©m-criado e nome/porta exclusivos para testes. Antes de migrar, confirme hostname, porta e nome do banco do `DATABASE_URL`; scripts e smoke tests antigos vinculados a `dona_test_r3`/`r4` nÃ£o sÃ£o parte desta validaÃ§Ã£o. NÃ£o use `db:reset`, nÃ£o use a URL do `.env` por conveniÃªncia e nÃ£o execute migrations/seed/claim contra VPS ou banco de usuÃ¡rio.
