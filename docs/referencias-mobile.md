SÍNTESE — REFERÊNCIAS VISUAIS MOBILE (DONA) + IMPACTO NOS CONTRATOS
(de Luma / DONA Frontend para Codex)

Contexto: recebi duas referências de tela mobile na raiz do projeto (WhatsApp Image ...13.30.23 (2).jpeg = Painel; ...13.30.28.jpeg = Nova venda). Analisei ambas, extraí tokens e padrões de componente, e reconciliei com o backend já criado em /backend. Nenhum arquivo foi alterado e nenhuma tela foi implementada — a ordem combinada (validação do backend antes de codar) segue preservada.

1. O QUE AS REFERÊNCIAS ESTABELECEM
Estrutura comum às duas telas:
- Header fixo: seta "voltar" rosa à esquerda; logo circular "DONA Empreendedoras Restinga"; wordmark "DONA" (navy, bold) + "Empreendedoras Restinga" (navy, regular); ícone "?" de ajuda à direita; divisor com gradiente rosa.
- Breadcrumb em caixa alta rosa ("INÍCIO / PAINEL", "VENDAS / CADASTRO"), H1 navy grande, subtítulo cinza-azulado e uma régua rosa curta (~56x4) sob o título.
- Navegação inferior fixa com 5 itens: Início, Produtos, Vendas, Clientes, Financeiro — ícone linear + rótulo sempre visível; item ativo em "pill" rosa claro com ícone/rótulo rosa; inativos em navy. Confirma a decisão das usuárias (ícone + descrição, poucas abas).
- Fundo branco, cards claros, muito respiro; tudo em português e tom direto ("Registre uma venda de forma simples e rápida.").

Painel (referência 1):
- Card-herói rosa (gradiente claro) com 2 KPIs divididos por linha vertical: ícone em quadrado branco arredondado, rótulo navy, valor magenta grande ("Total de vendas R$ 2.450,00" / "Clientes 18").
- Dois cards brancos lado a lado, borda lilás clara: "Vendas à vista" e "Produtos vendidos".
- Card largo com ícone e 2 métricas internas: "Vendas a prazo (fiado)".
- Par de botões: primário preenchido ("+ Nova venda") e secundário outline magenta ("+ Novo cliente"), ambos pill e altos.
- Bloco "Ações rápidas" em painel rosa-acinzentado com linhas (ícone rosa + rótulo navy + chevron rosa).

Nova venda (referência 2):
- Labels navy semibold acima dos campos; inputs/selects brancos, borda lilás, raio ~10–12, altura ~48–52; chevron rosa nos selects.
- Quantidade e Valor em duas colunas; card de total rosa com ícone de sacola e valor magenta grande.
- Datas com ícone de calendário rosa dentro do campo.
- "Pago?" como controle segmentado em pílulas: "Sim" neutro, "Não" selecionado com fundo rosa claro, borda magenta e radio preenchido. Protótipo abre com "Não" e revela "Data de vencimento".
- Textarea com borda lilás; rodapé com "Salvar venda" (preenchido) e "Cancelar" (outline), lado a lado.

2. TOKENS ATUALIZADOS (amostrados do JPEG; aproximados, confirmar com design)
| Token | Valor sugerido | Uso |
|---|---|---|
| brand.navy | #10235C (amostra ~#0B1B5A) | títulos, labels, ícones inativos |
| brand.navy-900 | #071A4F | textos de maior peso |
| brand.plum | #9C1155 (amostra #981050–#A01858) | botão primário, valores-destaque |
| brand.pink | #E5176E | breadcrumb, ícones, foco, links |
| brand.pink-50 | #FDEAF3 | fundo do card-herói e pill ativa |
| brand.pink-100 | #FCE8F2 | painéis e realces |
| brand.surface | #FFFFFF | fundo e cards |
| brand.line | #DDD6E6 | bordas de input/card |
| brand.muted | #5B6070 | subtítulos e textos de apoio |
| success / warning / danger | #16A34A / #D97706 / #DC2626 | alertas de estoque |
Observação: o login usava plum #8A1C5B, pink #E93F78 e navy #2D3748. As novas referências puxam o navy para um azul-marinho profundo e o magenta para #9C1155. Recomendo atualizar os tokens do login para a mesma paleta (fonte única) e validar contraste AA (o magenta sobre rosa claro precisa de teste).

Tipografia e medidas
- Inter; H1 28–32/700 navy; subtítulo 14/400 muted; label 15/600 navy; valor-KPI 26–32/700 magenta; título de card 15–16/600 navy; texto de lista 16/600 navy.
- Grid: padding lateral 16, gaps 12–16, seções 24; raio 16 em cards, 10–12 em inputs, pill em botões; altura de input 48–52, botões 52–56; bottom nav 64–72 + safe-area.

3. COMPONENTES A PADRONIZAR (Tailwind)
- `PageHeader` (voltar + logo + ajuda + divisor) e `PageTitle` (breadcrumb + H1 + subtítulo + régua rosa).
- `KpiHeroCard` (2 métricas + divisor vertical), `KpiCard` (ícone em chip rosa + label + valor), `KpiSplitCard` (2 métricas em card largo).
- `Button` primário (bg-plum, texto branco, rounded-full, h-13) e secundário (border-2 border-plum, texto plum, fundo branco); par sempre 50/50 quando lado a lado.
- `Field` (label acima), `Input`, `Select` (chevron rosa), `MoneyInput`, `QuantityInput`, `DateField` (ícone calendário), `Textarea`.
- `SegmentedBoolean` (Sim/Não com radio e estado selecionado rosa) — para "Pago?", "Ativo?", "Entrada/Saída".
- `QuickActions` (painel + linhas com chevron), `ListRow`, `Badge` de status, `StockBadge` (normal/abaixo/crítico).
- `BottomNav` com 5 itens e estado ativo em pill; itens: Início, Produtos, Estoque, Vendas, Financeiro (Produtos/Estoque são meus; Vendas/Financeiro de outro módulo — validar dono da navegação).
- `EmptyState`, `Skeleton`, `ErrorState`, `Toast` acessível.

4. COMO APLICO AOS MEUS MÓDULOS (sem implementar)
- Painel do estoque: card-herói com "Itens ativos" e "Abaixo do mínimo"; 2 cards brancos com "Críticos/esgotados" e "Valor em estoque (custo, se permitido)"; card largo "Movimentações hoje"; botões "+ Entrada" e "+ Ajuste"; ações rápidas Produtos / Movimentações / Mínimos.
- Lista de produtos: no mobile vira card (nome navy, categoria muted, saldo grande em magenta, badge de alerta, chevron); filtros em chips; FAB não — usar o padrão de botão do painel.
- Formulário de produto: mesma anatomia da Nova venda — labels acima, categoria/unidade em select, custo/venda em 2 colunas, margem no card-herói rosa, estoque mínimo + validade, rodapé Salvar/Cancelar.
- Movimentação: Entrada/Saída como `SegmentedBoolean`; produto em autocomplete mostrando saldo; quantidade + unidade; card-herói "Saldo após"; motivo em select; bloqueio inline quando insuficiente.
- Ajuste: card-herói mostra "Sistema → Contada" e a diferença em magenta/vermelho; botão Salvar + Cancelar.
- Estoque mínimo: lista com badge e edição em drawer seguindo os mesmos campos.
- O formulário de venda da referência confirma o padrão de "Pago? Não + vencimento" já previsto na documentação — mas depende de um módulo de Vendas que ainda não existe no backend.

5. IMPACTO NOS CONTRATOS (backend real em /backend)
O backend de produtos/estoque já existe e difere da minha proposta v1. Ajustes necessários antes de eu implementar:
a) Envelope real: `{ "success": true, "data": ... }` e erro `{ "success": false, "error": "mensagem" }`. Não há `code`, `fieldErrors` nem `requestId`. Proposta: camada `lib/api` no front traduz para `{ data }` / `{ message }`; se der, pedir ao backend `code` + `fieldErrors` (melhora erro por campo no formulário).
b) IDs: o backend usa `id` numérico (não `codigo`); não há `sku`. Meus tipos devem usar `id` e o rótulo "Código" pode exibir `id`.
c) Status: `ativo: boolean` (não enum). Enums são MAIÚSCULOS: `ENTRADA`/`SAIDA`, `AUMENTO`/`REDUCAO`.
d) Decimais: Prisma serializa `Decimal` como string — alinhado à recomendação de não usar float; confirmar no JSON real.
e) Ainda não existem: paginação, `version` (concorrência), `motivo` em movimentação, endpoint de auditoria/histórico de alterações, endpoints de regra de estoque mínimo, validação de fornecedor, autenticação/operador. Minha UI deve tratar ausência desses campos sem quebrar.
f) `POST /api/estoque/movimentacoes` retorna `{ movimentacao, saldoAtual, alertaEstoqueBaixo }` — perfeito para o card "Saldo após".
g) `GET /api/produtos/estoque-baixo` retorna `{ total, produtos }` com chaves snake_case (`quantidade_estoque`, `estoque_minimo`) — inconsistente com o resto; pedir normalização ou adaptar.
h) Regra de preço: o backend bloqueia venda < custo com 422. Meu desenho previa aviso; ajustar para erro inline.
i) Ajuste grava `AUMENTO` quando diferença >= 0 (inclui zero) e sempre atualiza o saldo para a contagem; a UI precisa do estado "sem diferença" (não prometer que não gera registro).
j) Estoque mínimo aceita 0 no backend, mas a regra de negócio diz > 0. Definir.
k) Não há endpoints de Vendas/Clientes/Painel — o Painel da referência mistura módulos; por ora só consigo montar KPIs de estoque. Proposta de contrato: `GET /api/painel/resumo` agregando (ou consultas paralelas), a definir com o dono de Vendas.

6. ORDEM PRESERVADA / PRÓXIMO PASSO
- Não implementei nada; aguardo a validação do backend (itens a–k) para começar pelas telas de Produtos e Estoque, usando estes tokens/componentes.
- Com a validação, a ordem sugerida é: tokens + shell/BottomNav → lista e formulário de Produtos → movimentações → ajustes → estoque mínimo → painel do estoque.
- Se quiser, preparo apenas o "style guide" em Storybook/mocks (sem telas reais) enquanto a validação corre — diga se autoriza.
