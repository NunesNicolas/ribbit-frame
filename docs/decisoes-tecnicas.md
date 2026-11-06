# Decisões técnicas

## Plataforma

Aplicativo desktop para Windows com Electron, React, JavaScript e Vite. Electron permite avançar com o ambiente Node/npm existente; o custo aceito é maior consumo de memória e tamanho do pacote que uma solução nativa leve.

## Biblioteca local

Primeira implementação usa `catalog.json` com gravação atômica em `app.getPath('userData')`. Arquivos avulsos e downloads ficam em `media`; pastas vinculadas guardam apenas caminhos para arquivos originais e são reexaminadas ao listar. Não exige serviços externos. A migração para SQLite fica para quando escala/consultas justificarem uma dependência adicional.

## Nuvem e integrações posteriores

Google Drive é backup/sincronização opcional, sem exigir o Drive para computador. Não utilizar Google Cloud Console sem autorização explícita. A aba YouTube consulta vídeos via yt-dlp oficial baixado sob demanda, com checksum SHA-256 do mesmo release. FFmpeg é obtido sob demanda de release verificável do projeto FFmpeg-Builds, permitindo combinar faixas de áudio e vídeo e extrair áudio em MP3, M4A ou WAV. A aba Buscar imagens lê imagens no HTML de páginas públicas do Pinterest; não usa conta, API ou Google Cloud Console. Verificar direitos de uso da mídia antes da edição.

## Clipboard/Premiere

A aplicação copia pixels de imagens para o clipboard do Windows via Electron; a colagem no Premiere ainda precisa de validação. Áudio e vídeo oferecem cópia do caminho local e abertura do arquivo.

## Segurança Electron

Manter `nodeIntegration: false`, `contextIsolation: true` e sandbox. Expor ao renderer apenas operações pequenas via preload/IPC. Não aceitar caminhos arbitrários do renderer para leitura/escrita.

## Legendas locais

A aba de legendas chama `src/transcription.cjs` pelo preload/IPC. O backend valida mídia, formato, idioma, modelo e destino. Um processo Python local executa `src/transcribe.py` com Faster-Whisper e o modelo large-v3-turbo em CPU int8. O runtime e o modelo são preparados no primeiro uso e ficam na pasta de dados do app; depois funciona offline. Há uma transcrição por vez. A pasta padrão das legendas é `app.getPath('userData')/legendas`.


