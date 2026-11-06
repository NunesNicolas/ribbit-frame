const { app, BrowserWindow, dialog, ipcMain, protocol, net, clipboard, nativeImage, shell, session } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const webTools = require('./web-tools.cjs');
// Preserve a biblioteca já criada antes da mudança de nome.
const existingDataPath = path.join(app.getPath('appData'), 'foreditor');
fsSync.mkdirSync(existingDataPath, { recursive: true });
app.setPath('userData', existingDataPath);
app.setName('Ribbit Frame');

protocol.registerSchemesAsPrivileged([{ scheme: 'foreditor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

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
ipcMain.handle('media:list', async () => {
  const items = await catalogOperation(syncFolders);
  return Promise.all(items.map(async (item) => {
    try {
      const stat = await fs.stat(item.path);
      return { ...item, missing: false, url: `foreditor://media/${encodeURIComponent(item.id)}`, size: stat.size, modifiedAt: stat.mtimeMs };
    } catch {
      return { ...item, missing: true, url: null, size: 0, modifiedAt: null };
    }
  }));
});
ipcMain.handle('media:copy', async (_event, id) => {
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
let pinterestQuery = '';
let pinterestSeen = new Map();
let pinterestQueue = Promise.resolve();
async function pinterestResults(query, more = false) {
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
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'Cache'));
  const window = new BrowserWindow({ width: 1280, height: 820, minWidth: 760, minHeight: 560, backgroundColor: '#F5EFE6', icon: path.join(__dirname, 'assets/ribbit-frame-icon.png'), title: 'Ribbit Frame', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (app.isPackaged) window.loadFile(path.join(__dirname, '../dist/index.html'));
  else window.loadURL('http://127.0.0.1:5174');
}
app.whenReady().then(() => {
  protocol.handle('foreditor', async (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
    const item = (await readCatalog()).find((entry) => entry.id === id);
    return item ? net.fetch(pathToFileURL(item.path).href) : new Response('Not found', { status: 404 });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

