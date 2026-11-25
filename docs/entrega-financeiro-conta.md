# Entrega de conta, pagamentos e financeiro

## Uso no aplicativo

Em **Mais → Meus dados**, cada pessoa pode atualizar nome e nome de usuário. O administrador também altera o nome da empresa, exibido no cabeçalho. Para mudar o e-mail, informe a senha atual e confirme o código recebido no novo endereço. A confirmação encerra as sessões e exige novo login. A troca de senha continua disponível na mesma área.

O indicador **Abaixo do mínimo** abre a lista de reposição. A regra agora é saldo estritamente menor que o mínimo. Um produto com saldo 10 e mínimo 10 fica fora da lista; saldo 9 e mínimo 10 indica falta de 1. Produtos inativos ficam fora, e a lista começa pela maior falta.

Na venda, escolha Dinheiro, Pix ou Cartão. No cartão, informe bandeira, modalidade, número de parcelas e primeira data prevista. Administração e gestão cadastram antes a taxa de cada combinação em **Financeiro → Taxas da maquininha**. Uma operação sem taxa exige a configuração explícita de 0%.

## Venda, recebimento e caixa

O relatório comercial usa a data da venda. O caixa usa a data efetiva do recebimento ou lançamento manual. Cartão gera parcelas previstas; cada confirmação gera uma única entrada líquida, mesmo com cliques ou requisições simultâneas. Dinheiro e Pix permitem confirmar o recebimento ao registrar a venda.

Uma venda de R$ 100,00 com taxa de 3% em duas parcelas gera taxa de R$ 3,00 e duas previsões de R$ 48,50. A primeira confirmação coloca R$ 48,50 no caixa e mantém R$ 48,50 a receber. A soma das parcelas coincide com o líquido; diferenças de centavo ficam na última. Os vencimentos preservam o dia original, ajustando ao último dia de meses menores.

Administrador, gestor e financeiro consultam relatórios, confirmam recebimentos e registram entradas e saídas manuais. A configuração de taxas é restrita a administrador e gestor. Cada negócio consulta apenas seus próprios dados. O detalhe da venda preserva os preços e a taxa aplicada na criação.

## Compatibilidade e operação

As migrações são aditivas. As vendas anteriores continuam consultáveis com forma de pagamento não informada e sem gerar entradas retroativas. Previsões e filtros de data usam dias de calendário; o backend considera o dia UTC quando uma data é omitida.

Esta entrega registra pagamentos feitos fora do aplicativo. Cobrança Pix ou cartão por provedor, conciliação bancária, antecipação de recebíveis, cancelamento e estorno de venda continuam fora das funcionalidades atuais.

O contrato técnico está em [financeiro-api.md](financeiro-api.md). Antes de publicar, validar migração e fluxos em banco dedicado, criar e conferir o backup de produção e preparar a versão anterior do serviço para recuperação. As credenciais e os códigos de verificação devem permanecer fora dos relatórios.
