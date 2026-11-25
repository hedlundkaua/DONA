# Contrato da API financeira, vendas e relatórios

As rotas usam sessão autenticada por cookie e proteção CSRF em métodos mutáveis. Todos os dados são limitados ao negócio da sessão.

## Permissões

- `GET /api/financeiro/taxas`: administrador, gestor, financeiro e vendedor; o retorno deve respeitar o perfil.
- `PUT /api/financeiro/taxas`: administrador e gestor. Recebe `{ "taxas": [{ "bandeira": "VISA", "modalidade": "DEBITO|CREDITO", "parcelas": 1, "percentual": "2.50" }] }` e substitui as taxas configuradas do negócio de forma atômica.
- `GET /api/financeiro/parcelas`, `POST /api/financeiro/parcelas/:id/receber`, `GET|POST /api/financeiro/lancamentos` e `GET /api/relatorios/vendas`: administrador, gestor e financeiro.
- `POST /api/vendas` mantém os campos e comportamentos legados, aceitando opcionalmente `pagamento: { "forma": "DINHEIRO|PIX|CARTAO", "bandeira?": "VISA", "modalidade?": "DEBITO|CREDITO", "parcelas?": 1, "primeiroVencimento": "YYYY-MM-DD", "recebido?": false }`.

## Regras financeiras

- Cartão exige bandeira e modalidade; débito gera uma parcela e crédito aceita parcelamento conforme taxa configurada. Dinheiro e PIX não aceitam dados de cartão.
- A venda registra snapshot da forma, taxas e percentuais aplicados. Alterar taxas depois não recalcula vendas existentes.
- Valores monetários usam decimal exato, arredondados a centavos uma única vez conforme regra comercial documentada pelo backend. A soma das parcelas corresponde exatamente ao valor líquido da venda; diferenças de centavo ficam na última parcela.
- Parcelas vencem mensalmente a partir de `primeiroVencimento`, preservando o dia quando possível e ajustando ao último dia do mês quando necessário.
- `recebido` registra o recebimento inicial. `POST .../:id/receber` é idempotente: receber novamente uma parcela confirmada não cria novo lançamento nem altera o valor recebido.
- Lançamento manual recebe descrição, data e valor; ator e negócio são obtidos da sessão, nunca do corpo.
- Listagens aceitam filtros por período/status conforme cada recurso. Totais e somas são calculados sobre todo o conjunto filtrado, independentemente de paginação. Parcelas e vendas retornam referências e detalhes vinculados.

## Formato e validação

Datas de entrada usam `YYYY-MM-DD`; valores monetários são strings decimais para evitar perda de precisão no transporte. Erros seguem `{ "success": false, "error": "..." }`; sucesso segue `{ "success": true, "data": ... }`. IDs, datas, enumerações, percentuais, valores positivos e combinações de forma/modalidade devem ser validados no servidor.
## Campos para integração

- Taxas: GET e PUT retornam `data.taxas` (lista). PUT recebe `{taxas:[{bandeira,modalidade,parcelas,percentual}]}`. GET inclui o perfil ESTOQUISTA. Percentual de 0 até menos de 100, com até 2 casas, e parcelas de 1 a 36.
- Venda nova: informe `pagamento` como acima. Com pagamento, o servidor deriva o status e o vencimento; o cliente pode omitir os dois campos legados. O primeiro vencimento deve ser na data do pedido ou depois. `recebido:true` só para Pix/dinheiro. O relatório comercial usa o dia do pedido; o caixa usa a data efetiva.
- GET/POST/detalhe de venda incluem campos de snapshot `forma,bandeira,modalidade,numeroParcelas,percentual,taxa,liquido`, nulos nas vendas antigas. O detalhe inclui `parcelas` (id, numero, vencimento, valor, recebidoEm).
- Listas financeiras usam `data:{items,page,limit,total,resumo}`, páginas a partir de 1 e limit até 100. Datas de filtros `de,ate` são inclusivas.
- GET parcelas filtra por `status=PENDENTE|RECEBIDA`, de/ate por vencimento e vendaId. Itens: id, vendaId, cliente {id,nome}, numero, numeroParcelas, vencimento, valor, recebidoEm, status. Resumo: pendente, recebido (valores). POST receber recebe `{}` (hoje UTC) ou `{data:"YYYY-MM-DD"}` e devolve id, vendaId, valor, recebidoEm, lancamentoId.
- GET lancamentos filtra por de/ate, tipo=ENTRADA|SAIDA, origem=MANUAL|VENDA. Itens: id,tipo,origem,descricao,data,valor,usuario {id,nome},vendaId,parcelaId. Resumo: entradas,saidas,saldo. POST manual recebe tipo,descricao,data,valor.
- GET relatorios/vendas filtra por de/ate (dataPedido), forma=DINHEIRO|PIX|CARTAO|NAO_INFORMADA, clienteId, situacao=PENDENTE|PARCIAL|RECEBIDA|NAO_INFORMADA. Itens: id,cliente,dataPedido,forma,situacao,total,taxa,liquido. Resumo: bruto,taxas,liquidoPrevisto,quantidade. O bruto inclui legado; líquido previsto considera somente pagamentos registrados. Campos monetários são strings decimais.
