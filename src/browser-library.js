let connection;
const urls = new Map();

function openDatabase() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('foreditor-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(request.error); };
  });
  return connection;
}

async function transact(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('media', mode);
    const request = action(transaction.objectStore('media'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('Falha ao salvar biblioteca.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

function present(item) {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.file));
  const { file, ...metadata } = item;
  return { ...metadata, url: urls.get(item.id), size: file.size, modifiedAt: file.lastModified || null, missing: false };
}

async function getItem(id) {
  const item = await transact('readonly', store => store.get(id));
  if (!item) throw new Error('Mídia não encontrada.');
  return item;
}

export const browserLibrary = {
  listFolders: async () => [{ id: 'local', name: 'Local', kind: 'local', path: '' }],
  listPeople: async () => JSON.parse(localStorage.getItem('foreditor-people') || '[]'),
  listTaxonomy: async () => {
    const items = await transact('readonly', store => store.getAll());
    const saved = JSON.parse(localStorage.getItem('ribbit-taxonomy') || '{"tags":[],"categories":[]}');
    const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { people: unique([...JSON.parse(localStorage.getItem('foreditor-people') || '[]'), ...items.map(item => item.person)]), tags: unique([...(saved.tags || []), ...items.flatMap(item => item.tags || (item.emotion ? [item.emotion] : []))]), categories: unique([...(saved.categories || []), ...items.map(item => item.category)]) };
  },
  addTaxonomy: async ({ kind, name }) => {
    if (!['people', 'tags', 'categories'].includes(kind) || typeof name !== 'string' || !name.trim()) throw new Error('Classificação inválida.');
    const value = name.trim().slice(0, 120);
    const key = kind === 'people' ? 'foreditor-people' : 'ribbit-taxonomy';
    const saved = JSON.parse(localStorage.getItem(key) || (kind === 'people' ? '[]' : '{"tags":[],"categories":[]}'));
    const list = kind === 'people' ? saved : saved[kind];
    if (!list.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) list.push(value);
    localStorage.setItem(key, JSON.stringify(saved));
    return true;
  },
  removeTaxonomy: async ({ kind, name }) => {
    if (!['people', 'tags', 'categories'].includes(kind) || typeof name !== 'string' || !name.trim()) throw new Error('Classificação inválida.');
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('media', 'readwrite');
      const store = transaction.objectStore('media');
      const request = store.getAll();
      request.onsuccess = () => {
        for (const item of request.result) {
          if (kind === 'people' && item.person === name) item.person = '';
          if (kind === 'categories' && item.category === name) item.category = '';
          if (kind === 'tags') { item.tags = (item.tags || (item.emotion ? [item.emotion] : [])).filter(tag => tag !== name); delete item.emotion; }
          store.put(item);
        }
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Falha ao atualizar catálogo.'));
    });
    const key = kind === 'people' ? 'foreditor-people' : 'ribbit-taxonomy';
    const saved = JSON.parse(localStorage.getItem(key) || (kind === 'people' ? '[]' : '{"tags":[],"categories":[]}'));
    if (kind === 'people') localStorage.setItem(key, JSON.stringify(saved.filter(item => item !== name)));
    else { saved[kind] = (saved[kind] || []).filter(item => item !== name); localStorage.setItem(key, JSON.stringify(saved)); }
    return true;
  },
  addPerson: async name => {
    const people = JSON.parse(localStorage.getItem('foreditor-people') || '[]');
    const trimmed = String(name).trim().slice(0, 120);
    if (!trimmed) throw new Error('Informe o nome da pessoa.');
    if (!people.some(person => person.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) people.push(trimmed);
    localStorage.setItem('foreditor-people', JSON.stringify(people));
    return people;
  },
  listMedia: async () => (await transact('readonly', store => store.getAll())).map(present),
  importMedia: () => chooseFiles(false),
  importFolder: () => chooseFiles(true),
  updateMedia: async ({ id, person, tags, category }) => {
    const item = await getItem(id);
    Object.assign(item, { person, tags, category });
    delete item.emotion;
    await transact('readwrite', store => store.put(item));
    return present(item);
  },
  updateMediaBatch: async ({ ids, person, category, tags }) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 10000 || ids.some(id => typeof id !== 'string')) throw new Error('Seleção inválida.');
    if (person !== undefined && (typeof person !== 'string' || person.length > 120)) throw new Error('Pessoa inválida.');
    if (category !== undefined && (typeof category !== 'string' || category.length > 120)) throw new Error('Categoria inválida.');
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 100 || tags.some(tag => typeof tag !== 'string' || tag.length > 120))) throw new Error('Tags inválidas.');
    const database = await openDatabase();
    const updated = [];
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('media', 'readwrite');
      const store = transaction.objectStore('media');
      const selected = new Set(ids);
      for (const id of selected) {
        const request = store.get(id);
        request.onsuccess = () => {
          const item = request.result;
          if (!item) { transaction.abort(); return; }
          if (person !== undefined) item.person = person.trim();
          if (category !== undefined) item.category = category.trim();
          if (tags !== undefined) item.tags = [...new Set([...(Array.isArray(item.tags) ? item.tags : item.emotion ? [item.emotion] : []), ...tags.map(tag => tag.trim()).filter(Boolean)])].slice(0, 100);
          delete item.emotion;
          store.put(item);
          updated.push(item);
        };
      }
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error('Uma das mídias não foi encontrada.'));
      transaction.onerror = () => reject(transaction.error);
    });
    return updated.map(present);
  },
  removeMedia: async id => {
    await transact('readwrite', store => store.delete(id));
    URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
    return true;
  },
  copyMedia: async id => {
    const item = await getItem(id);
    const bitmap = await createImageBitmap(item.file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  },
  openMedia: async id => {
    const item = present(await getItem(id));
    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.name;
    link.click();
    return '';
  },
};

function chooseFiles(folder) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (folder) input.webkitdirectory = true;
    input.accept = 'image/*,video/*,audio/*';
    input.hidden = true;
    document.body.append(input);
    input.oncancel = () => { input.remove(); resolve([]); };
    input.onchange = async () => {
      try {
        const added = [];
        for (const file of input.files) {
          const type = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio' }[file.type.split('/')[0]];
          if (!type) continue;
          const item = { id: crypto.randomUUID(), name: file.name, relativePath: file.webkitRelativePath || file.name, type, file, category: '', person: '', tags: [], createdAt: new Date().toISOString() };
          await transact('readwrite', store => store.put(item));
          added.push(present(item));
        }
        resolve(added);
      } catch (error) { reject(error); }
      finally { input.remove(); }
    };
    input.click();
  });
}

export const library = window.forEditor || browserLibrary;
