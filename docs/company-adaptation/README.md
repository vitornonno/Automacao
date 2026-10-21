# Kit de adaptação para uma nova empresa

Use esta pasta quando a extensão precisar atender uma nova empresa de limpeza. Ela reúne as informações que precisam ser coletadas, os pontos de código que devem ser alterados e os testes de aceite.

Não salve aqui tokens, credenciais, exportações de leads, prints ou agenda de clientes. Esses materiais permanecem locais e ignorados pelo Git.

## Ordem recomendada

1. Preencha `COMPANY-PROFILE-TEMPLATE.md` com regras comerciais, contatos, tom e serviços.
2. Transcreva a tabela de preço ou tempo para o formato de `PRICING-TEMPLATE.md`; confirme como cada serviço é cobrado.
3. Reúna as mensagens de primeira resposta, de dados faltantes e os follow-ups em `MESSAGE-TEMPLATE.md`.
4. Abra o Presto da nova empresa, salve localmente um código-fonte da agenda e outro com um job aberto. Use `PRESTO-AND-VALIDATION.md` para validar os seletores antes de alterar o leitor.
5. Faça as mudanças técnicas indicadas em `TECHNICAL-CHECKLIST.md`.
6. Execute todos os cenários em `PRESTO-AND-VALIDATION.md` em um perfil Chrome separado da empresa.

## Princípios que não mudam

- A extensão calcula e copia textos; nunca envia mensagem, altera agenda ou cria reservas.
- Cada empresa tem chave própria, regras próprias e snapshot Presto próprio: `prestoJobs:<companyKey>`.
- Não misture preços, mensagens, agenda, dados ou tokens entre empresas.
- A proposta continua exigindo revisão humana antes do uso.

## Arquivos de referência do projeto

- `chrome-extension/pricing.js`: identificação da empresa, serviços, tamanhos e regras da cotação.
- `chrome-extension/quote-messages.js`: mensagens e reconhecimento de follow-ups.
- `chrome-extension/extractors.js`: nome da empresa e extração de campos da lead no Yelp.
- `chrome-extension/content.js`: painel, gravação local, clipboard e cálculo de disponibilidade.
- `chrome-extension/presto-content.js`: leitura somente de agenda Presto.
- `chrome-extension/test-pricing.js`: testes automatizados principais.
- `docs/EXTENSION-SPEC.md`: comportamento operacional vigente.
