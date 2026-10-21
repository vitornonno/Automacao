# Tabela de preço e duração — modelo

Registre valores aprovados em dólares e horas decimais. Não use dados de clientes reais.

| Faixa (sq. ft.) | Deep Cleaning | First Cleaning | Move-in | Move-out | Monthly | Bi-weekly | Post-construction | Observações |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 800 |  |  |  |  |  |  |  |  |
| 1000 |  |  |  |  |  |  |  |  |
| 1200 |  |  |  |  |  |  |  |  |
| 1400 |  |  |  |  |  |  |  |  |
| 1600 |  |  |  |  |  |  |  |  |
| 1800 |  |  |  |  |  |  |  |  |
| 2000 |  |  |  |  |  |  |  |  |
| 2200 |  |  |  |  |  |  |  |  |
| 2400 |  |  |  |  |  |  |  |  |
| 2600 |  |  |  |  |  |  |  |  |
| 2800 |  |  |  |  |  |  |  |  |
| 3000 |  |  |  |  |  |  |  |  |

## Decisões obrigatórias

- Cada coluna representa preço, horas ou outra medida?
- A faixa exibida ao cliente é fixa, tem acréscimo definido ou exige revisão?
- Move-in e move-out usam linhas próprias ou uma média intencional?
- Quais combinações quarto/banheiro não possuem linha exata e qual faixa conservadora deve ser usada?
- Quando a casa ultrapassa a última faixa, qual status e mensagem devem ser usados?

Ao implementar, mantenha a ordem das colunas coerente com `SERVICES` em `chrome-extension/pricing.js` e acrescente testes de uma faixa baixa, uma intermediária, uma combinação quarto/banheiro e um caso acima do limite.
