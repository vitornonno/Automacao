# Atualizações automáticas da extensão

## Objetivo atualizado

Distribuir atualizações da extensão aos VAs sem reenviar um ZIP a cada versão. Foi escolhido um auxiliar local para Windows com botão de verificação na extensão, preservando a pasta da extensão descompactada e seus dados. A alternativa anterior de instalação gerenciada ficou suspensa porque os computadores são pessoais.

## Arquitetura do auxiliar

- A extensão deve usar a API Chrome Native Messaging para solicitar ao auxiliar a verificação e instalação. O registro do host no Windows deve permitir apenas o ID exato da extensão instalada pelo usuário; IDs de instalações descompactadas podem ser diferentes entre computadores.
- O auxiliar é instalado uma única vez por VA, no perfil do Windows. Cada VA indica a pasta real em que sua extensão descompactada está instalada; não se presume um caminho igual para todos. O instalador deve verificar o caminho absoluto, o manifesto e o ID efetivamente carregado em `chrome://extensions`, associando o host ao ID correto antes de gravar a configuração local. Deve recusar caminhos ausentes ou divergentes e nunca aceitar caminhos de atualização enviados arbitrariamente por uma página ou lead. A atualização conserva o mesmo diretório; uma mudança posterior de pasta requer reconfiguração e validação do ID e dos dados.
- O auxiliar consulta o repositório oficial, identifica uma versão superior e baixa para uma área temporária. A validação deve comprovar a autenticidade do pacote com uma assinatura independente da conta/release do GitHub, usando chave pública embutida no auxiliar e chave privada guardada fora do repositório. Um hash publicado junto do ZIP detecta corrupção, mas sozinho não protege contra alteração simultânea dos dois arquivos.
- O pacote deve ser extraído em área temporária com limites de tamanho e validação de caminhos, conteúdo permitido, versão e manifesto. A instalação deve guardar backup recuperável e restaurá-lo em caso de falha. Não substituir a pasta inteira nem apagar arquivos do usuário.
- Após sucesso confirmado, a extensão chama `chrome.runtime.reload()` e apresenta uma orientação para atualizar a página do Yelp. O teste piloto deve verificar que o ID e `chrome.storage.local` são preservados, assim como a fila e a configuração do relay.
- O auxiliar e o botão foram implementados, mas ainda precisam de teste integrado no Chrome real e de publicação do canal assinado. É necessária uma etapa inicial de distribuição e registro; os VAs devem ser informados do que o programa faz.

Referências: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging e https://developer.chrome.com/docs/extensions/reference/api/runtime/.

## Preparação de releases assinadas

A ferramenta `updater/ReleaseTool` prepara os três arquivos usados pelo canal de atualização. Ela não publica nada automaticamente. A chave de produção foi criada no perfil local do responsável; **não execute novamente o comando abaixo para uma instalação existente**, pois uma chave diferente quebraria a confiança dos auxiliares já distribuídos. Este comando serve somente para configurar uma nova identidade de publicação:

```powershell
dotnet run --project updater/ReleaseTool -- keygen "C:\LocalSeguro\cleaning-update-private.pem" "updater/NativeHost/TrustedUpdateKey.pem"
```

O comando cria uma chave RSA de 3072 bits e recusa sobrescrever chaves existentes. Guarde e faça backup da chave privada em local protegido; não a envie aos VAs, não a coloque no repositório e não a inclua em releases ou CI público. A chave pública `TrustedUpdateKey.pem` será incorporada ao executável do auxiliar no momento da compilação; uma chave diferente invalida as atualizações para auxiliares já instalados. Não gere uma nova chave a cada release. Antes de produção, deve-se conferir a proteção de acesso local ao arquivo privado e o plano de recuperação e rotação da chave.

Para preparar uma versão cujo `manifest.json` já tenha uma versão superior à distribuída, escolha um diretório de saída que ainda não exista:

```powershell
dotnet run --project updater/ReleaseTool -- build chrome-extension "C:\LocalSeguro\cleaning-update-private.pem" "C:\LocalSeguro\release-v1.2.3"
```

A ferramenta inclui exclusivamente os arquivos necessários da extensão dentro da pasta `chrome_extension`, gera o ZIP, `update.json` e `update.sig`, e verifica a assinatura e o hash antes de concluir. O JSON contém versão, SHA-256 e URL HTTPS do ZIP na release `v<versão>` deste repositório; a assinatura destacada é RSA-PSS com SHA-256, sobre os bytes exatos do JSON. Não edite `update.json` após assiná-lo.

Após testes e autorização para publicar, primeiro anexe o ZIP à release correspondente e confirme que ele está acessível no endereço assinado. Só então atualize **ambos** os assets `update.json` e `update.sig` da release `update-channel`. Trocar esses dois arquivos não é atômico: durante a troca a assinatura pode temporariamente falhar e o usuário deverá tentar novamente; nunca desabilitar a validação para contornar isso. A primeira instalação do auxiliar exige preparação e distribuição específicas; a existência dos arquivos assinados não prova que o fluxo completo esteja pronto.

Teste de ponta a ponta local da ferramenta: `dotnet run --project updater/ReleaseTool.Tests/ReleaseTool.Tests.csproj`. A chave de teste é criada em uma pasta temporária e nunca usada em produção.

## Alternativa suspensa: política corporativa

Os VAs usam computadores pessoais. O Chrome restringe instalações automáticas de extensões fora da Chrome Web Store em Windows a ambientes gerenciados elegíveis. Uma alternativa a investigar é inscrever os navegadores no Chrome Enterprise Core, oferecido pelo Google sem custo adicional. Isso gerencia o navegador no dispositivo, pode afetar todos os perfis, inclusive pessoais, e requer consentimento informado dos usuários. A viabilidade específica da distribuição externa deve ser confirmada em um piloto; não presumir que uma alteração isolada no registro funcione.

Referências: https://support.google.com/chrome/a/answer/7532015?hl=en, https://support.google.com/chrome/a/answer/9116814?hl=en e https://support.google.com/chrome/a/answer/15591684?hl=en.

### Processo anterior (não escolhido)

1. Confirmar o sistema operacional e a forma de gerenciamento dos Chromes dos VAs.
2. Criar um pacote CRX assinado e preservar a chave privada em local seguro e separado do repositório. O mesmo par de chaves deve assinar as versões posteriores para manter o ID da extensão.
3. Hospedar o CRX e um manifesto de atualização XML em endereços HTTPS estáveis. O endereço de atualização deve permanecer estável; o XML deve apontar para o pacote e sua versão.
4. Testar a instalação e uma atualização real em um navegador gerenciado de piloto antes de disponibilizar a política aos VAs. Conferir a política em `chrome://policy` e a versão em `chrome://extensions`.
5. Em cada versão, aumentar a versão do manifesto, validar, assinar com a mesma chave, publicar o CRX e atualizar o XML somente depois de verificar que o pacote está acessível.

O repositório GitHub é público: o pacote e manifesto nele publicados serão acessíveis publicamente. Nunca publicar chaves privadas, tokens, HTMLs de leads ou dados de clientes. Uma política de instalação forçada pode impedir que os usuários desativem ou removam a extensão; a administração deve avaliar o alcance antes de aplicá-la.

## Migração e segurança dos dados

Uma nova instalação pode ter outro ID e, portanto, outro armazenamento local. Antes de remover a extensão descompactada, planejar e testar a migração da fila, escala importada e configuração do relay; não copiar ou expor o token em arquivos públicos. Manter a instalação anterior até a conferência da nova e decidir com cada VA como transportar os dados necessários.

O relay de rotas é separado da extensão; não precisa ser reinstalado no computador, mas a nova instalação precisa da configuração adequada para acessá-lo.

## Estado atual

A chave de produção foi criada fora do repositório em `C:\Users\vitor\AppData\Local\CleaningLeadSigning\update-private.pem`. Ela deve receber backup protegido antes de distribuição. A chave pública está incorporada ao executável preparado. Os testes locais simulados e de assinatura passaram; o auxiliar ainda não foi instalado nos VAs e o canal assinado ainda não foi publicado. O ZIP de instalação inicial preparado localmente não comprova que a atualização completa funciona no Chrome real.
