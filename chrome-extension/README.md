# Cleaning Lead Quote Assistant

Extensão Chrome para preparar cotações e consultar disponibilidade de leads. As mensagens são copiadas para revisão e envio manual; a extensão não envia mensagens nem altera a agenda.

A especificação operacional mantida está em [docs/EXTENSION-SPEC.md](../docs/EXTENSION-SPEC.md), incluindo as sete empresas, regras de desconto e recorrência, importação de escala, relay de rotas e limites de validação.

## Instalação

1. Abra `chrome://extensions` e ative **Developer mode**.
2. Selecione **Load unpacked** e escolha a pasta `chrome-extension`.
3. Após mudanças no projeto, recarregue a extensão e atualize a página do Yelp.
4. Revise a empresa, o tipo de limpeza e a cotação no painel; copie a mensagem e envie-a manualmente.

No popup, **Manual quote** permite inserir os dados para outros canais. **Saved quotes** mostra o histórico local do perfil; seus estados não enviam mensagens nem alteram o Yelp. A agenda do Presto é lida mediante ação do atendente, e o relay de rotas precisa estar configurado para buscas com deslocamento. No Yelp, **Debug** abre o diagnóstico e **Copy debug** copia seus dados para análise.

Para instalações configuradas com o auxiliar Windows, use **Verificar atualizações** no popup e atualize a página após a instalação. Consulte [as instruções do auxiliar](../updater/NativeHost/README.md).

## Verificação local

Execute nesta pasta:

```powershell
npm test
node --check content.js
node --check extractors.js
node --check quote-messages.js
```

Os testes automatizados não substituem a conferência no Yelp e no Presto. Consulte a especificação para os exemplos reais e limitações já identificadas.
