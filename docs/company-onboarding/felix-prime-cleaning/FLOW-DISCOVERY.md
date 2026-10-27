# Felix Prime Cleaning — descoberta de fluxo

Status: fork aprovado em 2026-10-22. Mapeamento inicial registrado; nao implementar antes de fechar as decisoes em aberto.

## Objetivo

Registrar como a Felix Prime Cleaning opera e preparar o fork antes de iniciar a implementacao.

## Repositorio do fork

- Nome proposto: `Felix-Prime-Cleaning`.
- Visibilidade: privada.
- Base: `vitornonno/Automacao`, branch `main`, para reaproveitar o arcabouco da extensao e as protecoes de privacidade.
- Evolucao: o fork deve ter seu proprio remoto, issues, commits e ciclo de liberacao. Alteracoes especificas da Felix nao retornam automaticamente ao projeto original.

## Fluxo inicial mapeado

### 1. Captura da lead

1. O cliente preenche um formulario do Facebook.
2. Zapier encaminha os dados ao app Pushover.
3. Os dados podem conter nome, tipo de limpeza, quartos, banheiros e, em alguns casos, square footage.

### 2. Primeiro contato — sem cotacao

A regra comercial e **nao precificar antes de o cliente responder**. Portanto, metragem, quartos, banheiros e flexibilidade de preco nao devem disparar uma cotacao automatica nesta etapa.

A primeira mensagem deve preservar estes pontos:

- Identificacao de Oliver e Felix Prime Cleaning;
- Origem no formulario do Facebook;
- Referencia ao tipo de limpeza e, quando disponivel, aos dados da casa;
- Promocao/desconto para novos clientes que reservarem naquela semana;
- Pergunta sobre os melhores dias daquela semana;
- Compromisso de enviar a estimativa somente apos a resposta.

Modelo atual de referencia:

```text
Hi {CLIENT NAME}! 😊 This is Oliver with Felix Prime Cleaning. Thanks so much for reaching out through our Facebook form!

I’d be happy to prepare a quote for a {CLEANING} for your XX bed / XX bath home. And good news, we’re offering a special discount for new clients who book with us this week! ✨

Which days work best for you this week?

Once I get that I’ll quickly provide your estimate!
```

### 3. Priorizacao de resposta

Quando o cliente responder no Quo (antigo OpenPhone), a lead deve receber uma tag ou outro destaque visual. Essa fila de respostas e prioritaria para o VA, pois e o momento em que a cotacao pode ser conduzida manualmente.

### 4. Relatorio de ausencia/fim de semana

Ao retornar, o VA precisa de um relatorio consolidado de tudo que ocorreu enquanto esteve fora, especialmente em fins de semana. O relatorio deve distinguir ao menos: novas leads, primeiro contato enviado, respostas recebidas, conversas sem resposta e itens que exigem acao humana.

## Perguntas de descoberta

- [ ] Como o Pushover sera lido: notificacao, e-mail, API, Zapier ou uma nova fonte intermediaria?
- [ ] Qual identificador liga a lead do Facebook a conversa correspondente no Quo?
- [ ] O Quo permite criar tag, alterar status ou destacar conversa por API/integracao autorizada? Qual tag e qual regra exata?
- [ ] O primeiro contato sera somente preparado para copia ou podera ser enviado automaticamente? A regra de seguranca inicial e copia/revisao humana.
- [ ] Quais variacoes da primeira mensagem dependem de tipo de limpeza, dados ausentes, metragem ou promocao vigente?
- [ ] O que exatamente conta como "respondeu": qualquer mensagem, palavra-chave, ligacao perdida ou apenas resposta escrita do cliente?
- [ ] Quando a resposta chega, quais dados adicionais devem ser solicitados antes da cotacao humana?
- [ ] A cotacao depende de fotos, visita, localizacao, disponibilidade, numero de profissionais ou outra variavel?
- [ ] Qual periodo define o relatorio de ausencia e por qual canal ele deve ser entregue?
- [ ] Quais eventos, alem dos quatro iniciais, precisam constar no relatorio: falhas, opt-outs, agendamentos, mensagens manuais ou leads duplicadas?
- [ ] A agenda vem do Presto? Se sim, a disponibilidade pertence a este fork ou fica fora do primeiro escopo?
- [ ] O que seria um resultado errado ou arriscado para essa operacao?

## Decisao a registrar depois da descoberta

- [ ] Confirmar fork separado, com justificativa tecnica e operacional documentada.
- [ ] Definir o que, se houver, sera reutilizado do projeto atual (componentes genericos, padroes de privacidade e testes).
- [ ] Definir nome, repositorio, branch inicial e responsavel pela manutencao do fork.
