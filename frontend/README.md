# DONA — Frontend

Interface mobile-first para a gestão de produtos, estoque, clientes e vendas
das Empreendedoras Restinga. Consome **exclusivamente** a API real do backend
DONA, sem dados fictícios ou mocks na aplicação.

Os módulos de **Clientes** e **Vendas** estão integrados ao contrato congelado
do backend: listas, cadastro, edição, venda com múltiplos itens e detalhe usam
as rotas reais. O fluxo público de **cadastro, verificação de e-mail por OTP,
recuperação e redefinição de senha** segue o contrato de
autenticação/multi-tenant confirmado pelo Cedro; a integração real depende da
publicação desses endpoints. O contrato de referência do backend está em
`backend/docs/clientes-vendas.md`; o mapeamento de telas e as decisões de
frontend estão em `docs/contrato-clientes-vendas.md` e
`docs/contrato-auth-multi-tenant.md`.

## Stack

| Item | Versão / escolha |
| --- | --- |
| Framework | Next.js 16.4.6 (App Router, Server Components) |
| UI | React 19.3 + TypeScript 5 |
| Estilos | Tailwind CSS 4.3 (tokens próprios, sem biblioteca de componentes) |
| Fonte | Inter via `next/font` |
| Autenticação | Sessão do backend (cookie httpOnly) + CSRF espelhado |
| Porta | **3001** (`npm run dev` / `npm start`) |

## Como rodar

Pré-requisitos:

1. Backend DONA em execução em `http://localhost:3000`, com PostgreSQL
   migrado e ao menos um usuário ativo cadastrado.
2. Node.js 20+.

No diretório `frontend`:

```bash
npm install
cp .env.example .env.local   # ajuste BACKEND_URL se necessário
npm run dev                  # http://localhost:3001
```

Build de produção:

```bash
npm run build
npm start                    # http://localhost:3001
```

Variáveis de ambiente:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `BACKEND_URL` | `http://localhost:3000` | URL interna do backend. Usada apenas no servidor; nunca é exposta ao navegador. |
| `ENABLE_HSTS` | `false` | Habilita `Strict-Transport-Security`; use `true` somente em publicação HTTPS. |

Não há `SESSION_SECRET` no frontend: a sessão é emitida e validada pelo
backend.

### Backend necessário e bootstrap

O frontend foi implementado contra o contrato de autenticação atual do
backend (`backend/lib/auth.ts` e `backend/app/api/auth/*`):

- `POST /api/auth/login` com `{ identifier, password, lembrarDeMim? }`; `identifier`
  aceita e-mail e, para contas legadas, o usuário. `lembrarDeMim` é booleano e,
  quando `true`, mantém a sessão por 30 dias; quando omitido ou `false`, usa
  `SESSION_TTL_HOURS` (padrão 12 h);
- resposta `{ success: true, data: { user, csrfToken, csrfMaxAgeSeconds, expiresAt } }`
  + cookie de sessão;
- cookie `dona_session` em desenvolvimento e `__Host-dona_session` em produção,
  `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção e TTL configurável
  por `SESSION_TTL_HOURS` (1–168 h; padrão 12 h) ou 30 dias com `lembrarDeMim`;
- `GET /api/auth/session` valida a sessão e devolve usuário + `csrfToken`,
  `csrfMaxAgeSeconds`/`expiresAt`; o frontend ressincroniza o cookie CSRF com a
  validade efetiva da sessão no carregamento do shell;
- `POST /api/auth/session` revoga a sessão (logout);
- mutações exigem o header `X-CSRF-Token`; o frontend mantém o token apenas em
  memória e o proxy o injeta a partir do cookie httpOnly;
- `POST /api/auth/password` troca a senha autenticada e revoga todas as sessões;
- `POST /api/auth/register` cria o negócio e o acesso de administração, sem
  sessão, com payload exato `{ nome, nomeEmpresa, email, senha }` e resposta
  `202` genérica;
- `POST /api/auth/verify-email` e `POST /api/auth/resend-verification` validam
  ou reenviam o OTP de 6 dígitos;
- `POST /api/auth/forgot-password` e `POST /api/auth/reset-password` iniciam e
  concluem a recuperação por OTP; a resposta de solicitação é sempre genérica;
- OTP com validade de 10 minutos, até 5 tentativas, reenvio após 60 segundos e
  teto de 5 envios por hora por e-mail/propósito; cadastro duplicado, reenvio e
  pedido de recuperação respondem `202` genérico inclusive em cooldown/limite;
- o backend aplica lockout persistido: 10 falhas por identificador em 1 minuto
  bloqueiam novas tentativas por 1 minuto;
- cadastro, verificação e reset não criam sessão automática: o login é sempre
  explícito; o reset revoga todas as sessões;
- nenhum OTP, hash ou token é retornado para a interface ou registrado em log.
  E-mails reais só devem ser testados pelo harness isolado (Ethereal), nunca
  pelo Resend em produção nesta etapa.

**Não há usuário, e-mail ou senha padrão.** Para desenvolvimento, configure no
backend `DATABASE_URL`, `SESSION_SECRET` (32+ bytes), `NODE_ENV=development` e
`DEV_ADMIN_NAME`, `DEV_ADMIN_USERNAME`, `DEV_ADMIN_EMAIL` e
`DEV_ADMIN_PASSWORD`; depois rode `npm run db:seed`. O seed também cria dados
demonstrativos de produtos/categorias e usa uma regra própria do backend
(atualmente 12+ caracteres, até 72 bytes); a UI pública valida 8+ caracteres e
a lista de senhas comuns. Se a conta já existir, o seed atualiza a senha e
revoga suas sessões.

Para uma instalação vazia (inclusive produção), configure temporariamente
`BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_EMAIL` e
`BOOTSTRAP_ADMIN_PASSWORD` e rode `npm run auth:bootstrap`. O comando recusa se
já existir qualquer usuário, não imprime credenciais e registra auditoria.
Remova essas variáveis depois; novas contas podem usar o cadastro público ou ser
criadas pela administração em `POST /api/usuarios`.

Perfis do backend (nomes exatos): `ADMINISTRADOR`, `GESTOR`, `ESTOQUISTA`,
`VENDEDOR` e `FINANCEIRO`. O backend é a autoridade de permissões; a interface
apenas esconde ações que seriam rejeitadas.

## Arquitetura de integração

```
Navegador ──(cookie httpOnly)──► Next.js (3001)
                                   │  Proxy server-side /api/*
                                   │  + cookie de sessão
                                   │  + x-csrf-token
                                   ▼
                              Backend DONA (3000)
```

- **Leituras** (Server Components) chamam `BACKEND_URL` diretamente, com
  `cache: "no-store"` e timeout de 10 s.
- **Mutações autenticadas** (formulários) chamam `/api/*` no próprio frontend.
  O route handler `app/api/[...path]/route.ts` valida a presença do cookie,
  encaminha para o backend e injeta o CSRF lido do cookie `dona_csrf`
  (httpOnly). As cinco rotas públicas de autenticação têm handlers dedicados,
  sem sessão e sem repassar cookies.
- O cookie de sessão do backend é repassado ao navegador no login e limpo no
  logout. O frontend nunca lê o token.
- `proxy.ts` (convenção do Next 16) protege a navegação: sem cookie de sessão,
  redireciona para `/login?next=...`. A validade real é conferida pelo backend.
- O token CSRF é guardado em `dona_csrf` (httpOnly). O navegador não precisa
  (e não consegue) lê-lo. A validade do cookie acompanha a sessão: 12 h por
  padrão e 30 dias com `lembrarDeMim`; no carregamento do shell, `/api/auth/me`
  ressincroniza o cookie com `csrfMaxAgeSeconds`/`expiresAt` devolvidos pelo
  backend, limitado ao tempo restante da sessão e sem renovar a sessão. Logout
  e troca de senha limpam o cookie.
- O login mantém a opção “Lembrar de mim” desmarcada e alerta que ela só deve
  ser usada em dispositivo pessoal.

## Contrato consumido

Envelope: `{ success: true, data }` ou `{ success: false, error }`.
IDs são numéricos. Decimais chegam como string (Prisma).

| Tela | Endpoints |
| --- | --- |
| Entrar | `POST /api/auth/login`, `GET /api/auth/session` |
| Alterar senha | `POST /api/auth/password` |
| Criar conta | `POST /api/auth/register` |
| Verificar e-mail | `POST /api/auth/verify-email`, `POST /api/auth/resend-verification` |
| Esqueci a senha | `POST /api/auth/forgot-password` |
| Redefinir senha | `POST /api/auth/reset-password` |
| Painel | `GET /api/produtos?ativo=true`, `GET /api/estoque/movimentacoes?de=YYYY-MM-DD`, `GET /api/vendas?limit=4`, `GET /api/vendas?statusPagamento=PAGO|A_PRAZO&limit=1` |
| Produtos | `GET /api/produtos`, `GET /api/categorias` |
| Produto (detalhe) | `GET /api/produtos/:id`, `GET /api/estoque/movimentacoes?produtoId=:id`, `PATCH /api/produtos/:id` (inativar/reativar) |
| Novo/editar produto | `POST /api/produtos`, `PATCH /api/produtos/:id` |
| Categorias | `GET/POST /api/categorias`, `PATCH /api/categorias/:id`, `DELETE /api/categorias/:id` |
| Movimentos | `GET /api/estoque/movimentacoes` (filtros `produtoId`, `tipo`, `de`, `ate`), `POST /api/estoque/movimentacoes` |
| Ajustes | `GET /api/estoque/ajustes` (filtros `produtoId`, `de`, `ate`), `POST /api/estoque/ajustes` |
| Clientes | `GET /api/clientes?q=&ativo=`, `GET /api/clientes/:id`, `POST /api/clientes`, `PATCH /api/clientes/:id` (inclui `ativo`) |
| Vendas | `GET /api/vendas?statusPagamento=&de=&ate=&page=&limit=`, `GET /api/vendas/:id`, `POST /api/vendas` |

Decisões de interface alinhadas ao contrato atual:

- O cadastro envia exatamente `nome`, `nomeEmpresa`, `email` e `senha`; não há
  campo de perfil, tenant, `nomeUsuario` ou confirmação de senha no payload. A
  confirmação é apenas validação local. Resposta e próxima tela são genéricas
  para não revelar se a conta já existia.
- A validação local acompanha o backend: `nome` de 2 a 150 caracteres,
  `nomeEmpresa` de 2 a 150 caracteres e `email` com até 254 caracteres, sem
  pontos inicial/final/consecutivos na parte local ou no domínio. O payload
  continua com os mesmos quatro campos.
- OTP tem exatamente 6 dígitos, validade de 10 minutos, até 5 tentativas e
  reenvio após 60 segundos; o limite de 5 envios por hora é aplicado pelo
  backend. Cadastro duplicado, reenvio e recuperação respondem de forma
  genérica inclusive em cooldown/limite; a interface mantém cooldown visual de
  60 segundos e não confirma que um envio ocorreu.
- Cadastro, verificação e redefinição não autenticam automaticamente. A senha
  tem no mínimo 8 caracteres Unicode e no máximo 72 bytes UTF-8. A lista comum
  combinada com o Cedro é comparada de forma case-insensitive, exata e sem
  trim: `12345678`, `123456789`, `1234567890`, `password`, `password1`,
  `qwerty123`, `letmein`, `welcome1`, `iloveyou`, `admin123`, `senha123` e
  `abc12345`. A mesma regra vale em cadastro, redefinição e troca autenticada;
  o login legado não aplica a regra nova. O backend continua sendo a autoridade
  final.
- Nenhum OTP ou senha é colocado em URL, query, log ou mensagem de erro. As
  rotas públicas de autenticação usam handlers dedicados, sem sessão e sem
  repassar cookies; as demais rotas `/api/*` continuam exigindo sessão e CSRF.
- Edição de produto usa `PATCH` (parcial). O saldo nunca é editável; só muda
  por movimentação ou ajuste.
- `quantidadeEstoque` só é enviada na criação (saldo inicial).
- Preço de venda menor que o custo é bloqueado no cliente e também exibido
  como erro quando o backend responde 422.
- “Excluir” produto/categoria é **inativação lógica** (sem apagar histórico).
- O campo “Fornecedor” não aparece: o backend não possui módulo/tabela de
  fornecedores.
- Não há paginação de produtos, exportação, estorno, idempotência ou histórico
  dedicado por produto no backend; a interface não inventa essas funções.
- A lista de vendas é paginada (20 por página) e filtra por `statusPagamento`,
  `de` e `ate`; `total` é a contagem real retornada pelo backend.
- Em Clientes, a busca (`q`) e o filtro `ativo` são resolvidos pelo backend; a
  lista exibe no máximo 100 registros e avisa quando o limite é atingido.
- O WhatsApp é enviado como digitado (com ou sem máscara) e o backend devolve
  o formato E.164 `+55...`; a interface não cria uma normalização paralela.
- Em Vendas, o formulário envia somente `produtoId` e `quantidade`. Preço,
  subtotal, total e desconto nunca são enviados: o backend captura o
  `precoVenda` atual e calcula tudo com `Decimal`.
- A prévia de total no formulário é apenas informativa; o total oficial é o
  retornado pela API e exibido no detalhe.
- Uma venda paga não envia `vencimento`; uma venda a prazo exige vencimento
  igual ou posterior à `dataPedido`.
- Não há PATCH, cancelamento, exclusão, estorno, pagamento parcial nem baixa
  financeira de venda. O status `PAGO` é declarado e não comprova caixa.
- O painel não inventa agregados: mostra contagem total, pagas e a prazo
  obtidas de `GET /api/vendas`, além das vendas recentes. Não há endpoint de
  resumo financeiro nem soma monetária global.
- Diferença zero em ajuste é permitida (o backend registra para auditoria e
  mantém o saldo); a interface avisa isso explicitamente.

## Perfis e permissões na interface

A interface esconde ações que o backend rejeitaria. O backend continua sendo
a autoridade final.

| Perfil | Produtos/Categorias | Movimentos | Ajustes | Clientes | Vendas |
| --- | --- | --- | --- | --- | --- |
| `ADMINISTRADOR` | criar/editar/inativar | entrada e saída | ver e criar | ver, criar, editar e inativar | ver e criar |
| `GESTOR` | criar/editar/inativar | entrada e saída | sem acesso | ver, criar, editar e inativar | ver e criar |
| `ESTOQUISTA` | somente leitura | entrada e saída | ver e criar | sem tela; seleção `id`/`nome` na venda | ver e criar |
| `VENDEDOR` | somente leitura (sem custo) | **somente saída** | sem acesso | ver | ver e criar |
| `FINANCEIRO` | somente leitura | somente leitura | sem acesso | sem acesso | ver |

Nota de contrato: `POST /api/vendas` aceita `ESTOQUISTA`. Após a liberação
coordenada, `GET /api/clientes` retorna para esse perfil somente clientes ativos
com `id`/`nome`, com busca por nome e sem contatos, detalhe ou escrita. O
formulário de venda usa exatamente essa forma reduzida e não presume WhatsApp,
Instagram ou outros campos.

## Rotas

| Rota | Descrição |
| --- | --- |
| `/login` | Entrada por e-mail (ou usuário legado) + senha, com opção “lembrar de mim” |
| `/cadastro` | Cadastro público do negócio e do acesso de administração |
| `/verificar-email` | Verificação do e-mail por OTP e reenvio do código |
| `/esqueci-senha` | Solicitação genérica de recuperação por e-mail |
| `/redefinir-senha` | Redefinição da senha com OTP de 6 dígitos |
| `/` | Painel com vendas reais, KPIs de estoque, reposição e movimentos do dia |
| `/produtos` | Lista com busca, filtros e status de estoque |
| `/produtos/novo` | Cadastro (gestão/administração) |
| `/produtos/[id]` | Detalhe, preços, histórico e ações |
| `/produtos/[id]/editar` | Edição (gestão/administração) |
| `/categorias` | Lista, criação, renomeação e ativação/inativação |
| `/movimentos` | Histórico com filtros por produto, tipo e período |
| `/movimentos/novo` | Entrada ou saída |
| `/ajustes` | Histórico de ajustes (administração/estoquista) |
| `/ajustes/novo` | Contagem e diferença (administração/estoquista) |
| `/mais` | Atalhos para Categorias, Movimentos, Ajustes e Alterar senha |
| `/mais/senha` | Troca de senha autenticada, com revogação das outras sessões |
| `/clientes` | Lista real com busca, filtro de situação e atalho de edição |
| `/clientes/novo` | Cadastro real (administração/gestão) |
| `/clientes/[id]/editar` | Edição e ativação/inativação (administração/gestão) |
| `/vendas` | Histórico paginado com filtros de pagamento e período |
| `/vendas/nova` | Venda real com múltiplos itens e total calculado no servidor |
| `/vendas/[id]` | Detalhe, itens, pagamento, observações e baixa de estoque |

## Design

Referências visuais: `WhatsApp Image 2026-11-10 at 13.30.23 (2).jpeg`
(painel) e `...13.30.28.jpeg` (nova venda), além de
`docs/referencias-mobile.md`.

Tokens em `app/globals.css`:

| Token | Valor |
| --- | --- |
| `navy` | `#10235c` |
| `plum` | `#9c1155` |
| `pink` | `#e5176e` |
| `pink-50` | `#fdeaf3` |
| `line` | `#ddd6e6` |

- Layout mobile-first, largura máxima de 672 px no desktop.
- Cabeçalho fixo com marca, ajuda e sair; navegação inferior com cinco slots:
  **Início, Produtos, Vendas, Clientes e Mais**. “Mais” reúne Categorias,
  Movimentos e Ajustes, preservando o padrão mobile da referência e o acesso
  aos módulos de estoque.
- Formulários com label visível, foco evidente, `aria-invalid`,
  `aria-describedby` e mensagens de erro em português.
- Estados de carregamento (`loading.tsx`), erro (`error.tsx` e `ErrorState`)
  e vazio em todas as listas.

## Test IDs estáveis

Solicitados pela Íris para os testes de integração:

| Test ID | Elemento |
| --- | --- |
| `login-email` | Campo usuário/e-mail |
| `login-password` | Campo senha |
| `login-password-toggle` | Botão mostrar/ocultar senha do login |
| `login-remember` | Checkbox “Lembrar de mim” (desmarcado por padrão) |
| `login-submit` | Botão entrar |
| `login-forgot` | Link “Esqueci minha senha” |
| `login-register` | Link “Criar conta” |
| `login-verify-email` | Link para reenviar verificação de e-mail |
| `cadastro-nome` | Campo nome |
| `cadastro-empresa` | Campo nome da empresa |
| `cadastro-email` | Campo e-mail |
| `cadastro-senha` | Campo senha |
| `cadastro-senha-toggle` | Botão mostrar/ocultar senha do cadastro |
| `cadastro-confirmar-senha` | Campo confirmação de senha |
| `cadastro-confirmar-senha-toggle` | Botão mostrar/ocultar confirmação de senha |
| `cadastro-submit` | Botão criar conta |
| `cadastro-login-link` | Link para o login a partir do cadastro |
| `verificar-email` | Campo e-mail na verificação |
| `verificar-codigo` | Campo OTP de 6 dígitos |
| `verificar-submit` | Botão verificar e-mail |
| `verificar-reenviar` | Botão reenviar código |
| `verificar-ir-login` | Botão “Ir para o login” após verificação |
| `verificar-login-link` | Link para o login no rodapé da verificação |
| `esqueci-email` | Campo e-mail da recuperação |
| `esqueci-submit` | Botão solicitar recuperação |
| `esqueci-redefinir-link` | Link para a tela de redefinição |
| `esqueci-login-link` | Link para o login no rodapé da recuperação |
| `redefinir-email` | Campo e-mail da redefinição |
| `redefinir-codigo` | Campo OTP da redefinição |
| `redefinir-senha` | Campo nova senha |
| `redefinir-senha-toggle` | Botão mostrar/ocultar nova senha |
| `redefinir-confirmar-senha` | Campo confirmação da nova senha |
| `redefinir-confirmar-senha-toggle` | Botão mostrar/ocultar confirmação |
| `redefinir-submit` | Botão redefinir senha |
| `redefinir-ir-login` | Botão “Ir para o login” após redefinição |
| `redefinir-login-link` | Link para o login no rodapé da redefinição |
| `redefinir-novo-codigo` | Link para solicitar outro código |
| `mais-senha` | Link “Alterar senha” na tela Mais |
| `senha-atual` | Campo senha atual |
| `senha-nova` | Campo nova senha |
| `senha-confirmar` | Campo confirmação da nova senha |
| `senha-submit` | Botão alterar senha |
| `senha-ir-login` | Botão “Ir para o login” após troca de senha |
| `produto-nome` | Campo nome do produto |
| `produto-categoria` | Select de categoria |
| `produto-salvar` | Botão salvar produto |
| `movimento-quantidade` | Campo quantidade |
| `ajuste-contada` | Campo quantidade contada |
| `cliente-nome` | Campo nome do cliente |
| `cliente-whatsapp` | Campo WhatsApp |
| `cliente-instagram` | Campo Instagram |
| `cliente-ativo` | Checkbox de cliente ativo (edição) |
| `cliente-salvar` | Botão salvar cliente |
| `venda-cliente` | Select de cliente na nova venda |
| `venda-data` | Data do pedido |
| `venda-pago-sim` | Opção pago = sim |
| `venda-pago-nao` | Opção pago = não |
| `venda-vencimento` | Vencimento condicional |
| `venda-observacoes` | Observações |
| `venda-add-item` | Adicionar item |
| `venda-item-produto-0` | Produto do primeiro item |
| `venda-item-quantidade-0` | Quantidade do primeiro item |
| `venda-salvar` | Confirmar venda |
| `nav-sair` | Botão sair no cabeçalho |

Extras: `clientes-busca`, `clientes-filtrar`, `vendas-filtrar`,
`vendas-filtro-status`, `vendas-filtro-de`, `vendas-filtro-ate`,
`venda-remover-item-0`, `categoria-nome`, `categoria-salvar`,
`movimento-produto`, `movimento-tipo-entrada`, `movimento-tipo-saida`,
`movimento-salvar`, `ajuste-produto`, `ajuste-motivo`, `ajuste-salvar`,
`produto-status`, `nav-vendas`, `nav-clientes`, `nav-mais`, `mais-categorias`,
`mais-movimentos`, `mais-ajustes`.

## Cabeçalhos de segurança

Aplicados em `next.config.ts` para todas as respostas (`/:path*`), incluindo
páginas, rotas `/api` e assets:

| Cabeçalho | Valor | Finalidade |
| --- | --- | --- |
| `Content-Security-Policy` | política abaixo | Restringe origens de scripts, estilos, imagens, fontes e conexões; bloqueia frames e plugins. |
| `X-Content-Type-Options` | `nosniff` | Impede que o navegador “adivinhe” um tipo MIME diferente do declarado. |
| `X-Frame-Options` | `DENY` | Impede incorporar o frontend em iframes (defesa em profundidade com `frame-ancestors`). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Não envia caminho/query para outras origens. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | Desabilita APIs sensíveis que o sistema não usa. |
| `Strict-Transport-Security` | `max-age=31536000` | Opcional, somente quando `ENABLE_HSTS=true` em produção HTTPS. |

Política CSP:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
media-src 'self';
worker-src 'self' blob:;
manifest-src 'self'
```

Decisões e justificativas:

- **`'unsafe-inline'` em scripts e estilos**: o App Router injeta scripts
  inline de bootstrap/hidratação e o React usa atributos `style` inline. Uma
  CSP estrita por nonce exigiria middleware gerando nonce por requisição e
  revisão do fluxo de renderização; fica registrada como evolução futura.
- **Sem origens externas**: fontes são self-hosted via `next/font`, o CSS é
  compilado localmente e não há CDN, analytics ou iframes.
- **`connect-src 'self'`**: o navegador só chama `/api` na própria origem; o
  frontend fala com o backend pelo servidor Next.
- **`data:` e `blob:` em imagens/workers**: compatibilidade com ícones e
  recursos internos do Next; não abre a política para origens remotas.
- **Desenvolvimento**: `script-src` inclui `'unsafe-eval'` e `connect-src`
  inclui `ws:`/`wss:` por causa do HMR/Turbopack. Isso não vale no build de
  produção.
- **HSTS é opt-in**: `next start` local roda em HTTP e o header só faz sentido
  atrás de TLS. Habilite `ENABLE_HSTS=true` apenas no ambiente publicado com
  HTTPS; caso contrário o navegador pode passar a forçar HTTPS.

Verificação rápida:

```bash
curl -sI http://localhost:3001/login | Select-String -Pattern "content-security|x-content|x-frame|referrer|permissions"
```

Reteste independente da Íris (rodada 3): **INT-18 corrigido e verificado**.
Headers presentes em página, assets e API via proxy; CSP de produção sem
`unsafe-eval` e sem violações no console do Edge; login, navegação,
formulários e chamadas `/api` permaneceram funcionando.

## Verificação

```bash
npm run build   # type-check + build de produção
npm run lint
```

O build de produção e o lint foram executados com sucesso após a integração de
Clientes/Vendas e das telas públicas de autenticação (Next 16, rotas dinâmicas
e proxy reconhecidos). O reteste independente anterior, antes destes módulos,
permanece registrado:

| Frente | Resultado |
| --- | --- |
| HTTP/proxy (FHTTP) | **16/16** — headers em páginas, assets CSS/JS e API; CSP presente; HSTS desligado localmente |
| Playwright/Edge (INT) | **18/18** — login, logout, navegação, CRUD de produto, movimentos, ajuste, perfis, mobile 390×844 e CSP sem violações no console |
| INT-18 (headers) | **Corrigido e verificado** |
| INT-14 (erro 500 real) | **Parcial** — 500 real não foi induzido para preservar o backend compartilhado; apenas o 404 amigável foi validado |
| Auth público (smoke local isolado) | **5/5 páginas 200** (`/login`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`); raiz sem sessão **307**; POSTs públicos sem sessão retornam **502** (backend isolado desligado), não **401** |
| Auth API (stub isolado) | `register` **202** genérico; `verify-email` inválido **400** genérico; `resend-verification` **202**; `forgot-password` em cooldown **202** sem header de conta; `reset-password` **200**; nenhuma sessão criada no stub |
| Recuperação de senha por e-mail | **Frontend implementado**; endpoints, e-mail e fluxo integrado ainda dependem da confirmação/publicação do backend |

A integração nova de Clientes/Vendas e o fluxo de autenticação/multi-tenant
ainda precisam de bateria independente em ambiente isolado, coordenada com a
Íris/Cedro. Nesta rodada não houve execução concorrente, uso de banco de
desenvolvimento ou envio de e-mail real.

## Limitações conhecidas

- Sem tela de gestão de usuários; o cadastro público cria o negócio e o acesso
  de administração, mas a integração real depende do backend.
- A troca de senha autenticada está em `/mais/senha` e usa
  `POST /api/auth/password`; o backend ainda precisa confirmar a mesma regra de
  senha e a revogação de sessões no ambiente integrado.
- A recuperação por OTP está implementada no frontend, mas ainda não foi
  validada contra o backend real. Testes de e-mail devem usar o harness
  isolado/Ethereal; o Resend live não é usado nesta etapa.
- Nenhum OTP, senha ou hash é exibido, colocado em URL ou registrado em log.
- O teste de recuperação após erro 500 real não foi induzido (INT-14 parcial);
  os estados de erro são cobertos por renderização, mas falta esse cenário
  integrado.
- Sem paginação em produtos/categorias/movimentos/ajustes (o backend não
  oferece). A lista de vendas é paginada.
- O backend pode omitir `precoCusto` para `VENDEDOR`; a interface trata o
  campo como opcional.
- Dependência de o backend ter usuários cadastrados e migrações aplicadas.
- O cadastro de cliente não tem CPF/CNPJ nem e-mail; o contrato congelado
  manteve apenas nome, WhatsApp e Instagram.
- Não existe endpoint de resumo do painel. As contagens de vendas vêm da
  propriedade `total` da lista paginada; não há soma monetária global nem
  contagem de clientes sem o limite de 100.
- `ESTOQUISTA` pode criar venda e recebe, para seleção no formulário, somente
  clientes ativos com `id`/`nome`; não há tela de clientes, contatos nem
  escrita para esse perfil. A bateria histórica foi executada; não houve
  reteste desta etapa.
- Não há alteração, cancelamento, exclusão, estorno, pagamento parcial,
  contas a receber ou baixa financeira de venda.
- Não há idempotência no POST de venda: reenvio pode duplicar a venda se o
  estoque permitir. A interface desabilita o botão durante o envio, mas isso
  não substitui uma chave de idempotência.
- A navegação usa 5 slots (Início, Produtos, Vendas, Clientes, Mais);
  Categorias, Movimentos e Ajustes ficam em “Mais”. A página “Mais” não inclui
  Financeiro porque o módulo ainda não existe.
- A CSP usa `'unsafe-inline'` em scripts/estilos por compatibilidade com o
  bootstrap inline do Next; uma política por nonce fica como evolução.
- HSTS exige `ENABLE_HSTS=true` e publicação HTTPS; não é enviado no ambiente
  local.
