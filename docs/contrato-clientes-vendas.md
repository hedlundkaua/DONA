# Clientes e Vendas — contrato integrado no frontend

**Status:** implementado e compilando. As listas, formulários e detalhes usam
somente a API real; não há mocks, dados fictícios ou endpoints presumidos.
**Data:** 10/11/2026
**Responsável:** Luma (frontend)
**Contrato de referência do backend:** `backend/docs/clientes-vendas.md`
**Fontes visuais:** `WhatsApp Image 2026-11-10 at 13.30.23 (2).jpeg` (painel),
`...13.30.28.jpeg` (nova venda) e `docs/referencias-mobile.md`.

O backend informou que schema, migração e rotas de Clientes/Vendas estão
congelados nesta rodada. A integração abaixo segue esse contrato. Nenhum arquivo
do backend ou banco foi alterado pelo frontend.

## 1. Envelope e convenções

- Prefixo: `/api`.
- Sucesso: `{ success: true, data }`; erro: `{ success: false, error }`.
- IDs são numéricos.
- `Decimal` é serializado como string com duas casas (ex.: `"180.00"`).
- Datas comerciais são `DATE`; a API pode devolver `YYYY-MM-DD` ou
  `YYYY-MM-DDT00:00:00.000Z`. O frontend formata em UTC para não deslocar o dia.
- Mutações exigem sessão e `X-CSRF-Token`; o proxy do frontend cuida do cookie
  e do header.

## 2. Clientes

### Rotas e permissões

| Método | Rota | Perfis |
| --- | --- | --- |
| `GET` | `/api/clientes?ativo=true\|false&q=termo` | ADMINISTRADOR, GESTOR, VENDEDOR |
| `POST` | `/api/clientes` | ADMINISTRADOR, GESTOR |
| `GET` | `/api/clientes/:id` | ADMINISTRADOR, GESTOR, VENDEDOR |
| `PATCH` | `/api/clientes/:id` | ADMINISTRADOR, GESTOR |

Não há `DELETE`. Inativar é uma atualização lógica (`ativo: false`) e preserva o
histórico de vendas.

### Dados

```json
{
  "nome": "Maria Souza",
  "whatsapp": "(51) 99999-9999",
  "instagram": "@mariasouza"
}
```

- `nome`: obrigatório, 2–150 caracteres.
- `whatsapp`: obrigatório; o backend aceita máscara/DDD e normaliza para E.164
  brasileiro (`+55...`). A interface envia o texto digitado e exibe o retorno
  canônico; não duplica a normalização.
- `instagram`: opcional, até 30 caracteres de usuário; o backend remove `@`.
- `ativo`: booleano, editável via `PATCH`; usado para impedir novas vendas.
- Não há CPF/CNPJ nem e-mail no modelo congelado.
- WhatsApp duplicado é permitido; a regra de unicidade segue pendente no
  backend.
- `GET` retorna até 100 registros, ordenados por nome/ID, e busca em nome e
  WhatsApp. A interface avisa quando o limite de 100 é atingido.

### Telas

- `/clientes`: lista com busca (`q`), filtro de situação (`ativo`) resolvidos
  no servidor, cards com nome, WhatsApp formatado, Instagram e status. O botão
  de edição só aparece para ADMINISTRADOR/GESTOR. VENDEDOR tem leitura.
- `/clientes/novo`: formulário com nome, WhatsApp e Instagram; validação local
  e mensagens do backend; retorna à lista após criar.
- `/clientes/[id]/editar`: carrega o cliente real, permite editar contato,
  ativar/desativar e salvar via `PATCH`. Acesso restrito a
  ADMINISTRADOR/GESTOR.

## 3. Vendas

### Rotas e permissões

| Método | Rota | Perfis |
| --- | --- | --- |
| `GET` | `/api/vendas?clienteId=&statusPagamento=PAGO\|A_PRAZO&de=YYYY-MM-DD&ate=YYYY-MM-DD&page=1&limit=50` | Todos os perfis autenticados |
| `GET` | `/api/vendas/:id` | Todos os perfis autenticados |
| `POST` | `/api/vendas` | ADMINISTRADOR, GESTOR, ESTOQUISTA, VENDEDOR |

A lista retorna `{ items, page, limit, total }`; `limit` máximo é 100. O
frontend usa 20 por página. `de`/`ate` filtram `dataPedido`, incluindo o dia
final. Não há `PATCH`, `DELETE`, cancelamento, estorno ou mudança de status.

### Payload de criação

```json
{
  "clienteId": 18,
  "statusPagamento": "A_PRAZO",
  "dataPedido": "2026-11-10",
  "vencimento": "2026-12-10",
  "observacoes": "Entregar na feira de sábado",
  "itens": [
    { "produtoId": 42, "quantidade": 2 },
    { "produtoId": 43, "quantidade": 1 }
  ]
}
```

- `statusPagamento`: `PAGO` ou `A_PRAZO`.
- `PAGO`: `vencimento` deve ser omitido.
- `A_PRAZO`: `vencimento` é obrigatório e não pode ser anterior a `dataPedido`.
- `dataPedido` é opcional no backend; a interface sempre envia a data do campo
  (inicialmente o dia atual de São Paulo).
- `itens`: 1–100 itens; `quantidade` é inteiro `>= 1`; cada produto aparece uma
  única vez. O frontend impede duplicidade e quantidade acima do saldo.
- **Preço não é enviado pelo cliente.** O backend captura o `precoVenda` atual
  do produto, grava o snapshot em `valorUnitario` e calcula `subtotal`/`total`
  com `Prisma.Decimal`. `preco`, `valorUnitario`, `subtotal`, `total` e
  `desconto` enviados são rejeitados. Não há desconto/override nesta versão.
- Cliente, produto e categoria precisam estar ativos. Venda abaixo do custo é
  bloqueada. A baixa de estoque acontece em uma transação única; saldo
  insuficiente retorna 422 e faz rollback de toda a venda.
- A venda grava `usuarioId` da sessão; cada movimento de saída grava `vendaId`,
  `produtoId`, quantidade e `operadorId`.
- `PAGO` é apenas a condição declarada. Não há baixa financeira, recebimento,
  conta a receber, pagamento parcial ou comprovação de caixa.
- Não há idempotência: reenvio do POST pode criar outra venda se houver saldo.
  A interface desabilita o botão durante o envio, mas isso não é uma garantia
  de idempotência.

### Resposta de detalhe

O detalhe inclui `cliente`, `usuario`, `itens` (com `produto`) e
`movimentacoes`, além de `total` serializado e datas. A interface usa esses
dados para exibir resumo, itens, total, observações e a baixa de estoque
gerada.

### Telas

- `/vendas`: histórico paginado (20 por página) com filtros de condição de
  pagamento e período; cards com cliente, data, total, status e vencimento;
  navegação anterior/próxima.
- `/vendas/nova`: cliente ativo, um ou mais itens (produto + quantidade), valor
  unitário e subtotal apenas informativos, total oficial do servidor, data do
  pedido, “Pago?” (Sim/Não), vencimento condicional, observações e confirmação.
  Erros de validação/estoque mantêm o formulário preenchido.
- `/vendas/[id]`: cliente, operadora, data, status, vencimento, itens,
  quantidade, valor unitário, subtotal, total, observações e movimentos de
  baixa. Sem ações de alteração, cancelamento ou exclusão.

## 4. Painel

Não existe `/api/painel/resumo`. Para não inventar números, o painel usa apenas
dados reais disponíveis:

- `GET /api/vendas?limit=4` para as vendas recentes e o total registrado;
- `GET /api/vendas?statusPagamento=PAGO&limit=1` para a contagem paga;
- `GET /api/vendas?statusPagamento=A_PRAZO&limit=1` para a contagem a prazo;
- produtos e movimentos de estoque como antes.

Os cards mostram contagens, não soma monetária global. Se as vendas não
carregarem, o painel mantém o estoque e exibe um aviso; nenhum KPI é
preenchido com valor fictício.

## 5. Navegação

Decisão mantida: **5 slots — Início, Produtos, Vendas, Clientes e Mais**.
“Mais” contém Categorias, Movimentos e Ajustes; Financeiro entra quando o
módulo existir. Rotas de Clientes/Vendas aparecem na navegação principal sem
quebrar os atalhos de estoque.

## 6. Permissões e perfil ESTOQUISTA

| Perfil | Clientes | Vendas |
| --- | --- | --- |
| ADMINISTRADOR | ver/criar/editar/inativar | ver/criar |
| GESTOR | ver/criar/editar/inativar | ver/criar |
| ESTOQUISTA | sem tela; seleção `id`/`nome` na venda | ver/criar |
| VENDEDOR | ver | ver/criar |
| FINANCEIRO | sem acesso | ver |

**Reconciliação de perfil:** o ajuste coordenado libera para `ESTOQUISTA` a
criação de venda e uma coleção reduzida de clientes ativos com somente
`id`/`nome`, busca por nome e sem contatos, detalhe ou escrita. A interface usa
`ClienteSelecao` no formulário de venda, incluindo `ESTOQUISTA` em
`podeCriarVenda`; não há tela de clientes nem exposição de WhatsApp/Instagram
para esse perfil. O teste integrado do perfil será coordenado com a Íris depois
da conclusão do Cedro.

## 7. Erros e estados

| Código | Tratamento no frontend |
| --- | --- |
| 400 | Mensagem do backend no formulário; não perde os campos |
| 401 | Sessão expirada; redireciona para login |
| 403 | Acesso restrito/SemPermissao ou aviso no formulário |
| 404 | Estado “não encontrado” com retorno à lista |
| 422 | Inativo, saldo insuficiente, abaixo do custo ou precisão; mensagem exibida |
| 500 | Erro amigável com opção de tentar novamente |

Estados vazios, carregamento, erro e limites de lista são tratados sem dados
fictícios.

## 8. Testes e verificação

### Já executado

- `npm run lint` — passou.
- `npm run build` — passou (Next.js 16.4.6, rotas dinâmicas reconhecidas).
- Revisão estática do contrato e dos tipos contra as rotas do backend.

### Pendente de coordenação

A bateria integrada de Clientes/Vendas deve rodar exclusivamente em
`dona_test_r4:5433`, com a Íris/Cedro coordenando a execução. Não usar
`dona_db`, `dona_frontend_e2e`, `dona_test_r3` ou banco de desenvolvimento.

Casos previstos:

- cliente: criar, buscar, editar, inativar/reativar, WhatsApp normalizado,
  Instagram com/sem `@`, duplicidade de WhatsApp, permissões e CSRF;
- venda: um e múltiplos itens, pago e a prazo, vencimento inválido, quantidade
  zero/decimal, produto duplicado, estoque insuficiente, produto/categoria/
  cliente inativo, total/preço enviados (rejeição), baixa e rollback;
- leitura: lista paginada, filtros, detalhe, venda após inativar cliente;
- interface: mobile 390×844, navegação de 5 slots, formulários, estados vazios/
  erro, CSP sem violações e ausência de dados fictícios;
- painel: contagens reais e vendas recentes;
- perfil `ESTOQUISTA`: vê somente `id`/`nome` na seleção de venda, busca por
  nome, sem contatos/detalhe/escrita, e conclui uma venda com sucesso. Executar
  após a conclusão do Cedro e em coordenação com a Íris.

Test IDs principais: `cliente-nome`, `cliente-whatsapp`,
`cliente-instagram`, `cliente-ativo`, `cliente-salvar`, `venda-cliente`,
`venda-data`, `venda-pago-sim`, `venda-pago-nao`, `venda-vencimento`,
`venda-observacoes`, `venda-add-item`, `venda-item-produto-0`,
`venda-item-quantidade-0`, `venda-salvar`, `clientes-busca`,
`vendas-filtro-status`, `vendas-filtro-de`, `vendas-filtro-ate`.

## 9. Pendências do contrato (não implementadas no frontend)

- Unicidade de WhatsApp (bloqueio versus aviso).
- CPF/CNPJ/e-mail do cliente.
- Desconto/preço manual e política de arredondamento.
- Fuso/política de data comercial e vendas retroativas/futuras.
- Idempotência do POST de venda.
- Alteração/cancelamento/estorno e histórico de status.
- Conta a receber, baixa financeira e recebimento.
- Endpoint de resumo do painel.
- Teste integrado do perfil `ESTOQUISTA` após a conclusão do Cedro, com
  coordenação da Íris.

Nenhuma dessas pendências foi simulada ou inventada na interface.
