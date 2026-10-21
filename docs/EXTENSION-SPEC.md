# Cleaning Lead Quote Assistant — Especificação operacional

## Objetivo e limites

Extensão Chrome local para apoiar o atendimento de novas leads de empresas de limpeza no Yelp. Ela lê dados da lead e prepara uma cotação ou um pedido de informações.

- A extensão **nunca envia** mensagens, altera leads ou agenda serviços. Ela lê o Presto somente quando o atendente aciona a leitura de agenda.
- Ao confirmar uma cotação, o atendente recebe a mensagem imediatamente na área de transferência e a cola manualmente no Yelp.
- Thumbtack e Quo/OpenPhone estão fora do escopo atual.
- Toda proposta exige revisão humana antes de ser usada.

## Empresas e origem das regras

| Empresa | Regra de cotação | Material de origem |
| --- | --- | --- |
| KACS Cleaning Services LLC | Estimativa de horas; não informar valor total ao cliente | `docs/guia_precificacao_horas.xlsx`, aba `KACS` |
| Jhey's Cleaning | Faixa de preço: tabela base até US$100 acima | `docs/guia_precificacao.xlsx`, aba `Empresa iniciante` |

Os nomes `Jhey's` e `Jhey’s` são equivalentes. A identificação no fallback visual do Yelp lê o nome mostrado na página e também reconhece as contas atualmente conhecidas:

- KACS: `FAHbiW72jLTiNDvcOptrfg`
- Jhey’s: `BnI3aSQTdRlX1YGUuPfAiA`

Empresa ausente ou desconhecida exige escolha humana no campo **Company pricing**. A extensão não deve escolher uma tabela de preço por inferência.

## Dados necessários

A extração procura, nesta ordem, o estado Apollo do Yelp e o conteúdo visível da página. São usados:

- Nome da empresa e primeiro nome do cliente;
- tipo e frequência da limpeza;
- metragem, quartos e banheiros;
- produtos de limpeza solicitados;
- serviços adicionais solicitados.

Respostas de múltipla escolha do Yelp devem ser preservadas integralmente, separadas por vírgula. Exemplo: `Eco-friendly or green, Non-toxic, Pet-safe`.

Se a página ainda estiver carregando, o painel espera e tenta a extração novamente. O tipo de limpeza é obrigatório para a cotação; a extensão continua tentando encontrá-lo após um pequeno atraso.

Quando os valores do estado Apollo divergirem das respostas atuais visíveis no questionário, quartos, banheiros, frequência e localização visíveis prevalecem. Isso evita reutilizar uma resposta antiga presente no histórico da conversa.

## Regras de serviço e faixa de tamanho

- Uma nova lead marcada como `Regular home cleaning` sempre vira **First Cleaning**, mesmo se pedir atendimento semanal, quinzenal ou mensal. Tarifas recorrentes são apenas para clientes já atendidos após First/Deep Cleaning.
- Leads Move-In e Move-Out usam uma única cotação preliminar: a média das duas colunas correspondentes da tabela. A mensagem pergunta se o serviço é Move-In ou Move-Out para fechar uma estimativa mais precisa e justa.
- A metragem usa a próxima faixa superior da tabela.
- Sem metragem, quartos/banheiros definem uma faixa. A combinação ambígua 3 quartos / 2 banheiros usa 1.600 sq. ft.; como não há linha exata para 3 quartos / 3 banheiros, ela também usa a faixa conservadora viável de 1.600 sq. ft.; 4 quartos / 4 banheiros usa a faixa conservadora de 3.000 sq. ft.
- Acima de 3.000 sq. ft. há revisão manual.
- Sem metragem e sem combinação válida de quartos/banheiros, a extensão prepara um pedido de dados, em vez de gerar cotação.

## KACS

- A mensagem informa somente a duração estimada: horas-base da tabela + tolerância de 1,5 h.
- Recomenda cobrança por hora: US$50 por cleaner/hora, com equipe de 1–2 profissionais. A referência interna da equipe é US$100/h.
- Nunca mostrar ao cliente um total em dólares estimado.
- Para dados de tamanho faltantes, solicitar quartos e banheiros; metragem e fotos são opcionais.
- As mensagens iniciais seguem `docs/Base VA - KACS Cleaning.txt`, incluindo checklist de Move-in/Move-out quando aplicável.

## Jhey's Cleaning

- A faixa sempre é `valor da tabela` até `valor da tabela + US$100`.
- A mensagem informa serviço recomendado, faixa, equipe de 2 profissionais e os dados disponíveis da residência.
- Informar que a equipe fará uma rápida walkthrough na chegada para confirmar o escopo e o valor final antes de começar.
- Para dados de tamanho faltantes, solicitar metragem, quartos/banheiros e, opcionalmente, fotos ou vídeo.
- As mensagens seguem `docs/Base VA - Jhey's Cleaning.txt`. Não inventar duração estimada: a tabela disponível contém preços, não tempos.
- As mensagens de primeira resposta da Jhey’s usam tom acolhedor e promocional para novos clientes, destacando cuidado personalizado e valor do serviço. A faixa exibida já incorpora o preço introdutório para novos clientes; não informar percentual ou preço anterior que não esteja definido. Não devem inventar vagas, duração ou promessas de resultado.

## Limitações de serviço nas mensagens de cotação

Somente quando a lead pedir o item correspondente, incluir os blocos abaixo logo depois da cotação. Cada aviso começa com `⚠️` e avisos diferentes são separados por uma linha em branco.

- Carpet ou rug: não há shampoo/extraction profissional; há vacuuming de áreas com carpete e tapetes.
- Upholstery, sofa ou couch: não há limpeza profissional de estofados.
- Pet odor treatment: não há tratamento especializado ou garantia de remoção de odores; a equipe pode limpar profundamente as áreas e ajudar a reduzir odores.

## Confirmação direta e deduplicação

Os registros são locais no armazenamento do Chrome e usam o ID único da lead do Yelp como chave.

1. O painel calcula a proposta ou detecta a necessidade de informações.
2. **Confirm quote** ou **Request details** grava o registro como `approved` e copia a mensagem para a área de transferência na mesma ação.
3. Não há uma etapa obrigatória de aprovação em fila.

Ao reabrir uma lead salva/aprovada/ajustada, não criar uma duplicata. O botão fica bloqueado e mostra o estado atual. Exceções:

- Uma lead `discarded` pode ser gerada novamente; o novo pedido substitui o registro descartado.
- Se um registro anterior usou a empresa errada, a extensão permite gerar uma versão corrigida.
- Se novos detalhes de produtos ou serviços adicionais estiverem mais completos do que o registro salvo, a extensão permite gerar uma versão corrigida.
- Mudanças em metragem, quartos ou banheiros também permitem recalcular e confirmar uma versão atualizada.
- Quando uma cotação já aprovada for alterada manualmente no painel (empresa, serviço, metragem, quartos ou banheiros), a extensão recalcula e atualiza imediatamente o registro e a mensagem da área de transferência. Como a duração pode mudar, quaisquer datas de disponibilidade anteriores são removidas até uma nova busca ser executada. Marcar ou desmarcar uma data compatível também atualiza a mensagem copiada.
- Para leads já aprovadas/ajustadas, os botões **Copy follow-up 1**, **2**, **3** e **4** leem o texto visível da conversa atual do Yelp e reconhecem individualmente os trechos característicos de cada modelo da empresa. Um modelo que já aparece na conversa fica bloqueado, mas não há sequência obrigatória: a pessoa escolhe o follow-up adequado à situação. Os botões apenas copiam; não enviam nem alteram o chat.

## Dados locais e privacidade

Todos os dados operacionais ficam no perfil local do Chrome, em `chrome.storage.local`:

- Cada cotação confirmada é armazenada pela chave única `lead:<id-da-lead-do-yelp>`.
- A agenda lida do Presto é armazenada por empresa em `prestoJobs:kacs` e `prestoJobs:jheys`.
- Uma nova leitura do Presto substitui o snapshot anterior daquela empresa.
- Esses dados não são gravados em arquivos do projeto, no Presto, no CRM ou no Cloudflare.
- O Cloudflare Worker recebe somente pedidos autenticados de geocodificação e rota; o token do Mapbox fica como secret do Worker.

## Disponibilidade futura via Presto

O Presto será a fonte de verdade para agenda. KACS e Jhey's usam agendas independentes; uma disponibilidade nunca pode considerar jobs, equipes ou horários da outra empresa. Os cartões de job abertos expõem início, endereço, coordenadas do Google Maps, cleaner/equipe, tipo de serviço e preço.

- Horários oferecidos ao cliente são janelas fixas de chegada de 30 minutos, por exemplo `9:00–9:30 AM`.
- O painel de disponibilidade tem rolagem e pode ser movido ao arrastar o cabeçalho. Cada opção possui seleção individual; somente as opções marcadas entram na mensagem confirmada.
- Domingos nunca são oferecidos, mesmo quando a agenda estiver vazia.
- Para KACS e Jhey's, usar a duração prevista quando ela estiver disponível. Para KACS, isso normalmente é o limite superior da estimativa de horas da cotação.
- Quando não houver estimativa/duração disponível, a duração operacional é derivada do valor do serviço a US$100/h, arredondando para cima para o próximo intervalo de 30 minutos.
- A disponibilidade só é válida se couber entre os jobs existentes da agenda da empresa, considerando duração do novo serviço, trânsito e margem operacional fixa de 30 minutos. Não há separação por equipe neste cálculo.
- Uma disponibilidade só pode ser oferecida se o fim estimado da nova limpeza for até **7:00 PM**. Se a duração estimada, somada ao horário de início sugerido, ultrapassar esse limite, o dia não pode ser sugerido.
- O cálculo deve avaliar cada gap entre jobs em ordem cronológica. Para encaixar uma limpeza, o intervalo deve comportar: **duração estimada da nova limpeza + 30 minutos de tolerância operacional + tempo de deslocamento entre uma limpeza e outra**. Em encaixes entre dois jobs, considerar o deslocamento do job anterior até a nova limpeza e da nova limpeza até o próximo job. Após o último job, usar seu término estimado como o início possível da nova limpeza; o término da nova limpeza deve continuar até 7:00 PM.
  - O término de cada limpeza é sempre estimado pelo seu valor operacional (preço ÷ US$100/h quando não houver duração explícita). Antes de aceitar um encaixe que tenha próximo job, a extensão soma o término da nova limpeza, a tolerância e o trajeto até o ZIP/localização do próximo job; se a chegada for posterior ao início desse job, o horário é rejeitado. Para uma faixa de preço, usa-se o teto como medida conservadora.
  - Ao calcular disponibilidade, cada horário sugerido deve mostrar o último job usado no cálculo, seu início, duração e término estimados, além dos minutos de trajeto até a lead (e, quando existir, da lead até o próximo job). Dias sem jobs devem declarar que não existe trajeto entre jobs a calcular.
- Endereços já agendados podem usar as coordenadas expostas pelo Presto. Leads do Yelp sem endereço completo devem ser tratadas apenas como estimativa por região até que o cliente informe o endereço.
- A versão com trânsito real usa o perfil `driving-traffic` do Mapbox Directions. O token deve ficar somente em um serviço intermediário (backend/Worker), nunca no código ou armazenamento da extensão. Sem o serviço de rotas, a extensão deve usar uma margem de deslocamento conservadora e sinalizar que é uma estimativa.
- A base do relay está em `route-relay/`. Ele aceita somente `POST /routes`, autentica a extensão por token separado e devolve duração/distância; não cria nem altera jobs do Presto.
- O popup da extensão tem a seção **Route relay**. Ela armazena localmente a URL do Worker e o `EXTENSION_TOKEN`, faz uma consulta de rota de teste e deixa pronto o canal para consultas `POST /routes`. Para transferir a configuração entre perfis do Chrome, o token salvo pode ser copiado localmente pelo botão **Copy token** ou revelado temporariamente por **Show token**. A URL atual é `https://cleaning-route-relay.jvnonno54.workers.dev`.
- A integração Presto é somente leitura: com a agenda correta aberta, **Presto schedule → Read visible schedule** identifica automaticamente KACS ou Jhey's pelo nome exibido no menu da conta, abre os cards dos eventos visíveis e captura horário, endereço/coordenadas e preço. A agenda usa horários AM/PM, convertidos para 24 horas antes do cálculo. O leitor aguarda o card de serviço aberto e lê o valor no campo localizado `Preço`, sem depender de o mapa estar presente. O snapshot é gravado pela própria página do Presto, portanto permanece disponível mesmo se o popup da extensão for fechado durante ou após a leitura; ao reabrir o popup, ele restaura o último scan salvo. Não cria, edita ou reserva jobs no Presto.
- A leitura da agenda e dos detalhes considera apenas a data atual na Califórnia (`America/Los_Angeles`) e datas futuras; jobs de dias anteriores são sempre ignorados.
- A janela de busca de disponibilidade é de **20 dias corridos**, incluindo hoje, no fuso da Califórnia. Se ela atravessar a virada do mês, a extensão lê o próximo mês no Presto e volta automaticamente para o mês que estava aberto.
- A tela exibe somente as três primeiras vagas compatíveis. Quando houver outras, deve informar claramente a quantidade e listá-las em uma seção recolhível; cada vaga extra também pode ser marcada para entrar na mensagem confirmada. Elas não contam como dias indisponíveis.
- Quando uma busca de disponibilidade for concluída sem vagas compatíveis, a mensagem confirmada pergunta perto do final quais dias, período do dia e endereço o cliente prefere, informando que a equipe tentará encontrar as opções mais próximas. A confirmação de telefone só entra se o Yelp fornecer explicitamente um número do consumidor vinculado à lead.
- O botão **Read visible schedule** abre visualmente cada card da agenda visível, aguarda o card selecionado carregar antes de extrair endereço/coordenadas e preço, e não altera nenhum dado no Presto. Em agendas grandes, essa leitura pode levar alguns minutos.
- **Verbose debug** distingue explicitamente a captura da agenda do cálculo de disponibilidade. Antes de receber endereço e duração da lead, exibe `availability.status: not_calculated`, em vez de uma lista vazia que poderia ser interpretada como todos os dias disponíveis. Quando esses dados existirem, exibirá os dias sem disponibilidade e o motivo.
- Valores exibidos pelo Presto usam formato localizado (por exemplo, `$ 180,00`) e são normalizados para dólares (`180`) antes de qualquer cálculo de duração operacional.

## Debug e manutenção

O botão **Debug** mostra rota, origem da captura, campos extraídos, resultado da cotação, registro existente e eventos recentes. O botão **Copy debug** copia esse JSON para a área de transferência para diagnóstico.

Arquivos principais:

- `chrome-extension/pricing.js`: tabelas e regras de cálculo.
- `chrome-extension/extractors.js`: leitura de dados do Yelp.
- `chrome-extension/quote-messages.js`: mensagens, disponibilidade selecionada e limitações de serviço.
- `chrome-extension/content.js`: painel, navegação interna do Yelp, disponibilidade e confirmação direta.
- `chrome-extension/presto-content.js`: leitura somente de agenda e cards do Presto.
- `chrome-extension/background.js`: ponte entre content scripts e o relay de rotas.
- `route-relay/src/index.js`: Worker do Cloudflare para Mapbox `/geocode` e `/routes`.
- `chrome-extension/test-pricing.js`: verificações automatizadas principais.

## Instalação e teste

1. Abra `chrome://extensions`.
2. Ative **Developer mode**.
3. Clique em **Load unpacked** e selecione `chrome-extension`.
4. Após mudanças locais, use o ícone de recarregar da extensão e reabra a lead do Yelp.
5. Para validação de código, execute a partir de `chrome-extension`:

```powershell
node test-pricing.js
node --check content.js
node --check extractors.js
node --check quote-messages.js
```
