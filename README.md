# Ribbit Frame

Aplicativo desktop local-first para catalogar, filtrar e sortear imagens, vídeos e áudios usados em edição.

## Iniciar desenvolvimento

Requisitos: Windows 10/11, Node.js 22+ e npm. Não exige Rust, Docker nem Google Drive para uso local.

```powershell
npm install
npm start
```

A janela Electron usa a interface React/Vite em `http://127.0.0.1:5174`. Para validar apenas a interface no navegador: `npm run dev`.

## Uso no navegador

### Pessoas e tags

Use **Adicionar pessoa** para cadastrar um nome mesmo antes de importar mídias. Selecione um arquivo, escolha a pessoa, informe tags separadas por vírgula e clique em **Salvar classificação**. O filtro de tags aceita várias marcações: a mídia precisa conter **todas** as tags selecionadas. Sem marcações, nenhuma restrição por tag é aplicada. Emoções cadastradas anteriormente aparecem como tags e são convertidas ao salvar a classificação. Pessoas cadastradas e tags são persistidas em cada biblioteca (navegador ou Electron).

O navegador também permite importar mídias, classificar, pesquisar e sortear. A navegação por pastas vinculadas e os downloads exigem o aplicativo desktop. Os arquivos ficam em IndexedDB, neste perfil de navegador e endereço, separados da biblioteca do Electron. Limpar os dados do site remove essa biblioteca. Imagens podem ser copiadas quando o navegador permite acesso ao clipboard; os demais arquivos podem ser exportados por download, pois o navegador não disponibiliza seus caminhos originais.

O Vite usa `.vite-cache` e recompila as dependências ao iniciar para evitar servir módulos de um cache inválido. Se uma aba antiga continuar branca, recarregue com `Ctrl+Shift+R`.

## Navegação e downloads

A aba **Explorar arquivos** mostra as coleções virtuais **Nativa** (arquivos avulsos), **Downloads** e as pastas vinculadas. Selecione uma pasta para listar suas mídias e aplique busca, tipo, pessoa e múltiplas tags. A ordenação pode ser alfabética ou por data de modificação do arquivo. O painel de sorteio usa a pasta selecionada e seus próprios filtros.

A aba **YouTube** consulta o título, capa e formatos disponíveis. Escolha a qualidade, selecione Downloads ou uma pasta vinculada, ou use **Escolher outra pasta…**. Durante o download, a interface mostra etapa e percentual quando fornecido pelo yt-dlp. A confirmação final exibe a pasta e o caminho do arquivo salvo. A aba **Buscar imagens** é separada do sorteio.

## Funcionalidades já implementadas

- Importação de arquivos avulsos e vínculo de pastas com subpastas no aplicativo desktop. Pastas vinculadas são lidas no local original e novas mídias são encontradas ao atualizar a biblioteca.
- Arquivos avulsos importados e downloads são salvos na pasta de dados do app; pastas vinculadas não são copiadas. Se uma pasta vinculada ficar indisponível, suas mídias aparecerão como ausentes.
- Catálogo local persistente em JSON dentro da pasta de dados Electron.
- Explorador de arquivos em painel lateral: busca, filtro por tipo, prévia, abrir arquivo e remoção do catálogo.
- Painel independente de sorteio, com filtros combinados por tipo, pessoa, tags e categoria.
- Copiar imagem para o clipboard do Windows; áudio e vídeo copiam o caminho local.
- Pesquisa e sorteio sem repetir o resultado anterior quando há alternativas; prévia de imagens, vídeos e áudios.
- Edição dos campos pessoa, tags e categoria; remoção do catálogo preserva o arquivo armazenado.
- Detecção de arquivos cujo original armazenado foi removido.

## Limitações atuais

- SQLite, miniaturas de vídeo/áudio na lista, favoritos, histórico, backup/sincronização Google Drive e instalador.
- Clipboard de imagem funciona para colar pixels em apps compatíveis. A colagem direta como clipe no Premiere não foi validada; áudio e vídeo copiam o caminho, não o arquivo como objeto.
- O yt-dlp e, quando necessário, o FFmpeg são obtidos automaticamente de releases oficiais do yt-dlp e do projeto FFmpeg-Builds (BtbN), com verificação SHA-256. Exige acesso ao GitHub e ao YouTube na primeira utilização.
- A aba Buscar imagens extrai URLs presentes no HTML de páginas públicas do Pinterest. Páginas dependentes de login ou renderização dinâmica podem retornar zero resultados.

## Armazenamento e segurança

Os arquivos importados e `catalog.json` ficam dentro de `app.getPath('userData')` do Electron. A importação avulsa copia arquivos; o vínculo de pastas apenas referencia os caminhos originais. Ao vincular uma pasta já importada, as entradas existentes que ainda têm fonte acessível passam a apontar para o original; cópias antigas não são apagadas automaticamente. No navegador, o vínculo de pastas está indisponível. O renderer acessa funções nativas exclusivamente pelo preload/IPC; `contextIsolation`, sandbox e `nodeIntegration: false` ficam habilitados. Google Drive será uma integração opcional; não usar Google Cloud Console sem decisão explícita do usuário.

## Build de interface

```powershell
npm run build
```

## Identidade visual

Marca Ribbit Frame com logo transparente fornecida pelo usuário. Paleta: verde #0E3D3A, creme #F5EFE6, roxo #9B59D1, laranja #FFB366 e grafite #222222. O nome visível e o pacote npm foram atualizados; os dados existentes continuam na pasta legada `foreditor` para preservar a biblioteca.

## Geração de legendas

Na aba **Legendas**, escolha um áudio ou vídeo já presente na biblioteca, o modelo large-v3-turbo, o idioma e o formato **SRT**, **VTT** ou **JSON**. Também é possível abrir essa aba pela prévia de uma mídia. O arquivo gerado vai para `Legendas` na pasta de dados do aplicativo, ou para outra pasta escolhida na interface. SRT pode ser importado no Premiere; JSON inclui intervalos por palavra.

A transcrição usa **Faster-Whisper** com o modelo **large-v3-turbo** em processo Python local. No primeiro uso, o app instala o runtime gerenciado e baixa o modelo; depois funciona offline. O idioma padrão é português, e o botão **Cancelar** encerra o processo. O modelo requer mais RAM e espaço em disco que as opções anteriores.



## Efeitos sonoros

A aba **Efeitos sonoros** pesquisa o catálogo do MyInstants pela API pública. É possível ouvir cada resultado, navegar pelas páginas e salvar o MP3 diretamente na biblioteca local, em Downloads ou em uma pasta vinculada. A API permite até 10 consultas por minuto sem autenticação.


## Instalador para Windows

O projeto usa `electron-builder` para gerar um instalador NSIS de 64 bits. Depois de `npm install`, execute `npm run dist` na raiz do repositório. O arquivo resultante fica em `release/Ribbit-Frame-Setup-<versão>.exe`. O instalador permite escolher a pasta de instalação e cria atalhos no menu Iniciar e na área de trabalho. Não exige Node.js, Python nem ferramentas de build no computador de quem instala.

Os dados da biblioteca ficam em `%APPDATA%\foreditor` e são preservados ao atualizar ou desinstalar. O instalador não publica arquivos automaticamente; a distribuição pode ser feita anexando o `.exe` a uma release do GitHub. A versão deve ser alterada em `package.json` antes de gerar uma nova release. Como o instalador ainda não é assinado digitalmente, o Windows pode mostrar um aviso do SmartScreen.

## Releases automáticas

O workflow `.github/workflows/release-windows.yml` roda a cada push para `main` e também pode ser iniciado manualmente em **Actions**. Em um runner Windows, ele executa `npm ci`, gera o instalador NSIS, compacta `release/win-unpacked` e publica ambos na aba **Releases** do repositório. Cada execução recebe uma tag única no formato `v<versão>-build.<número da execução>`. O ZIP contém a pasta portátil `win-unpacked`; abra `Ribbit Frame.exe` dentro dela. Não são necessários segredos adicionais: o workflow usa o `GITHUB_TOKEN` do próprio repositório com permissão de escrita em conteúdos. Para publicar uma nova versão numerada, atualize `version` em `package.json` e `package-lock.json` antes do push.

## Atualizações pelo aplicativo

Ao abrir a versão instalada, o Ribbit Frame consulta a release mais recente de `NunesNicolas/ribbit-frame` no GitHub. Se houver uma build mais nova, mostra um aviso com **Instalar atualização**. O app só baixa o instalador após o clique, verifica o SHA-256 informado pelo GitHub, abre o instalador e encerra o processo para permitir a atualização. Os arquivos da biblioteca em `%APPDATA%\foreditor` permanecem no lugar. A versão de desenvolvimento não consulta atualizações. O workflow grava o número da build no pacote para que o app não ofereça a mesma release novamente.
