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
