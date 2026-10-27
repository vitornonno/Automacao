# Onboarding de novas empresas

Esta pasta guarda o planejamento de empresas que ainda serao integradas a extensao. Ela nao contem dados brutos de clientes, capturas de tela, credenciais ou planilhas comerciais sensiveis.

## Decisao de arquitetura

Usar o projeto e a extensao atuais como base. Cada empresa deve ter um perfil proprio de precificacao, mensagens, disponibilidade e leitura Presto quando necessario. Um fork so deve ser criado se o novo fluxo for estruturalmente incompativel, exigir outro produto ou canal principal, ou precisar de manutencao e liberacoes independentes.

## Como usar

1. Copie `NEW-COMPANY-CHECKLIST.md` para uma pasta com o nome da empresa.
2. Registre as respostas e os exemplos necessarios antes de alterar codigo.
3. Para uma empresa com fluxo diferente, descreva primeiro as etapas e excecoes em `FLOW-DISCOVERY.md`.
4. Decida se a integracao entra no projeto principal ou justifica um fork somente depois dessa descoberta.

## Empresas em descoberta

- [Felix Prime Cleaning](felix-prime-cleaning/FLOW-DISCOVERY.md) — candidata a fork, pois o fluxo e diferente; mapear antes de iniciar a implementacao.
