# DONA Backend

API REST de categorias, produtos, movimentos e ajustes de estoque, clientes, vendas, usuários e sessões. Stack: Next.js 16 Route Handlers, PostgreSQL e Prisma 5. Esta entrega prepara integração com frontend Next separado; não publica nem implanta nada.

## Configuração e inicialização

1. Copie `.env.example` para `.env` e configure `DATABASE_URL` com credenciais de ambiente/segredo. Não use credenciais de exemplo em produção.
2. Defina `SESSION_SECRET` e `OTP_PEPPER` com segredos aleatórios independentes de pelo menos 32 bytes. `SESSION_SECRET` é obrigatório em produção; `OTP_PEPPER` é obrigatório em todos os ambientes. `SESSION_TTL_HOURS` aceita 1–168 (padrão 12).
3. `npm ci`
4. `npx prisma migrate deploy`
5. Execute o bootstrap inicial ou o seed de desenvolvimento conforme abaixo.
6. `npm run dev` ou `npm run start`.

### Primeiro administrador e seed

Não há usuário, e-mail ou senha padrão. O seed só roda com `NODE_ENV=development` e exige `DEV_ADMIN_NAME`, `DEV_ADMIN_USERNAME`, `DEV_ADMIN_EMAIL` e `DEV_ADMIN_PASSWORD`; a senha deve ter ao menos 12 caracteres e no máximo 72 bytes. Os valores devem vir do ambiente local/gerenciador de segredos, não do repositório. `npm run db:seed` também cria dados demonstrativos de produtos/categorias; se a conta de desenvolvimento configurada já existe, atualiza a senha para o valor explicitamente passado no ambiente e revoga suas sessões.

Para inicializar uma instalação vazia (inclusive produção), configure temporariamente `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` e rode `npm run auth:bootstrap`. O comando recusa se já existir qualquer usuário, serializa bootstraps concorrentes com advisory lock, não imprime credenciais e registra auditoria. Depois de criar o administrador, remova essas variáveis do processo. Contas futuras são criadas por um administrador em `POST /api/usuarios`.

## Autenticação e sessões

### Login e transporte

- `POST /api/auth/login` recebe `{ "identifier": "usuario-ou-email", "password": "..." }`.
- Resposta `200`: `{ success: true, data: { user: { id, nome, nomeUsuario, email, perfil }, csrfToken } }`.
- O transporte é cookie de sessão opaco, aleatório, armazenado no banco somente como SHA-256: `dona_session` em desenvolvimento e `__Host-dona_session` em produção. A resposta `Set-Cookie` define `HttpOnly`, `SameSite=Lax`, `Path=/`, expiração configurável e `Secure` em produção; não use `localStorage` para sessão.
- `GET /api/auth/session` valida usuário/sessão no banco e devolve o mesmo usuário mais `csrfToken`. O frontend guarda o CSRF somente em memória e o envia como `X-CSRF-Token` em toda operação POST/PUT/PATCH/DELETE.
- `POST /api/auth/session` encerra a sessão atual e revoga seu registro. `POST /api/auth/password` recebe `{ currentPassword, newPassword }`, exige a senha atual e revoga todas as sessões após trocar o hash.
- Todas as rotas de negócio consultam a sessão e o status atual do usuário no banco. Logout, expiração, inativação, troca de perfil e troca de senha invalidam imediatamente sessões protegidas. Inativar/rebaixar o último administrador ativo é bloqueado.
- Senhas são armazenadas com bcrypt cost 12. Login retorna erro genérico para usuário/senha inválidos e aplica lockout persistido no PostgreSQL: 10 falhas por identificador normalizado em uma janela de 1 minuto bloqueiam novas tentativas por 1 minuto. O lockout é compartilhado entre instâncias. Cadastro público e recuperação de senha usam OTP por e-mail; políticas e configuração estão em [docs/multi-tenancy-auth.md](docs/multi-tenancy-auth.md).
- Nenhuma API habilita CORS aberto. Configure o frontend para usar o proxy same-origin abaixo.

## Perfis e autorização

Nomes exatos do enum `PerfilUsuario`: `ADMINISTRADOR`, `GESTOR`, `ESTOQUISTA`, `VENDEDOR`, `FINANCEIRO`. Todas as permissões são verificadas nos Route Handlers, nunca dependem da UI.

| Operação | Administrador | Gestor | Estoquista | Vendedor | Financeiro |
|---|---:|---:|---:|---:|---:|
| Consultar categorias/produtos/baixo estoque | Sim | Sim | Sim | Sim | Sim |
| Criar/editar/inativar categoria e produto | Sim | Sim | Não | Não | Não |
| Consultar movimentos | Sim | Sim | Sim | Sim | Sim |
| Criar movimento | Sim | Sim | Sim | Só saída | Não |
| Consultar ajustes | Sim | Sim | Sim | Não | Não |
| Criar ajuste | Sim | Não | Sim | Não | Não |
| Listar/criar/inativar usuários | Sim | Não | Não | Não | Não |

Esta é uma matriz provisória de menor privilégio enquanto a hierarquia de administradores subordinados e a matriz final dos requisitos de usuários não forem aprovadas. `precoCusto` é omitido das respostas de produto para vendedor. `POST /api/usuarios` cria contas no tenant atual sem e-mail verificado; o primeiro login exige a verificação OTP. `PATCH /api/usuarios/:id` altera nome, nomeUsuario, e-mail, perfil ou ativo, sem exclusão física. Um administrador não pode alterar o próprio perfil/status.

## Integração com frontend Next separado

Copie `docs/next-proxy.example.ts` para o `next.config.ts` do frontend e configure `DONA_BACKEND_URL` somente no ambiente do servidor (por exemplo `https://api.example.com`). O rewrite expõe `/api/backend/:path*` no mesmo host do frontend e encaminha para o backend `/api/:path*`; produção exige HTTPS e rejeita URL com credenciais. Assim o browser não precisa de CORS e o cookie HttpOnly permanece same-origin.

Fluxo: `POST /api/backend/auth/login` → guardar `csrfToken` em estado de memória; `GET /api/backend/auth/session` após reload → recuperar CSRF; chamadas a `/api/backend/categorias`, `/api/backend/produtos`, `/api/backend/estoque/movimentacoes`, `/api/backend/estoque/ajustes` com `credentials: "same-origin"`; toda escrita inclui `X-CSRF-Token`. Logout: `POST /api/backend/auth/session` com CSRF. Não expor `DONA_BACKEND_URL`, `DATABASE_URL` ou `SESSION_SECRET` em variáveis `NEXT_PUBLIC_*`.

## Rotas

Todos os sucessos têm `{ success: true, data }`; erros têm `{ success: false, error }`. Cadastro, OTP e recuperação de senha são rotas públicas; as rotas comerciais exigem sessão. `/api/auth/session` e `/api/auth/password` exigem sessão.

| Método e caminho | Permissão |
|---|---|
| `POST /api/auth/login` | Público |
| `POST /api/auth/register` | Público; cria tenant e administrador inicial sem sessão |
| `POST /api/auth/verify-email` | Público; consome OTP sem autenticar automaticamente |
| `POST /api/auth/resend-verification` | Público; resposta genérica |
| `POST /api/auth/forgot-password` | Público; resposta genérica |
| `POST /api/auth/reset-password` | Público; consome OTP e revoga sessões |
| `GET/POST /api/auth/session` | Qualquer usuário autenticado; GET consulta/POST encerra |
| `POST /api/auth/password` | Qualquer usuário autenticado + CSRF |
| `GET/POST /api/usuarios` | Administrador; GET lista sem hashes e POST cria conta no tenant atual, com verificação OTP antes do login |
| `PATCH /api/usuarios/:id` | Administrador; atualização lógica e revogação de sessões quando muda perfil/status |
| `/api/clientes` e `/api/clientes/:id` | GET administrador/gestor/vendedor; estoquista só lista clientes ativos com id/nome; POST/PATCH administrador/gestor; inativação lógica |
| `/api/vendas` e `/api/vendas/:id` | GET todos os perfis; POST administrador/gestor/estoquista/vendedor; sem PUT/PATCH/DELETE |
| `/api/categorias` e `/api/categorias/:id` | GET qualquer perfil; escritas administrador/gestor |
| `/api/produtos`, `/api/produtos/:id`, `/api/produtos/estoque-baixo` | GET qualquer perfil; escritas administrador/gestor |
| `/api/estoque/movimentacoes` | GET administrador/gestor/estoquista/vendedor/financeiro; POST também, vendedor somente saída |
| `/api/estoque/ajustes` | GET administrador/gestor/estoquista; POST administrador/estoquista |

Estoque não pode ficar negativo; movimento exige quantidade positiva; estoque mínimo e saldo inicial aceitam zero ou valores válidos dentro da precisão decimal. Fornecedor permanece opcional sem FK até existir o módulo. Venda abaixo do custo é bloqueada. Produto pode ser inativado com histórico preservado. Ajuste sem diferença continua registrando evento, conforme decisão provisória.

Detalhes dos payloads, decimais, filtros, permissões, datas e limitações de clientes/vendas estão em [docs/clientes-vendas.md](docs/clientes-vendas.md). Vendas usam preço atual do produto, capturam snapshots e baixam estoque e movimentos na mesma transação; status `PAGO` não representa baixa financeira. `/api/painel/resumo` ainda não está implementado.

## Migração e preservação de dados

`prisma/migrations/20261110180000_auth_and_casefold` adiciona usuários, sessões, auditoria e lockout. Também cria unicidade de categoria por `lower(trim(nome))`. Antes do índice, duplicatas legadas que só diferem por caixa/espaços são mantidas como linhas: a primeira pelo ID preserva o nome; cada linha posterior recebe sufixo determinístico `[legado ID]`. `categorias_nomes_legacy` registra nome original e novo, sem excluir categoria, produto ou histórico. Revise esse relatório de nomes após aplicar a migração em cada ambiente.

## Cadastro público, OTP e isolamento por negócio

O contrato R5, respostas genéricas, política de códigos, configuração de email, tabelas tenant, seed/bootstrap e procedimento explícito para dados legados estão em [docs/multi-tenancy-auth.md](docs/multi-tenancy-auth.md). A migração `20261112100000_tenants_email_otp` coloca dados preexistentes em quarentena e revoga sessões; não atribui dados a uma pessoa automaticamente. Não aplique essa migração em bancos existentes sem validar o plano descrito no documento.

## Verificações e limitações

Na validação R5, API passou 87/87 casos, 40 checagens SQL tiveram zero violações e OTP unitário passou 4/4. Fluxo mobile Edge em 390x844 passou 11/11 passos com SMTP sink local em memória e zero overflow; isso valida a UI e os endpoints OTP, não o serviço Ethereal externo. A rede local bloqueou SMTP/IMAP Ethereal. Com timeout SMTP limitado, cadastro direto e pelo proxy retornaram 202 em 7,7s e 5,6s mesmo sem SMTP acessível, evitando 502. Resend real não foi usado nem validado. Os scripts smoke antigos `test:auth:smoke` e `test:sales:smoke` continuam restritos a `dona_test_r3` e `dona_test_r4`; não os redirecione. O runner R5 deve usar somente `localhost:5433/dona_test_r5`. Permanecem como limitações: limite global por IP sem proxy confiável, retry automático de e-mail e MFA. Dados legados ficam em quarentena até que seu titular confirme a reivindicação explicitamente. A aplicação não foi publicada.
