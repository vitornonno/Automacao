# Presto e validação — roteiro de aceite

## Material local para diagnosticar o Presto

Salve localmente, mas não versione:

1. Código-fonte da página de agenda com vários jobs visíveis.
2. Código-fonte da mesma página com um job aberto e detalhes carregados.
3. Debug copiado após **Read visible schedule**.

No card aberto, localize e registre os seletores ou padrões para:

- horário de início e, se disponível, término;
- endereço e link de mapa/coordenadas;
- preço operacional;
- estado que indica que o card correto está aberto;
- botão de mês anterior/próximo.

## Critérios de aceite da leitura

Um scan é utilizável somente se todos os jobs da janela de 20 dias possuírem:

- data válida;
- `startTime` no formato `HH:MM` de 24 horas;
- coordenadas ou endereço utilizável;
- preço numérico em dólares.

Se algum job estiver sem preço ou localização, o cálculo deve continuar conservador e explicar no debug por que aquele dia não foi sugerido. Não inventar duração ou rota.

## Cenários no Yelp

Após uma leitura bem-sucedida da agenda, testar:

1. Lead com endereço e duração: **Find availability** mostra vagas ou razões verificáveis para ausência delas.
2. Lead sem endereço ou duração: o painel informa que ainda precisa desses dados, sem tratar todos os dias como indisponíveis.
3. Selecionar e desmarcar vagas atualiza imediatamente a mensagem copiada.
4. Alterar metragem, quartos, banheiros, serviço ou empresa recalcula a mensagem e invalida vagas antigas.
5. Sem vaga compatível: a mensagem coleta preferências comerciais aprovadas sem expor a indisponibilidade interna.
6. Follow-up já enviado: o botão daquele modelo fica desabilitado; os demais continuam disponíveis para escolha humana.
