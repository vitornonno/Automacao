# Presto VA Assistant

<img src="chrome-extension/presto-logo.png" alt="Logo Presto VA Assistant" width="128">

Uma extensão local do Chrome para ajudar equipes de limpeza a revisar leads do Yelp, montar cotações preliminares e sugerir disponibilidade antes da resposta manual ao cliente.

## Downloads e instalação no Windows

Na [release v0.1.39](https://github.com/vitornonno/Automacao/releases/tag/v0.1.39), baixe os arquivos separados:

- **Presto-VA-Assistant-v0.1.39.zip**: extensão para o Chrome.
- **Presto-VA-Assistant-auto-updater-v0.1.38.zip**: auxiliar que permite verificar e instalar atualizações da extensão.

Para uma instalação nova:

1. Extraia o ZIP da extensão em uma pasta permanente. No Chrome, abra `chrome://extensions`, ative **Modo do desenvolvedor** e selecione **Carregar sem compactação**. Escolha a pasta `chrome_extension` extraída.
2. Extraia o ZIP do atualizador e execute `Instalar-Atualizador.cmd`. Na janela, selecione a mesma pasta da extensão e informe o ID mostrado em `chrome://extensions`.
3. Reinicie o Chrome. No popup da extensão, use **Verificar atualizações**; após uma atualização, recarregue a página do Yelp.

**Quem já usa a extensão:** instale primeiro o auxiliar v0.1.38 antes de atualizar a extensão. Os auxiliares anteriores não reconhecem o novo nome ou o arquivo da logo. O canal automático permanece na v0.1.36 durante a migração; a v0.1.39 está disponível para download e ainda não é oferecida pelo botão.

Perfis do Chrome que carregam a mesma pasta e usam o mesmo ID compartilham os arquivos da extensão, mas mantêm seus dados locais separados. O auxiliar é configurado para a conta do Windows, o ID e a pasta selecionados. Veja as [instruções do atualizador](updater/NativeHost/README.md).

## O que ela faz

- Lê uma lead individual do Yelp e extrai dados como serviço, metragem, quartos, banheiros e solicitações adicionais.
- Prepara mensagens em inglês para revisão humana e copia a versão aprovada para a área de transferência.
- Lê a agenda do Presto somente em modo de consulta e calcula vagas compatíveis com duração, trânsito e margem operacional.
- Mantém confirmações e snapshots locais no perfil do Chrome; nunca envia uma mensagem ou altera uma agenda automaticamente.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `chrome-extension/` | Extensão Chrome: extração, cotação, mensagens e disponibilidade. |
| `route-relay/` | Worker Cloudflare que protege o token do Mapbox e fornece geocodificação/rotas. |
| `updater/` | Auxiliar Windows, validação de pacotes e ferramenta de publicação. |
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
npm test
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
