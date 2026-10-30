# Cleaning Lead Quote Assistant — Especificação operacional

## Objetivo e limites

Extensão Chrome local para apoiar o atendimento de novas leads de empresas de limpeza no Yelp. Ela lê dados da lead e prepara uma cotação ou um pedido de informações.

- A extensão **nunca envia** mensagens, altera leads ou agenda serviços. Ela lê o Presto somente quando o atendente aciona a leitura de agenda.
- Ao confirmar uma cotação, o atendente recebe a mensagem imediatamente na área de transferência e a cola manualmente no Yelp.
- A leitura automática de leads continua limitada ao Yelp. Thumbtack, Quo/OpenPhone e qualquer outro site podem usar o modo **Manual quote**: o atendente insere os detalhes da lead, endereço/localidade e empresa para gerar a mesma mensagem e consultar disponibilidade da agenda Presto. A extensão não lê nem envia mensagens nesses sites.
- Toda proposta exige revisão humana antes de ser usada.

## Empresas e origem das regras

| Empresa | Regra de cotação | Material de origem |
| --- | --- | --- |
| KACS Cleaning Services LLC | Estimativa de horas; não informar valor total ao cliente | `docs/guia_precificacao_horas.xlsx`, aba `KACS` |
| Jhey's Cleaning | Faixa de preço: tabela base até US$100 acima | `docs/guia_precificacao.xlsx`, aba `Empresa iniciante` |
| Da Silva Cleaning Services | Mesma faixa e tabela da Jhey's; mensagens e telefone próprios | `docs/DaSilva Cleaning.txt` |
| UT Cleans | Mesma tabela base da Jhey's; mensagens e telefone próprios | `docs/Cópia de UT Cleans - Follow Up.docx` |
| Mary's House Cleaning | Mesma tabela base da Jhey's; mensagens e telefone próprios | `docs/MARY'S HOUSE CLEANING.docx` |
| Gleam Team Housecleaning | Mesma tabela base da Jhey's; mensagens e telefone próprios | `docs/Gleam Team Housecleaning.txt` |
| Express House Cleaning | Mesma faixa e tabela da Jhey's; mensagens e telefone próprios | `docs/Express House Cleaning.txt` |

Os nomes `Jhey's` e `Jhey’s` são equivalentes. A identificação no fallback visual do Yelp lê o nome mostrado na página e também reconhece as contas atualmente conhecidas:

- KACS: `FAHbiW72jLTiNDvcOptrfg`
- Jhey’s: `BnI3aSQTdRlX1YGUuPfAiA`
- Da Silva: `NKYK8RrTUSDhdbaI848bjg`

Empresa ausente ou desconhecida exige escolha humana no campo **Company pricing**. A extensão não infere a empresa pelo texto da conversa. O nome do cliente vem preferencialmente da lead ativa no estado Apollo; o fallback visual exige uma região de cliente identificável. Se não houver evidência confiável, o nome fica vazio.

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
- Quando o Yelp informa Move-in/Move-out combinado, o painel pergunta qual é o serviço. A escolha usa a coluna correspondente de Move-in ou Move-out; os valores não são calculados pela média.
- A metragem usa a próxima faixa superior da tabela.
- Sem metragem, quartos/banheiros definem uma faixa. Se não houver linha exata, usa-se a menor combinação cadastrada que cubra ambos; se nenhuma cobrir, exige-se revisão manual. A combinação 4 quartos / 4 banheiros usa 3.000 sq. ft.
- Acima de 3.000 sq. ft. há revisão manual.
- Sem metragem e sem combinação válida de quartos/banheiros, a extensão prepara um pedido de dados, em vez de gerar cotação.

## KACS

- A mensagem informa somente a duração estimada: horas-base da tabela + tolerância de 1,5 h.
- Toda estimativa usa somente incrementos de 30 minutos (`1`, `1.5`, `2`, `2.5` etc.). Para a referência operacional de preço, dividir o valor por US$100/h e arredondar ao intervalo de meia hora mais próximo antes de adicionar a tolerância de 1,5 h: US$220 vira `2–3.5 hours` e US$280 vira `3–4.5 hours`. A mesma regra é usada para estimar a duração dos jobs KACS na agenda.
- Recomenda cobrança por hora: US$50 por cleaner/hora, com equipe de 1–2 profissionais. A referência interna da equipe é US$100/h.
- Nunca mostrar ao cliente um total em dólares estimado.
- Para dados de tamanho faltantes, solicitar quartos e banheiros; metragem e fotos são opcionais.
- As mensagens iniciais seguem `docs/Base VA - KACS Cleaning.txt`, incluindo checklist de Move-in/Move-out quando aplicável.

## Jhey's Cleaning

- A faixa sempre é `valor da tabela` até `valor da tabela + US$100`.
- A mensagem informa serviço recomendado, faixa, equipe de 2 profissionais e os dados disponíveis da residência.
- Não incluir a promessa de avaliar a casa e definir o escopo na chegada.
- Para dados de tamanho faltantes, solicitar metragem, quartos/banheiros e, opcionalmente, fotos ou vídeo.
- As mensagens seguem `docs/Base VA - Jhey's Cleaning.txt`. Não inventar duração estimada: a tabela disponível contém preços, não tempos.
- As mensagens de primeira resposta da Jhey’s usam tom acolhedor e promocional para novos clientes, destacando cuidado personalizado e valor do serviço. A faixa exibida já incorpora o preço introdutório para novos clientes; não informar percentual ou preço anterior que não esteja definido. Não devem inventar vagas, duração ou promessas de resultado.

## Desconto, recorrência e duração no painel

- O campo opcional **Discount %** aceita de 0 a 100 e aplica o percentual ao tipo selecionado em **Cleaning type**; vazio não menciona desconto. Nas cotações de preço fixo, ambos os limites da faixa são descontados e arredondados para cima em incrementos de US$5.
- Para um pedido recorrente de First Cleaning, o desconto informado vale para a primeira limpeza regular após a inicial; a mensagem informa o preço normal das visitas seguintes. Frequências quinzenal e mensal usam o preço da tabela mais uma faixa de US$30. Para semanal, o preço é confirmado após a primeira limpeza, sem inventar valor.
- KACS usa cobrança por hora e não aplica desconto ao serviço inicial; o campo permanece disponível.
- O painel e o formulário manual mostram abaixo do preço a estimativa de tempo usada na busca de disponibilidade. Nas empresas de preço fixo, essa duração é uma estimativa operacional derivada do teto da cotação, não uma duração confirmada pela equipe.

## Limitações de serviço nas mensagens de cotação

Somente quando a lead pedir o item correspondente, incluir os blocos abaixo logo depois da cotação. Quando houver uma única limitação, usar o aviso direto com `⚠️`. Quando houver duas ou mais, agrupá-las em uma única nota `🧼 A quick note about the additional services requested:` com bullets neutros, evitando uma sequência visual de alertas.

- Carpet ou rug: o aviso menciona somente o item solicitado. Para carpet, não há shampoo/extraction profissional e há vacuuming das áreas com carpete; para rug, não há shampoo/extraction profissional e há vacuuming dos tapetes. Se ambos forem solicitados, usar o aviso combinado de carpet e rug.
- Upholstery, sofa ou couch: não há limpeza profissional de estofados.
- Pet odor treatment: não há tratamento especializado ou garantia de remoção de odores; a equipe pode limpar profundamente as áreas e ajudar a reduzir odores.

## Confirmação direta e deduplicação

Os registros são locais no armazenamento do Chrome e usam o ID único da lead do Yelp como chave.

1. O painel calcula a proposta ou detecta a necessidade de informações.
2. **Confirm quote** ou **Request details** grava o registro como `approved` e copia a mensagem para a área de transferência na mesma ação.
3. **Copy details request** fica sempre disponível no painel da lead. O atendente seleciona individualmente square footage, bedrooms, bathrooms e/ou fotos das áreas principais; a ação copia apenas os detalhes marcados, mesmo que eles já estejam presentes na lead.
4. Não há uma etapa obrigatória de aprovação em fila.

Ao reabrir uma lead salva/aprovada/ajustada, não criar uma duplicata. O botão fica bloqueado e mostra o estado atual. Exceções:

- Uma lead `discarded` pode ser gerada novamente; o novo pedido substitui o registro descartado.
- Se um registro anterior usou a empresa errada, a extensão permite gerar uma versão corrigida.
- Se novos detalhes de produtos ou serviços adicionais estiverem mais completos do que o registro salvo, a extensão permite gerar uma versão corrigida.
- Mudanças em metragem, quartos ou banheiros também permitem recalcular e confirmar uma versão atualizada.
- Quando uma cotação já aprovada for alterada manualmente no painel (empresa, serviço, metragem, quartos ou banheiros), a extensão recalcula e atualiza imediatamente o registro e a mensagem da área de transferência. Como a duração pode mudar, quaisquer datas de disponibilidade anteriores são removidas até uma nova busca ser executada. Marcar ou desmarcar uma data compatível também atualiza a mensagem copiada.
- Pelo popup da extensão, em qualquer site, **Manual quote** abre um formulário para empresa, cliente, tipo de serviço, dimensões, localidade/endereço e serviços adicionais. O botão **Find availability** geocodifica a localidade e combina a duração estimada com a agenda Presto já lida da empresa; as vagas marcadas entram na mensagem copiada. Sem vagas, a mensagem pede as preferências do cliente, seguindo a regra existente.
- Como KACS e Jhey’s atendem somente a Califórnia, a busca de disponibilidade restringe a geocodificação manual a esse estado. A interface confirma o local resolvido antes de exibir vagas; uma busca ambígua como `Concord` deve confirmar uma localidade na Califórnia, nunca New Hampshire.
- Para leads já aprovadas/ajustadas, os botões **Copy follow-up 1**, **2**, **3** e **4** leem o texto visível da conversa atual do Yelp e reconhecem individualmente os trechos característicos de cada modelo da empresa. Um modelo que já aparece na conversa fica bloqueado, mas não há sequência obrigatória: a pessoa escolhe o follow-up adequado à situação. Ao lado deles, **Copy archiving** copia o texto de encerramento específico da empresa. Os botões apenas copiam; não enviam nem arquivam a lead no Yelp.

## Dados locais e privacidade

Todos os dados operacionais ficam no perfil local do Chrome, em `chrome.storage.local`:

- Cada cotação confirmada é armazenada pela chave única `lead:<id-da-lead-do-yelp>`.
- No popup da extensão, **Saved quotes** mostra as cotações salvas no perfil atual do Chrome. O histórico é usado também pelo painel do Yelp; seus estados são locais e não enviam mensagens nem alteram o Yelp. **Copy message** copia a mensagem salva e **Remove** remove individualmente uma cotação local, após confirmação, sem remover dados externos. O tipo Move-in/Move-out é escolhido no painel da própria página do Yelp.
- A agenda lida do Presto é armazenada por empresa em `prestoJobs:kacs` e `prestoJobs:jheys`.
- Uma nova leitura do Presto substitui o snapshot anterior daquela empresa.
- Esses dados não são gravados em arquivos do projeto, no Presto, no CRM ou no Cloudflare.
- O Cloudflare Worker recebe somente pedidos autenticados de geocodificação e rota; o token do Mapbox fica como secret do Worker.

## Disponibilidade futura via Presto

- O popup permite importar uma escala de disponibilidade de cleaners em `.xlsx` para qualquer empresa. A planilha deve ter um ou mais blocos com `Cleaner` na primeira coluna e cabeçalhos de data em `DD/MM`; o leitor aceita `Dia todo`, `A partir das 12:30 PM`, um horário isolado e intervalos explícitos. Os registros ficam apenas no armazenamento local do Chrome até serem substituídos ou limpos.
- Ao abrir um card Presto, o leitor mantém a captura ativa até o mapa/coordenadas aparecerem ou o timeout expirar. Preço e cleaner podem renderizar antes do mapa e não devem encerrar a captura antecipadamente.
- Para todas as empresas e fontes de agenda, a primeira janela de chegada possível é **8:30–9:00 AM**. Janelas calculadas ou importadas antes de 8:30 AM são normalizadas para 8:30 AM.
- Para KACS, o cálculo combina essas janelas importadas com a agenda roteirizada do Rafael no Presto. Cada janela importada representa outra equipe e só é oferecida se comportar toda a duração estimada do serviço.
- Uma janela importada é descartada se o mesmo cleaner tiver qualquer job naquele dia; jobs sem cleaner identificado bloqueiam a avaliação do dia. Isso é conservador porque a planilha não informa a rota da equipe.
- A leitura do Presto deve ser feita no mês atual e o snapshot deve ser do dia atual na Califórnia. A navegação para o próximo mês precisa ser confirmada; em caso de falha, a leitura não é salva. Por segurança, a busca não oferece horários no próprio dia.
- O leitor Presto aceita horários tanto em AM/PM quanto em 24 horas e reconhece os rótulos de preço `Preço:` e `Price:` usados pelas empresas.

O Presto será a fonte de verdade para agenda. KACS e Jhey's usam agendas independentes; uma disponibilidade nunca pode considerar jobs, equipes ou horários da outra empresa. Os cartões de job abertos expõem início, endereço, coordenadas do Google Maps, cleaner/equipe, tipo de serviço e preço.

- Horários oferecidos ao cliente são janelas fixas de chegada de 30 minutos, por exemplo `9:00–9:30 AM`.
- O painel de disponibilidade tem rolagem e pode ser movido ao arrastar o cabeçalho. Cada opção possui seleção individual; somente as opções marcadas entram na mensagem confirmada.
- Domingos nunca são oferecidos, mesmo quando a agenda estiver vazia.
- Para KACS e Jhey's, usar a duração prevista quando ela estiver disponível. Para KACS, isso normalmente é o limite superior da estimativa de horas da cotação.
- Quando não houver estimativa/duração disponível, a duração operacional é derivada do valor do serviço a US$100/h, arredondando para cima para o próximo intervalo de 30 minutos.
- A disponibilidade só é válida se couber entre os jobs relevantes, considerando duração do novo serviço, trânsito e margem operacional fixa de 30 minutos. Para a rota principal, KACS usa Rafael e Jhey’s usa Jheyce; janelas importadas são avaliadas por cleaner.
- Uma disponibilidade só pode ser oferecida se o fim estimado da nova limpeza for até **7:00 PM**. Se a duração estimada, somada ao horário de início sugerido, ultrapassar esse limite, o dia não pode ser sugerido.
- O cálculo deve avaliar cada gap entre jobs em ordem cronológica. Para encaixar uma limpeza, o intervalo deve comportar: **duração estimada da nova limpeza + 30 minutos de tolerância operacional + tempo de deslocamento entre uma limpeza e outra**. Em encaixes entre dois jobs, considerar o deslocamento do job anterior até a nova limpeza e da nova limpeza até o próximo job. Após o último job, usar seu término estimado como o início possível da nova limpeza; o término da nova limpeza deve continuar até 7:00 PM.
  - O término de cada limpeza é sempre estimado pelo seu valor operacional (preço ÷ US$100/h quando não houver duração explícita). Antes de aceitar um encaixe que tenha próximo job, a extensão soma o término da nova limpeza, a tolerância e o trajeto até o ZIP/localização do próximo job; se a chegada for posterior ao início desse job, o horário é rejeitado. Para uma faixa de preço, usa-se o teto como medida conservadora.
  - Ao calcular disponibilidade, cada horário sugerido deve mostrar o último job usado no cálculo, seu início, duração e término estimados, além dos minutos de trajeto até a lead (e, quando existir, da lead até o próximo job). Dias sem jobs devem declarar que não existe trajeto entre jobs a calcular.
- Endereços já agendados podem usar as coordenadas expostas pelo Presto. Leads do Yelp sem endereço completo devem ser tratadas apenas como estimativa por região até que o cliente informe o endereço.
- A versão com trânsito real usa o perfil `driving-traffic` do Mapbox Directions. O token do Mapbox fica somente no serviço intermediário. Sem o relay configurado ou funcional, a busca de rota falha e deve ser refeita; não se presume uma rota válida.
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

No painel da lead no Yelp, o botão **Debug** abre e fecha o diagnóstico. **Copy debug** copia o JSON com versão, rota, origem da captura, campos extraídos, cotação, registro existente e eventos recentes. Evite compartilhar dados pessoais além do necessário para diagnóstico. O debug da atualização foi retirado do popup; o controle **Verificar atualizações** continua disponível.

## Atualização da extensão no Windows

- Os VAs usam Chrome em computadores pessoais e carregam a extensão descompactada. O auxiliar local de Native Messaging é instalado uma vez por conta do Windows, com o ID da extensão e a pasta efetivamente carregada pelo Chrome. O instalador permite escolher essa pasta em uma janela; os caminhos podem variar entre VAs.
- Pelo popup, **Verificar atualizações** consulta o canal assinado. Quando há versão nova, o auxiliar valida o pacote, cria backup e atualiza a pasta configurada; a página do Yelp deve ser atualizada após a instalação. O canal e as instruções de instalação e publicação estão em `updater/NativeHost/README.md`.
- Dois perfis que carregam a mesma pasta e usam o mesmo ID compartilham os arquivos atualizados, mas seus dados em `chrome.storage.local` continuam separados por perfil. Se a pasta ou o ID forem diferentes, é necessário conferir a configuração do auxiliar para essa instalação.
- O teste piloto de `0.1.34` para `0.1.35` foi concluído pelo usuário, que confirmou também a atualização no segundo perfil com mesma pasta e ID. Esse resultado valida esse cenário, sem substituir testes em configurações diferentes.
- A versão `0.1.36` reúne as mudanças no popup e no debug do Yelp posteriores ao teste piloto.

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
node test-cleaner-availability.js
node --check content.js
node --check extractors.js
node --check quote-messages.js
```

Os testes cobrem as sete empresas com dados Apollo simulados, incluindo nomes de leads diferentes e ausência de nome. Os HTMLs reais disponíveis validaram KACS/Jacob e Da Silva/Alejandra; as demais contas ainda precisam de validação com suas próprias páginas. O Playwright está instalado para testes locais, mas o teste com HTML salvo da Da Silva apresentou falha e não comprova o funcionamento no Yelp real; a tentativa de acesso ao vivo recebeu HTTP 429. O fluxo acordado é testar no Chrome do atendente e compartilhar debug ou HTML quando necessário.
