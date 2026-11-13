RECONFIRMAÇÃO DE CONTRATOS — FRONTEND DONA (Produtos & Estoque)
(de Luma para Codex · pós-validação do backend · nenhuma tela implementada)

Li novamente o backend/README.md e todas as rotas atuais (categorias, categorias/[id], produtos, produtos/[id], produtos/estoque-baixo, estoque/movimentacoes, estoque/ajustes) e o docs/referencias-mobile.md. As referências visuais continuam sendo a fonte de design.

1. CONTRATO REAL CONFIRMADO
- Envelope: sucesso `{ success: true, data }`; erro `{ success: false, error: "<mensagem>" }`. Status 200/201, 400, 404, 409, 422, 500.
- IDs: `id` inteiro positivo (não existe `codigo` nem `sku`).
- Produto: `nome` único (case-sensitive), `categoriaId`, `unidadeMedida` (string, default "UNIDADE"), `precoCusto`, `precoVenda`, `quantidadeEstoque`, `estoqueMinimo`, `fornecedorId` (opcional, sem FK), `dataValidade` (opcional), `ativo` boolean, `observacoes`, `createdAt`, `updatedAt`.
- Categoria: `{ id, nome, ativo, createdAt, updatedAt, _count: { produtos } }`.
- Movimentação: enum `ENTRADA|SAIDA`, `produtoId`, `quantidade`, `operadorId` (null), `documentoOrigem`, `observacoes`, `dataHora`. Não há `motivo` nem `saldoApos`.
- Ajuste: `produtoId`, `quantidadeSistema`, `quantidadeContada`, `diferenca`, `tipoAjuste` `AUMENTO|REDUCAO`, `motivo`, `data`, `usuarioResponsavelId` (null), `observacoes`.
- Decimais serializados como string pelo Prisma (confirmado na prática): usar sem conversão para float.

2. COMPORTAMENTOS QUE MUDAM A MINHA SÍNTESE ANTERIOR
- Estoque baixo: `GET /api/produtos?estoqueBaixo=true` (consistente com o resto) ou `GET /api/produtos/estoque-baixo` (retorna `{ total, produtos }` com chaves snake_case). Vou usar o filtro do /api/produtos e pedir normalização do endpoint dedicado depois.
- `POST /api/produtos` aceita saldo inicial (`quantidadeEstoque`); `PUT`/`PATCH` rejeitam com 400 — a UI mostra "saldo inicial" apenas na criação (não é bug, é o contrato).
- `PUT` exige `nome, categoriaId, precoCusto, precoVenda, estoqueMinimo`; `PATCH` aceita parcial. Vou usar `PATCH` no formulário de edição.
- Preço de venda < custo é **rejeitado (422)** também no PATCH. O formulário precisa de erro inline, não de aviso.
- Produto ativo em categoria inativa → 422; categoria com produto ativo não pode ser inativada → 409 com contagem. UI deve desabilitar e explicar.
- `DELETE` de produto/categoria é inativação lógica e responde 200 com `{ message, ... }` (não 204).
- `PATCH` não tem `version`/`If-Match`: concorrência é last-write-wins. Vou refetch após salvar e não prometer bloqueio de edição concorrente.
- Sem autenticação: todas as rotas são públicas e `operadorId`/`usuarioResponsavelId` ficam nulos. A UI não pode exibir "operador" até existir auth; a coluna deve ficar oculta/simplificada.
- Ajuste com diferença zero: o backend registra o ajuste e mantém o saldo. A UI deve dizer "conferência registrada sem alteração de saldo" (não "nada foi registrado").
- Sem paginação, sem busca `q`, sem ordenação configurável: as listas vêm ordenadas por nome/data desc. Com o volume atual (13 empreendedoras) a busca/filtro pode ser client-side; marco como dívida técnica.
- Sem auditoria de alterações de produto (RF-05): a aba "Histórico" do produto fica em espera; o que existe é o histórico de movimentações via `GET /api/estoque/movimentacoes?produtoId=`.
- Sem estorno, idempotência, exportação, regras de estoque mínimo por produto, fornecedores e módulo financeiro/vendas.

3. O QUE ISSO MUDA NO DESIGN (sem implementar)
- Painel: só consigo montar KPIs de estoque (ativos, abaixo do mínimo, críticos, movimentações do dia). Os KPIs da referência (vendas, clientes, fiado) não têm endpoint — não vou simulá-los com dados falsos.
- Navegação inferior: manter os 5 slots visuais da referência, mas só Início/Produtos/Estoque têm rota; Vendas/Clientes/Financeiro entram como itens desabilitados ("em breve") até existirem módulos — ou reduzir para 3 itens; preciso da sua decisão.
- Histórico por produto: mostrar apenas movimentações/ajustes; sem "quem alterou" e sem antes/depois.
- Estoque mínimo: campo no produto é a única fonte (confirmado no README); não haverá tela de "regras" 1:1 na v1.
- Formulário de produto: esconder "Fornecedor" (sem módulo/FK) para não gravar IDs inválidos.
- Ajuste: card-herói com Sistema → Contada e diferença; estado explícito de diferença zero.
- As cores/tipografia/cards/botões/bottom nav da síntese permanecem válidos — o backend não altera o visual.

4. PENDÊNCIAS QUE CONTINUAM (não bloqueiam o desenho, bloqueiam a entrega final)
- CAT-03: unicidade de categoria case-insensitive.
- Ajuste com diferença zero: manter registro ou não.
- Saldo inicial no cadastro: manter ou remover (hoje permitido).
- Venda abaixo do custo: rejeitar (atual) ou alertar.
- Estoque mínimo aceita 0 no backend, mas a RN diz > 0.
- Fornecedor: obrigatório (RF) x opcional (levantamento).
- Produto com histórico: inativar livremente (atual) ou bloquear.

5. STATUS
Nada foi implementado e nenhum arquivo do projeto foi alterado por mim. Aguardo sua instrução para iniciar, e sugiro começar por tokens + shell/BottomNav + lista/formulário de Produtos, já adaptados a este contrato real.
