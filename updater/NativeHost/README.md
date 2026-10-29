# Auxiliar local do Chrome

Este componente é um host de Native Messaging para Windows. Ele usa a chave pública `TrustedUpdateKey.pem` incorporada no executável para conferir o canal de atualizações. Uma compilação `Release` falha se a chave pública estiver ausente. O host não recebe a chave privada.

Para gerar o executável de distribuição, primeiro configure a chave pública de produção e execute:

```powershell
dotnet publish updater/NativeHost/NativeHost.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

Distribua `CleaningUpdaterHost.exe` junto de `Instalar-Atualizador.cmd`. O VA abre o CMD, fornece a pasta efetivamente carregada pelo Chrome e o ID correspondente exibido em `chrome://extensions`, confirma ambos, e reinicia o Chrome. O auxiliar é instalado em `%LOCALAPPDATA%\CleaningLeadUpdater` e registrado somente para a conta do Windows e para esse ID. Não altera políticas corporativas. Após a configuração, use o botão da extensão para verificar atualizações.

Uma instalação descompactada pode ter um ID diferente em cada pasta. Verifique cuidadosamente que o ID e a pasta informados pertencem à mesma instalação: o Chrome não fornece o caminho da extensão ao host. A troca posterior de pasta requer uma reinstalação cuidadosamente planejada; não apague a extensão antiga enquanto os dados não forem conferidos. O setup recusa substituir uma configuração de outra instalação.

O canal é `https://github.com/vitornonno/Automacao/releases/download/update-channel/`; deve conter `update.json` e `update.sig`. O manifesto assinado aponta para o pacote da versão. O host valida assinatura, tamanho, URL oficial, versão e hash antes de instalar. A atualização usa somente a pasta configurada. Backups são mantidos pelo instalador de pacote; não os remova antes de confirmar que a nova versão funciona.

Nenhuma atualização pode ser instalada até que a chave pública, o executável e o canal sejam preparados e testados juntos. Nunca distribua ou publique a chave privada.
