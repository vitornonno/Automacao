# Checklist técnico — nova empresa

## 1. Identificação da empresa

- [ ] Criar uma chave técnica única, por exemplo `novaempresa`.
- [ ] Em `pricing.js`, ampliar `resolveCompany()` para reconhecer todas as variações aprovadas do nome.
- [ ] Em `extractors.js`, ampliar `yelpBusinessNameFromText()` e, somente se necessário, o fallback de ID de conta Yelp.
- [ ] Em `presto-content.js`, ampliar `detectedCompany()` para reconhecer o nome da conta Presto.
- [ ] Confirmar no popup e nos logs que o snapshot será salvo em `prestoJobs:novaempresa`.

## 2. Cotação

- [ ] Acrescentar tabelas e regras da empresa em `pricing.js`.
- [ ] Definir o resultado da cotação: `fixed_price`, `time_only` ou revisão manual.
- [ ] Aplicar regras de tamanho, serviço, limite e combinações quarto/banheiro.
- [ ] Garantir que uma nova lead regular comece como First Cleaning somente se essa também for a política da nova empresa.
- [ ] Adicionar testes em `test-pricing.js` para todos os casos de fronteira.

## 3. Mensagens

- [ ] Criar mensagem de cotação, mensagem de tamanho faltante e assinatura em `quote-messages.js`.
- [ ] Incluir somente dados realmente solicitados ou disponíveis na lead.
- [ ] Configurar ressalvas para serviços adicionais quando aplicáveis.
- [ ] Cadastrar follow-ups como opções independentes e suas frases de detecção.
- [ ] Nunca introduzir envio automático: somente `navigator.clipboard.writeText`.

## 4. Disponibilidade e Presto

- [ ] Verificar que a duração prevista chega ao cálculo de disponibilidade.
- [ ] Confirmar horário de trabalho, domingos e limite de término da empresa.
- [ ] Fazer uma leitura da agenda e verificar cada job: `startTime`, coordenadas e `price`.
- [ ] Verificar que nenhuma agenda de outra empresa aparece no snapshot.
- [ ] Testar dias sem jobs, um job, dois jobs, jobs sobrepostos e mudança de mês.

## 5. Segurança e publicação

- [ ] Manter tokens, prints, código-fonte bruto, leads e documentos comerciais privados fora do Git.
- [ ] Atualizar `docs/EXTENSION-SPEC.md` com regras operacionais da nova empresa.
- [ ] Executar `node test-pricing.js`, `node --check content.js`, `node --check extractors.js`, `node --check quote-messages.js` e `node --check presto-content.js`.
- [ ] Conferir `git diff --check` antes de solicitar commit.
