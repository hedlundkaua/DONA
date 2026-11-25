# Validação R6 — DONA

Data: 25/11/2026. Responsável: Íris, testes independentes.

## Resultado

**126/126 verificações aprovadas; nenhuma falha de produto pendente no escopo executado.**

| Suíte | Aprovadas | Falhas |
| --- | ---: | ---: |
| Conta, OTP de troca de email e estoque baixo | 19 | 0 |
| Financeiro, vendas, permissões, isolamento e SQL | 50 | 0 |
| Mobile, formulários reais e popup de novidades | 57 | 0 |
| Total | 126 | 0 |

## Ambiente e builds

- Exclusivamente QA local: PostgreSQL `127.0.0.1:5548/dona_test_r6`, backend `127.0.0.1:3400` e frontend `127.0.0.1:3402`.
- Fixtures sintéticas, dois negócios, seis usuários de cinco perfis e sink SMTP local; credenciais e segredos efêmeros não são registrados neste documento.
- Harness em `C:/Users/kaua/AppData/Local/Temp/dona-r6-qa`, iniciado com cwd explícito `C:/Users/kaua/Documents/DONA`. Código do produto não foi alterado pelos testes.
- Backend compilado em cópia isolada e reutilizado nas verificações mobile. Migrações R6 aplicadas sobre fixtures anteriores às migrações financeiras/conta.
- Frontend final: commit `48495cb`, incluindo a correção de débito `564a621`. Build Turbopack final validado pela Luma copiado para a pasta QA via `R6_REUSE_FRONTEND`; `next start` recebeu `BACKEND_URL` local no ambiente do processo.
- BUILD_ID do frontend original e da cópia QA: `cfHy8EsGEBxgeP36GLaRr`.
- Hash SHA-256 de `novidades-dialog.tsx`, igual no produto e na cópia: `036CC8DB801FDAB0BC4EECB6CA46F1621F1FF0CCD5281D5A2F3094F1FB9CD035`. O formulário final de venda também teve hash comparado entre origem e cópia.
- Edge headless, viewport CSS de 390 × 844.

### Ponte HTTPS do harness

O navegador acessou `https://127.0.0.1:3402`. Uma interceptação do Playwright encaminhou as requisições ao frontend HTTP local e devolveu suas respostas. Essa ponte permitiu usar o cookie de produção `__Host-dona_session`, com `Secure`, sem alterar o produto nem desabilitar suas proteções. Não houve conexão com Vercel, VPS ou banco de produção nesta execução local. A ponte não valida certificados/TLS de produção.

## Cobertura confirmada

### API e SQL — 69 verificações

- Login de fixtures anteriores às migrações; empresa inicialmente nula; consulta e edição da conta; atualização da empresa na sessão; restrição por perfil e CSRF.
- Troca de email com senha atual, OTP capturado apenas no sink SMTP, destinatário vinculado, rejeição por outro negócio, preservação do email antigo até confirmação, revogação de sessão e login pelo novo email.
- Estoque baixo estrito: 9/10 incluído; 10/10, 0/0 e produto inativo excluídos; catálogo e lista de reposição equivalentes.
- Taxas: leitura/escrita por perfil, percentuais inválidos, duplicação e atualização atômica.
- Venda de R$100,00 com taxa de 3%: taxa R$3,00, líquido R$97,00 e duas parcelas de R$48,50. Vencimentos 31/01 e 28/02; saldo de centavos de uma venda de R$1,00 em três parcelas: R$0,32 + R$0,32 + R$0,33.
- Snapshot preservado após alterar taxas; venda anterior ao financeiro com campos nulos e sem parcelas.
- Resumos calculados além da página, datas inclusivas no relatório e data efetiva no caixa.
- Recebimento concorrente idempotente: mesma referência de lançamento, um registro confirmado por SQL; segunda parcela encerra a venda como paga e sem vencimento.
- Isolamento entre negócios em venda, parcelas, recebimento e caixa; ator/negócio não são aceitos por corpo de lançamento manual.
- Lançamento de R$0,01; rejeição de valores não positivos, precisão excessiva, filtros inválidos e CSRF inválido.
- Venda com 100 itens distintos aceita e 101 rejeitada; venda ao custo aceita e abaixo do custo rejeitada; taxa ausente provoca rollback do estoque, confirmado no SQL.
- Consulta SQL sem divergências de negócio entre parcelas e suas vendas.

### Mobile e popup — 57 verificações

- Painel, produtos, reposição, vendas, nova venda, conta, financeiro geral e abas `parcelas`, `caixa`, `vendas` e `taxas`: HTTP 200 autenticado, sem overflow horizontal e com headers de segurança.
- CSS Tailwind confirmado por estilo computado; capturas finais feitas após `main h1` visível, carregamento e fontes prontos, evitando skeletons de streaming.
- Alternância de recebimento confirmado e data prevista; lançamento manual e gravação da tabela de taxas por formulários reais.
- Crédito pela UI: selecionar cliente/produto, configurar taxa de 3%, conferir preview R$100,00 − R$3,00 = R$97,00 em 2×, concluir venda e conferir detalhe/API com duas parcelas de R$48,50.
- Receber uma parcela pela aba Financeiro; resposta 200 e persistência em API/SQL com um lançamento.
- Salvar nome e empresa pela UI; aguardar o texto atualizado no cabeçalho e confirmar persistência da conta.
- Débito pela UI: pedido de 31/01/2026 e primeiro vencimento escolhido em 10/02/2026; data preservada no detalhe e na parcela retornada pela API.
- Popup `financeiro-r6`: aparece sem marca; cabe na viewport; botão fecha; refresh preserva dismiss; Escape fecha e persiste; outro usuário no mesmo navegador vê o popup; navegação funciona após fechar.
- Sem erros de execução JavaScript ou violações de CSP nos fluxos executados, exceto o aviso de Analytics local descrito abaixo.

## Aviso de ambiente

No `next start` local, `/_vercel/insights/script.js` respondeu HTML e gerou aviso de MIME no console. Foi registrado em `warnings` do JSON mobile, separado das verificações de execução/CSP. Não houve falha funcional associada. O Codex informou que o script real de Analytics em produção respondeu HTTP 200.

## Ajustes do harness

Foram corrigidos apenas os testes: modo batch por `R6_COMMANDS`, cookie seguro/ponte HTTPS, espera pelo texto do cabeçalho após `router.refresh()` e espera pelo heading após streaming. Capturas preliminares sem utilitários Tailwind, geradas pelo build `--webpack`, foram substituídas pelas capturas do build Turbopack final reutilizado. Os resultados mobile finais são os de `run-VdcJ1h`.

## Evidências preservadas

Raiz: `C:/Users/kaua/AppData/Local/Temp/dona-r6-qa/`.

- `run-ZFVqOw/accounts.json`: 19 aprovadas.
- `run-ZFVqOw/finance.json`: 50 aprovadas, incluindo consultas SQL.
- `run-VdcJ1h/mobile.json`: 57 aprovadas; aviso Analytics em `warnings`.
- `run-VdcJ1h/mobile-0.png` a `mobile-10.png`: rotas finais carregadas; `mobile-6.png` contém o financeiro completo.
- `run-VdcJ1h/mobile-cartao-preview.png`, `mobile-cartao-detalhe.png`, `mobile-recebimento.png`, `mobile-conta.png`, `mobile-debito-data.png` e `mobile-popup.png`: fluxos e popup finais.
- `rig.mjs`, `helpers.mjs`, `accounts.mjs`, `finance.mjs` e `mobile.mjs`: harness e cenários. Diretórios e evidências das execuções anteriores também foram preservados.

## Produção e encerramento

O Codex informou a promoção do frontend e smoke real por HTTPS Vercel → VPS com 15 verificações aprovadas, incluindo autenticação, conta, cadastros, venda com taxa/parcelas, recebimento, caixa e cinco páginas. Informou também a remoção das fixtures temporárias de produção. Esses resultados são de sua execução, distintos dos 126 checks locais acima.

Após a conclusão, o harness recebeu `stop` para encerrar frontend, backend, sink SMTP e PostgreSQL QA, preservando arquivos e evidências.
