const { app, BrowserWindow, dialog, ipcMain, protocol, net, clipboard, nativeImage, shell, session, Menu } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const webTools = require('./web-tools.cjs');
const transcription = require('./transcription.cjs');
// Preserve a biblioteca já criada antes da mudança de nome.
const existingDataPath = path.join(app.getPath('appData'), 'foreditor');
fsSync.mkdirSync(existingDataPath, { recursive: true });
app.setPath('userData', existingDataPath);
app.setName('Ribbit Frame');

protocol.registerSchemesAsPrivileged([{ scheme: 'foreditor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const extensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);
const mediaType = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)) return 'Imagem';
  if (['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'].includes(ext)) return 'Vídeo';
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].includes(ext)) return 'Áudio';
  return null;
};
const catalogFile = () => path.join(app.getPath('userData'), 'catalog.json');
const mediaDirectory = () => path.join(app.getPath('userData'), 'media');
const toolsDirectory = () => path.join(app.getPath('userData'), 'tools');
const foldersFile = () => path.join(app.getPath('userData'), 'folders.json');
const excludedFile = () => path.join(app.getPath('userData'), 'excluded-paths.json');
async function readExcluded() { try { return JSON.parse(await fs.readFile(excludedFile(), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
let catalogQueue = Promise.resolve();
function catalogOperation(action) { const next = catalogQueue.then(action); catalogQueue = next.catch(() => {}); return next; }
async function readFolders() { try { return JSON.parse(await fs.readFile(foldersFile(), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
async function writeFolders(folders) { await fs.mkdir(path.dirname(foldersFile()), { recursive: true }); await fs.writeFile(foldersFile() + '.tmp', JSON.stringify(folders, null, 2)); await fs.rename(foldersFile() + '.tmp', foldersFile()); }

async function readCatalog() {
  try {
    const data = JSON.parse(await fs.readFile(catalogFile(), 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function writeCatalog(items) {
  const file = catalogFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(items, null, 2), 'utf8');
  await fs.rename(temp, file);
}

async function readPeople() {
  try { return JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'people.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
ipcMain.handle('people:list', async () => [...new Set([...(await readPeople()), ...(await readCatalog()).map(item => item.person).filter(Boolean)])]);
let peopleQueue = Promise.resolve();
ipcMain.handle('people:add', (_event, name) => {
  const operation = peopleQueue.then(async () => {
    const trimmed = String(name ?? '').trim().slice(0, 120);
    if (!trimmed) throw new Error('Informe o nome da pessoa.');
    const people = await readPeople();
    if (!people.some(person => person.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) people.push(trimmed);
    const file = path.join(app.getPath('userData'), 'people.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file + '.tmp', JSON.stringify(people), 'utf8');
    await fs.rename(file + '.tmp', file);
    return people;
  });
  peopleQueue = operation.catch(() => {});
  return operation;
});
const taxonomyFile = () => path.join(app.getPath('userData'), 'taxonomy.json');
async function readTaxonomy() {
  try { return JSON.parse(await fs.readFile(taxonomyFile(), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { tags: [], categories: [] }; throw error; }
}
async function writeTaxonomy(data) {
  await fs.writeFile(taxonomyFile() + '.tmp', JSON.stringify(data), 'utf8');
  await fs.rename(taxonomyFile() + '.tmp', taxonomyFile());
}
async function writePeople(people) {
  const file = path.join(app.getPath('userData'), 'people.json');
  await fs.writeFile(file + '.tmp', JSON.stringify(people), 'utf8');
  await fs.rename(file + '.tmp', file);
}
ipcMain.handle('taxonomy:list', async () => {
  const [catalog, saved, people] = await Promise.all([readCatalog(), readTaxonomy(), readPeople()]);
  const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return {
    people: unique([...people, ...catalog.map(item => item.person)]),
    tags: unique([...(saved.tags || []), ...catalog.flatMap(item => Array.isArray(item.tags) ? item.tags : item.emotion ? [item.emotion] : [])]),
    categories: unique([...(saved.categories || []), ...catalog.map(item => item.category)]),
  };
});
ipcMain.handle('taxonomy:add', (_event, { kind, name }) => catalogOperation(async () => {
  if (!['people', 'tags', 'categories'].includes(kind) || typeof name !== 'string') throw new Error('Classificação inválida.');
  const value = name.trim().slice(0, 120);
  if (!value) throw new Error('Informe um nome.');
  if (kind === 'people') {
    const people = await readPeople();
    if (!people.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { people.push(value); await writePeople(people); }
  } else {
    const saved = await readTaxonomy();
    saved[kind] ||= [];
    if (!saved[kind].some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { saved[kind].push(value); await writeTaxonomy(saved); }
  }
  return true;
}));
ipcMain.handle('taxonomy:remove', (_event, { kind, name }) => catalogOperation(async () => {
  if (!['people', 'tags', 'categories'].includes(kind) || typeof name !== 'string' || !name.trim()) throw new Error('Classificação inválida.');
  const catalog = await readCatalog();
  for (const item of catalog) {
    if (kind === 'people' && item.person === name) item.person = '';
    if (kind === 'categories' && item.category === name) item.category = '';
    if (kind === 'tags') {
      item.tags = (Array.isArray(item.tags) ? item.tags : item.emotion ? [item.emotion] : []).filter(tag => tag !== name);
      delete item.emotion;
    }
  }
  await writeCatalog(catalog);
  if (kind === 'people') await writePeople((await readPeople()).filter(item => item !== name));
  else { const saved = await readTaxonomy(); saved[kind] = (saved[kind] || []).filter(item => item !== name); await writeTaxonomy(saved); }
  return true;
}));ipcMain.handle('media:choose-destination', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Escolha a pasta para salvar o download' });
  if (result.canceled) return null;
  const root = result.filePaths[0];
  await catalogOperation(async () => { const folders = await readFolders(); if (!folders.some(folder => folder.toLowerCase() === root.toLowerCase())) { folders.push(root); await writeFolders(folders); } });
  return root;
});
ipcMain.handle('media:folders', async () => [{ id: 'native', name: 'Nativa', kind: 'native', path: mediaDirectory() }, { id: 'downloads', name: 'Downloads', kind: 'downloads', path: mediaDirectory() }, ...(await readFolders()).map(root => ({ id: root, name: path.basename(root), kind: 'linked', path: root }))]);
let lastFolderSync = 0;
ipcMain.handle('media:list', async (_event, force = false) => {
  const items = await catalogOperation(async () => {
    if (!force && Date.now() - lastFolderSync < 30000) return readCatalog();
    const catalog = await syncFolders();
    lastFolderSync = Date.now();
    return catalog;
  });
  const output = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(16, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      try {
        const stat = await fs.stat(item.path);
        output[index] = { ...item, missing: false, url: 'foreditor://media/' + encodeURIComponent(item.id), size: stat.size, modifiedAt: stat.mtimeMs };
      } catch {
        output[index] = { ...item, missing: true, url: null, size: 0, modifiedAt: null };
      }
    }
  }));
  return output;
});ipcMain.handle('media:copy', async (_event, id) => {
  const item = (await readCatalog()).find((entry) => entry.id === id);
  if (!item || item.type !== 'Imagem') throw new Error('Imagem não encontrada no catálogo.');
  const image = nativeImage.createFromPath(item.path);
  if (image.isEmpty()) throw new Error('Não foi possível abrir esta imagem para copiar.');
  clipboard.writeImage(image);
  return true;
});
ipcMain.handle('media:open', async (_event, id) => {
  const item = (await readCatalog()).find((entry) => entry.id === id);
  if (!item) throw new Error('Mídia não encontrada no catálogo.');
  return shell.openPath(item.path);
});
ipcMain.handle('media:import', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Mídias compatíveis', extensions: [...extensions].map((ext) => ext.slice(1)) }] });
  if (result.canceled) return [];
  return catalogOperation(() => importPaths(result.filePaths));
});
ipcMain.handle('media:import-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return [];
  return catalogOperation(async () => {
    const root = result.filePaths[0];
    const folders = await readFolders();
    if (!folders.some(folder => folder.toLowerCase() === root.toLowerCase())) { folders.push(root); await writeFolders(folders); }
    const catalog = await readCatalog();
    let migrated = false;
    for (const item of catalog) {
      if (!item.sourcePath || item.folderRoot || !path.isAbsolute(item.sourcePath)) continue;
      const relative = path.relative(root, item.sourcePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      try { await fs.access(item.sourcePath); item.path = item.sourcePath; item.folderRoot = root; item.relativePath = relative; migrated = true; } catch {}
    }
    if (migrated) await writeCatalog(catalog);
    const before = catalog.length;
    const items = await syncFolders();
    return items.slice(before);
  });
});
async function syncFolders() {
  const catalog = await readCatalog();
  const known = new Set([...(await readExcluded()), ...catalog.flatMap(item => [item.sourcePath, item.folderRoot ? item.path : null]).filter(Boolean)].map(value => value.toLowerCase()));
  let changed = false;
  async function visit(root, directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const sourcePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(root, sourcePath);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()) && !known.has(sourcePath.toLowerCase())) {
        catalog.push({ id: crypto.randomUUID(), name: entry.name, relativePath: path.relative(root, sourcePath), path: sourcePath, sourcePath, folderRoot: root, type: mediaType(entry.name), category: '', person: '', tags: [], createdAt: new Date().toISOString() });
        known.add(sourcePath.toLowerCase()); changed = true;
      }
    }
  }
  for (const root of await readFolders()) {
    try { await visit(root, root); }
    catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error; }
  }
  if (changed) await writeCatalog(catalog);
  return catalog;
}
async function importPaths(filePaths, folderRoot = null) {
  const catalog = await readCatalog();
  const known = new Set(catalog.map((item) => item.sourcePath));
  await fs.mkdir(mediaDirectory(), { recursive: true });
  const added = [];
  for (const sourcePath of filePaths) {
    if (!mediaType(sourcePath) || known.has(sourcePath)) continue;
    const id = crypto.randomUUID();
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(mediaDirectory(), `${id}${path.extname(fileName).toLowerCase()}`);
    await fs.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    const item = { id, name: fileName, relativePath: folderRoot ? path.relative(folderRoot, sourcePath) : fileName, path: targetPath, sourcePath, type: mediaType(fileName), category: '', person: '', tags: [], createdAt: new Date().toISOString() };
    catalog.push(item);
    added.push(item);
    known.add(sourcePath);
  }
  await writeCatalog(catalog);
  return added;
}
ipcMain.handle('media:update', (_event, { id, category, person, tags }) => catalogOperation(async () => {
  const catalog = await readCatalog();
  const item = catalog.find((entry) => entry.id === id);
  if (!item) throw new Error('Mídia não encontrada no catálogo.');
  item.category = String(category ?? '').slice(0, 120);
  item.person = String(person ?? '').slice(0, 120);
  if (!Array.isArray(tags) || tags.length > 100 || tags.some(tag => typeof tag !== 'string')) throw new Error('Tags inválidas.');
  item.tags = [...new Set(tags.map(tag => tag.trim().slice(0, 120)).filter(Boolean))];
  delete item.emotion;
  await writeCatalog(catalog);
  return item;
}));
ipcMain.handle('media:update-batch', (_event, { ids, person, category, tags }) => catalogOperation(async () => {
  if (!Array.isArray(ids) || !ids.length || ids.length > 10000 || ids.some(id => typeof id !== 'string')) throw new Error('Seleção inválida.');
  if (person !== undefined && (typeof person !== 'string' || person.length > 120)) throw new Error('Pessoa inválida.');
  if (category !== undefined && (typeof category !== 'string' || category.length > 120)) throw new Error('Categoria inválida.');
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 100 || tags.some(tag => typeof tag !== 'string' || tag.length > 120))) throw new Error('Tags inválidas.');
  const catalog = await readCatalog();
  const targets = new Set(ids);
  if (new Set(catalog.map(item => item.id).filter(id => targets.has(id))).size !== targets.size) throw new Error('Uma das mídias não foi encontrada.');
  const cleanTags = tags?.map(tag => tag.trim()).filter(Boolean) || [];
  for (const item of catalog) {
    if (!targets.has(item.id)) continue;
    if (person !== undefined) item.person = person.trim();
    if (category !== undefined) item.category = category.trim();
    if (tags !== undefined) item.tags = [...new Set([...(Array.isArray(item.tags) ? item.tags : item.emotion ? [item.emotion] : []), ...cleanTags])].slice(0, 100);
    delete item.emotion;
  }
  await writeCatalog(catalog);
  return catalog.filter(item => targets.has(item.id));
}));
ipcMain.handle('media:remove', (_event, id) => catalogOperation(async () => {
  const catalog = await readCatalog();
  const item = catalog.find((entry) => entry.id === id);
  if (!item) return false;
  if (item.folderRoot) { const excluded = await readExcluded(); excluded.push(item.sourcePath); await fs.writeFile(excludedFile() + '.tmp', JSON.stringify(excluded)); await fs.rename(excludedFile() + '.tmp', excludedFile()); }
  await writeCatalog(catalog.filter((entry) => entry.id !== id));
  return true;
}));


async function addDownloaded(sourcePath, displayName, sourceUrl, folderRoot = null) {
  const catalog = await readCatalog();
  const id = crypto.randomUUID();
  const existing = catalog.find(entry => entry.path === sourcePath);
  if (existing) { Object.assign(existing, { name: displayName, sourcePath: sourceUrl, folderRoot, downloaded: true }); await writeCatalog(catalog); return existing; }
  const item = { id, name: displayName, relativePath: displayName, path: sourcePath, sourcePath: sourceUrl, folderRoot, downloaded: true, type: mediaType(sourcePath), category: '', person: '', tags: [], createdAt: new Date().toISOString() };
  if (!item.type) throw new Error('Formato de mídia não compatível.');
  catalog.push(item);
  await writeCatalog(catalog);
  return item;
}
ipcMain.handle('web:youtube-formats', (_event, url) => webTools.formats(url, path.join(app.getPath('userData'), 'tools')));
ipcMain.handle('web:youtube-download', async (event, { url, formatId, folderId }) => {
  const roots = await readFolders();
  if (folderId !== 'downloads' && !roots.includes(folderId)) throw new Error('Selecione uma pasta de destino válida.');
  const destination = folderId === 'downloads' ? mediaDirectory() : folderId;
  if (folderId !== 'downloads' && !(await fs.stat(destination).catch(() => null))?.isDirectory()) throw new Error('Pasta de destino indisponível.');
  const send = value => { if (!event.sender.isDestroyed()) event.sender.send('web:progress', value); };
  send({ phase: 'preparing', percent: null, label: 'Preparando ferramentas e destino…' });
  const result = await webTools.download(url, formatId, toolsDirectory(), destination, send);
  const item = await catalogOperation(() => addDownloaded(result.path, result.name, url, folderId === 'downloads' ? null : folderId));
  send({ phase: 'saved', percent: 100, label: 'Download salvo e incluído na biblioteca.' });
  return { ...item, folderName: folderId === 'downloads' ? 'Downloads' : path.basename(folderId) };
});
const generatedSubtitles = new Set();
const subtitleDestinations = new Set();
ipcMain.handle('transcription:destination', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Pasta para salvar as legendas' });
  if (result.canceled) return null;
  subtitleDestinations.add(result.filePaths[0]);
  return result.filePaths[0];
});
ipcMain.handle('transcription:run', async (event, { id, model, language, format, destination }) => {
  if (model !== 'large-v3-turbo' || !['auto', 'pt', 'en', 'es'].includes(language) || !['srt', 'vtt', 'json'].includes(format)) throw new Error('Opções de transcrição inválidas.');
  const item = (await readCatalog()).find(entry => entry.id === id);
  if (!item || !['Áudio', 'Vídeo'].includes(item.type)) throw new Error('Selecione um áudio ou vídeo da biblioteca.');
  if (!(await fs.stat(item.path).catch(() => null))?.isFile()) throw new Error('Arquivo de origem indisponível.');
  if (destination && !subtitleDestinations.has(destination)) throw new Error('Escolha a pasta de destino no aplicativo.');
  const outputFolder = destination || path.join(app.getPath('userData'), 'legendas');
  if (destination && !(await fs.stat(destination).catch(() => null))?.isDirectory()) throw new Error('Pasta de destino indisponível.');
  const send = value => { if (!event.sender.isDestroyed()) event.sender.send('transcription:progress', value); };
  const result = await transcription.transcribe(path.join(app.getPath('userData'), 'transcription'), item.path, outputFolder, { model, language, format }, send);
  generatedSubtitles.add(result.path);
  return result;
});
ipcMain.handle('transcription:cancel', () => transcription.cancel());
ipcMain.handle('transcription:show', async (_event, file) => {
  if (!generatedSubtitles.has(file) || !(await fs.stat(file).catch(() => null))?.isFile()) throw new Error('Legenda indisponível.');
  const actual = file;
  shell.showItemInFolder(actual);
  return true;
});
const pinterestSession = () => session.fromPartition('persist:ribbit-pinterest');
ipcMain.handle('accounts:pinterest-status', async () => {
  const cookies = await pinterestSession().cookies.get({ domain: 'pinterest.com' });
  return { connected: cookies.some(cookie => cookie.name === '_pinterest_sess' && cookie.value) };
});
ipcMain.handle('accounts:pinterest-login', async () => {
  const loginWindow = new BrowserWindow({ width: 1050, height: 780, title: 'Entrar no Pinterest · Ribbit Frame', autoHideMenuBar: true, webPreferences: { partition: 'persist:ribbit-pinterest', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await loginWindow.loadURL('https://www.pinterest.com/login/');
  return true;
});
ipcMain.handle('accounts:pinterest-open', async (_event, query) => {
  const term = String(query || '').trim().slice(0, 120);
  const url = term ? 'https://www.pinterest.com/search/pins/?q=' + encodeURIComponent(term) : 'https://www.pinterest.com/';
  const browser = new BrowserWindow({ width: 1150, height: 820, title: 'Pinterest · Ribbit Frame', autoHideMenuBar: true, webPreferences: { partition: 'persist:ribbit-pinterest', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await browser.loadURL(url);
  return true;
});ipcMain.handle('accounts:pinterest-disconnect', async () => {
  const cookies = await pinterestSession().cookies.get({ domain: 'pinterest.com' });
  for (const cookie of cookies) await pinterestSession().cookies.remove('https://' + (cookie.domain || 'www.pinterest.com').replace(/^\./, '') + cookie.path, cookie.name);
  return true;
});
let imageSearchUrls = new Set();
let pinterestWindow = null;
let pinterestIdleTimer = null;
let pinterestQuery = '';
let pinterestSeen = new Map();
let pinterestQueue = Promise.resolve();
async function pinterestResults(query, more = false) {
  clearTimeout(pinterestIdleTimer);
  if (!more || !pinterestWindow || pinterestWindow.isDestroyed() || query !== pinterestQuery) {
    if (pinterestWindow && !pinterestWindow.isDestroyed()) pinterestWindow.destroy();
    pinterestWindow = new BrowserWindow({ show: false, webPreferences: { partition: 'persist:ribbit-pinterest', contextIsolation: true, nodeIntegration: false, sandbox: true } });
    pinterestQuery = query;
    pinterestSeen = new Map();
    try { await pinterestWindow.loadURL('https://www.pinterest.com/search/pins/?q=' + encodeURIComponent(query)); }
    catch (error) { pinterestWindow.destroy(); pinterestWindow = null; return { source: 'Pinterest', images: [], error: error.message }; }
  }
  try {
    const added = new Map();
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1100));
      const images = await pinterestWindow.webContents.executeJavaScript("[...document.querySelectorAll('a[href*=\"/pin/\"] img')].map(img => img.currentSrc || img.src).filter(url => url.startsWith('https://i.pinimg.com/'))");
      for (const url of images) if (!pinterestSeen.has(url)) {
        const image = { url, source: 'Pinterest' };
        pinterestSeen.set(url, image);
        added.set(url, image);
      }
      await pinterestWindow.webContents.executeJavaScript('window.scrollTo(0, document.scrollingElement.scrollHeight)');
    }
    pinterestIdleTimer = setTimeout(() => { if (pinterestWindow && !pinterestWindow.isDestroyed()) pinterestWindow.destroy(); pinterestWindow = null; }, 60000);
    return { source: 'Pinterest', images: [...added.values()], hasMore: added.size > 0 && pinterestSeen.size < 300 };
  } catch (error) { return { source: 'Pinterest', images: [], error: error.message, hasMore: false }; }
}
function queuedPinterest(query, more = false) {
  const next = pinterestQueue.then(() => pinterestResults(query, more));
  pinterestQueue = next.catch(() => {});
  return next;
}ipcMain.handle('web:image-search', async (_event, query) => {
  query = String(query || '').trim().slice(0, 120);
  if (query.length < 2) throw new Error('Digite ao menos duas letras.');
  const [google, pinterest] = await Promise.all([webTools.searchImages(query), queuedPinterest(query)]);
  const results = [...google.filter(group => group.source !== 'Pinterest'), pinterest];
  imageSearchUrls = new Set(results.flatMap(group => group.images.map(image => image.url)));
  return results;
});
ipcMain.handle('web:image-more', async (_event, query) => {
  query = String(query || '').trim().slice(0, 120);
  if (query.length < 2) throw new Error('Faça a busca novamente.');
  const result = await queuedPinterest(query, Boolean(pinterestWindow && !pinterestWindow.isDestroyed() && query === pinterestQuery));
  for (const image of result.images) imageSearchUrls.add(image.url);
  return result;
});ipcMain.handle('web:image-save', async (_event, { url, folderId, person, tags }) => {
  if (!imageSearchUrls.has(url)) throw new Error('Faça a busca antes de salvar esta imagem.');
  const roots = await readFolders();
  if (folderId !== 'downloads' && !roots.includes(folderId)) throw new Error('Pasta de destino inválida.');
  if (typeof person !== 'string' || person.length > 120 || !Array.isArray(tags) || tags.length > 100 || tags.some(tag => typeof tag !== 'string' || tag.length > 120)) throw new Error('Classificação inválida.');
  const destination = folderId === 'downloads' ? mediaDirectory() : folderId;
  if (folderId !== 'downloads' && !(await fs.stat(destination).catch(() => null))?.isDirectory()) throw new Error('Pasta de destino indisponível.');
  const file = await webTools.image(url, destination, [new URL(url).hostname]);
  try {
    const item = await catalogOperation(async () => {
      const saved = await addDownloaded(file, path.basename(new URL(url).pathname), url, folderId === 'downloads' ? null : folderId);
      const catalog = await readCatalog();
      const entry = catalog.find(entry => entry.id === saved.id);
      entry.person = person.trim();
      entry.tags = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
      await writeCatalog(catalog);
      return entry;
    });
    return { ...item, folderName: folderId === 'downloads' ? 'Downloads' : path.basename(folderId) };
  } catch (error) { await fs.rm(file, { force: true }); throw error; }
});
ipcMain.handle('web:image-copy', async (_event, url) => {
  if (!imageSearchUrls.has(url)) throw new Error('Faça a busca antes de copiar esta imagem.');
  const file = await webTools.image(url, path.join(app.getPath('temp'), 'ribbit-frame'), [new URL(url).hostname]);
  try {
    const image = nativeImage.createFromPath(file);
    if (image.isEmpty()) throw new Error('Não foi possível copiar esta imagem.');
    clipboard.writeImage(image);
    return true;
  } finally { await fs.rm(file, { force: true }); }
});
function createWindow() {
  app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'Cache'));
  const window = new BrowserWindow({ width: 1280, height: 820, minWidth: 620, minHeight: 460, backgroundColor: '#F5EFE6', icon: path.join(__dirname, 'assets/ribbit-frame-icon.png'), title: 'Ribbit Frame', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const expected = app.isPackaged ? require('node:url').pathToFileURL(path.join(__dirname, '../dist/index.html')).href : 'http://127.0.0.1:5174/';
    if (url !== expected) event.preventDefault();
  });
  if (app.isPackaged) window.loadFile(path.join(__dirname, '../dist/index.html'));
  else window.loadURL('http://127.0.0.1:5174');
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('foreditor', async (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
    const item = (await readCatalog()).find((entry) => entry.id === id);
    return item ? net.fetch(pathToFileURL(item.path).href) : new Response('Not found', { status: 404 });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });



ipcMain.handle('web:myinstants-open', async () => {
  const browserSession = session.fromPartition('persist:ribbit-myinstants');
  const browser = new BrowserWindow({ width: 1150, height: 820, title: 'MyInstants · Ribbit Frame', autoHideMenuBar: true, webPreferences: { partition: 'persist:ribbit-myinstants', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await fs.mkdir(mediaDirectory(), { recursive: true });
  const pending = new Set();
  const onDownload = (_event, item) => {
    let source;
    try { source = new URL(item.getURL()); } catch { item.cancel(); return; }
    if (source.protocol !== 'https:' || !/(^|\.)myinstants\.com$/.test(source.hostname) || path.extname(item.getFilename()).toLowerCase() !== '.mp3') { item.cancel(); return; }
    const filename = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 100) || 'efeito.mp3';
    const target = path.join(mediaDirectory(), `${crypto.randomUUID().slice(0, 8)}-${filename}`);
    item.setSavePath(target);
    const task = new Promise(resolve => item.once('done', async (_event, state) => {
        if (state === 'completed') {
          try { await catalogOperation(() => addDownloaded(target, filename, source.href)); }
          catch { await fs.rm(target, { force: true }); }
        }
        resolve();
      }));
    pending.add(task); task.finally(() => pending.delete(task));
  };
  browserSession.on('will-download', onDownload);
  try {
    await browser.loadURL('https://www.myinstants.com/pt/index/br/');
    await new Promise(resolve => browser.once('closed', resolve));
    await Promise.allSettled([...pending]);
    return true;
  } finally {
    browserSession.removeListener('will-download', onDownload);
    if (!browser.isDestroyed()) browser.destroy();
  }
});





const myinstantsResults = new Map();
ipcMain.handle('web:myinstants-search', async (_event, query, page = 1) => {
  query = String(query || '').trim().slice(0, 100);
  if (query.length < 2 || !Number.isInteger(page) || page < 1 || page > 100) throw new Error('Busca inválida.');
  const url = new URL('https://www.myinstants.com/api/v1/instants/');
  url.searchParams.set('name', query); url.searchParams.set('page', String(page));
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', 'User-Agent': 'Ribbit Frame' } });
  if (response.status === 429) throw new Error('Limite do MyInstants atingido. Aguarde um minuto e tente novamente.');
  if (!response.ok) throw new Error(`Busca no MyInstants: HTTP ${response.status}.`);
  const raw = await response.text();
  if (raw.length > 1000000) throw new Error('Resposta do MyInstants muito grande.');
  const data = JSON.parse(raw);
  if (myinstantsResults.size > 500) myinstantsResults.clear();
  const sounds = (Array.isArray(data.results) ? data.results : []).flatMap(item => {
    try {
      const address = new URL(item.sound);
      if (address.protocol !== 'https:' || address.hostname !== 'www.myinstants.com' || !address.pathname.startsWith('/media/sounds/') || !address.pathname.toLowerCase().endsWith('.mp3')) return [];
      const sound = { name: String(item.name || '').slice(0, 120), url: address.href, slug: String(item.slug || '').slice(0, 120) };
      myinstantsResults.set(sound.url, sound);
      return [sound];
    } catch { return []; }
  });
  return { sounds, count: Number(data.count) || 0, hasMore: Boolean(data.next), page };
});
ipcMain.handle('web:myinstants-save', async (_event, { url, folderId }) => {
  const sound = myinstantsResults.get(url);
  if (!sound) throw new Error('Pesquise o som antes de salvá-lo.');
  const roots = await readFolders();
  if (folderId !== 'downloads' && !roots.includes(folderId)) throw new Error('Pasta de destino inválida.');
  const destination = folderId === 'downloads' ? mediaDirectory() : folderId;
  if (folderId !== 'downloads' && !(await fs.stat(destination).catch(() => null))?.isDirectory()) throw new Error('Pasta de destino indisponível.');
  const response = await fetch(sound.url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Ribbit Frame' } });
  if (!response.ok || new URL(response.url).hostname !== 'www.myinstants.com') throw new Error('Não foi possível baixar o MP3.');
  if (Number(response.headers.get('content-length')) > 20000000) throw new Error('MP3 excede 20 MB.');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 20000000) throw new Error('MP3 excede 20 MB.'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 3).toString() !== 'ID3' && !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) throw new Error('O arquivo recebido não é MP3.');
  await fs.mkdir(destination, { recursive: true });
  const filename = (sound.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 90) || 'Efeito sonoro') + '.mp3';
  const file = path.join(destination, `${crypto.randomUUID().slice(0, 8)}-${filename}`);
  await fs.writeFile(file, bytes, { flag: 'wx' });
  try { return await catalogOperation(() => addDownloaded(file, filename, sound.url, folderId === 'downloads' ? null : folderId)); }
  catch (error) { await fs.rm(file, { force: true }); throw error; }
});


