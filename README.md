# Cleaning Lead Quote Assistant

Uma extensão local do Chrome para ajudar equipes de limpeza a revisar leads do Yelp, montar cotações preliminares e sugerir disponibilidade antes da resposta manual ao cliente.

## O que ela faz

- Lê uma lead individual do Yelp e extrai dados como serviço, metragem, quartos, banheiros e solicitações adicionais.
- Aplica as regras independentes de cotação para KACS e Jhey’s Cleaning.
- Prepara mensagens em inglês para revisão humana e copia a versão aprovada para a área de transferência.
- Lê a agenda do Presto somente em modo de consulta e calcula vagas compatíveis com duração, trânsito e margem operacional.
- Mantém confirmações e snapshots locais no perfil do Chrome; nunca envia uma mensagem ou altera uma agenda automaticamente.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `chrome-extension/` | Extensão Chrome: extração, cotação, mensagens e disponibilidade. |
| `route-relay/` | Worker Cloudflare que protege o token do Mapbox e fornece geocodificação/rotas. |
| `docs/EXTENSION-SPEC.md` | Especificação operacional e regras de negócio. |

## Uso local

1. Abra `chrome://extensions` no Chrome.
2. Ative **Developer mode**.
3. Clique em **Load unpacked** e selecione `chrome-extension/`.
4. Abra uma lead individual no Yelp e revise a proposta no painel.

O envio continua manual: a extensão apenas copia a mensagem aprovada para que o atendente a cole no Yelp.

## Desenvolvimento e validação

No diretório `chrome-extension/`:

```powershell
node test-pricing.js
node --check content.js
node --check extractors.js
node --check quote-messages.js
```

## Privacidade

Capturas de tela, dados brutos de leads, roteiros internos, planilhas comerciais, memória local e cache do Worker permanecem apenas na máquina. Esses arquivos estão deliberadamente listados no `.gitignore` e não fazem parte do repositório.

## Limites

- Não envia mensagens, cria reservas ou modifica dados no Yelp ou Presto.
- Uma pessoa deve revisar toda cotação e toda disponibilidade antes de responder ao cliente.
- Tokens e segredos devem permanecer fora do código e do controle de versão.
