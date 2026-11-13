# Contrato de clientes e vendas (provisório)

Prefixo `/api`; respostas seguem `{ success: true, data }` e erros `{ success: false, error }`. Mutação requer cookie de sessão e `X-CSRF-Token`. Valores `Decimal` são serializados como strings decimais; datas `DATE` são representadas por `YYYY-MM-DD` (serialização JSON do Prisma pode expor `T00:00:00.000Z`).

## Clientes

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/clientes?ativo=true|false&q=termo` | ADMINISTRADOR, GESTOR, VENDEDOR, ESTOQUISTA (projeção reduzida) |
| POST | `/api/clientes` | ADMINISTRADOR, GESTOR |
| GET | `/api/clientes/:id` | ADMINISTRADOR, GESTOR, VENDEDOR |
| PATCH | `/api/clientes/:id` | ADMINISTRADOR, GESTOR |

GET para ADMINISTRADOR/GESTOR/VENDEDOR aceita busca por nome ou WhatsApp, retorna até 100 registros e ordena por nome/ID. Para ESTOQUISTA, a listagem força `ativo=true`, busca apenas por nome e responde somente `{ id, nome }`; `ativo=false` responde lista vazia. O estoquista não pode ler `/api/clientes/:id` nem criar/alterar clientes. POST recebe `{ nome, whatsapp, instagram? }`; nome exige 2–150 caracteres. WhatsApp brasileiro é normalizado para E.164 `+55...`, aceitando máscara, DDD e telefone móvel/fixo nacional. Instagram aceita até 30 caracteres de usuário e remove `@` inicial. PATCH aceita `nome?`, `whatsapp?`, `instagram?` (nulo/vazio remove) e `ativo?`; desativação é lógica e mantém vendas. Não há CPF nem e-mail no modelo/contrato.

Não há unicidade de WhatsApp deliberadamente: a especificação deixa bloqueio versus aviso pendente. Duplicatas são permitidas. A validação de telefone verifica formato/DDD numérico, mas não consulta portabilidade ou titularidade.

## Vendas

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/vendas?clienteId=&statusPagamento=PAGO|A_PRAZO&de=YYYY-MM-DD&ate=YYYY-MM-DD&page=1&limit=50` | Todos os perfis autenticados |
| GET | `/api/vendas/:id` | Todos os perfis autenticados |
| POST | `/api/vendas` | ADMINISTRADOR, GESTOR, ESTOQUISTA, VENDEDOR |

GET lista `{ items, page, limit, total }`; `limit` máximo 100. `de`/`ate` filtram a data comercial `dataPedido`, incluindo o dia final. As respostas de lista, detalhe e criação da venda expõem do cliente somente `id` e `nome`, sem WhatsApp ou Instagram.

POST recebe, por exemplo:

```json
{
  "clienteId": 18,
  "statusPagamento": "A_PRAZO",
  "dataPedido": "2026-11-10",
  "vencimento": "2026-12-10",
  "observacoes": "Pedido",
  "itens": [{ "produtoId": 42, "quantidade": 2 }]
}
```

`statusPagamento` é `PAGO` ou `A_PRAZO`. Venda paga omite vencimento; a prazo exige vencimento não anterior a `dataPedido`. Data comercial é opcional e, se omitida, usa o dia UTC atual. A especificação não fecha retroatividade, datas futuras ou fuso do negócio; datas válidas são aceitas como dias de calendário sem conversão de fuso. `quantidade` deve ser inteiro positivo; produto pode aparecer uma vez por venda. O servidor captura `precoVenda` atual do produto como `valorUnitario`, calcula `subtotal` e `total` com `Prisma.Decimal` exato e persiste DECIMAL(12,2). `total`, `desconto`, `valorUnitario`, preço e subtotal enviados pelo cliente são rejeitados. Desconto/preço manual não estão implementados; origem e autorização de desconto permanecem pendentes de decisão.

Produto e categoria precisam estar ativos; cliente também precisa estar ativo. Venda abaixo do custo continua bloqueada pela regra provisória existente. Não há alteração de status da venda, estorno, exclusão, pagamento parcial, baixa financeira, recebimento/caixa nem geração de conta a receber. `PAGO` é apenas o status declarado na venda, não comprova nem cria movimento financeiro.

## Consistência, rastreabilidade e erros

Uma transação única bloqueia as linhas de produto em ordem crescente, verifica atividade/saldo, decrementa estoque, grava venda, itens e movimentos de saída. Saldo insuficiente, qualquer produto inválido ou erro ao persistir qualquer parte aborta tudo. Movimento registra `vendaId`, `produtoId`, `operadorId` da sessão e quantidade; venda registra `usuarioId`; item guarda produto, nome/preço unitário capturados, quantidade e subtotal. FK e restrições impedem apagar entidades referenciadas; não há endpoint de delete de venda.

- `400`: payload, enum, data, quantidade ou campos de preço/desconto inválidos.
- `401`/`403`: sessão/CSRF/perfil inválidos.
- `404`: cliente/produto/venda inexistente.
- `422`: cliente/produto/categoria inativos, venda abaixo do custo, saldo insuficiente ou valor fora de DECIMAL(12,2).
- `500`: falha interna inesperada.

Não há chave de idempotência. Reenvio do mesmo POST pode criar outra venda se o saldo permitir; isso e a proteção contra repetição do cliente seguem pendentes.

## Migração e pendências

`20261111100000_clientes_vendas` é aditiva: cria tabelas novas vazias e uma coluna nullable `venda_id` em movimentos preexistentes. Não reescreve nem exclui dados anteriores. FKs usam `RESTRICT` para preservar o histórico. O seed de desenvolvimento já cadastra administrador e produtos/categorias demonstrativos, mas não cria clientes nem vendas; testes criam registros com nomes aleatórios na base dedicada `dona_test_r4`.

CPF/e-mail e negócio/tenant não foram adicionados (não requeridos pelo formulário atual; eventual necessidade e privacidade aguardam decisão). Endpoint `/api/painel/resumo` ainda não existe. Permanecem pendentes: unicidade WhatsApp, identidade adicional do cliente, fuso e política de data comercial, desconto/preço manual, alteração/cancelamento/estorno de vendas, conta a receber/caixa, idempotência e agregados para painel.
