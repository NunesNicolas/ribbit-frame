import { useEffect, useMemo, useState } from 'react';
import logo from './assets/ribbit-frame-logo.png';
import { AudioLines, Check, Copy, Download, Captions, Film, Folder, FolderOpen, Image as ImageIcon, Images, Moon, Sun, RefreshCw, Search, Shuffle, Sparkles, Tag, SlidersHorizontal, PanelLeftClose, PanelLeftOpen, X, Trash2, Upload } from 'lucide-react';
import { library } from './browser-library';
import { Classification } from './classification';
import { Pagination } from './pagination';
import { YouTubeTools, ImageSearchTools, SettingsTools } from './web-tools';
import { TranscriptionTools } from './transcription';
import { MyInstantsTools } from './myinstants';
import { UpdateNotice } from './update-notice';

const mediaTags = item => Array.isArray(item.tags) ? item.tags : item.emotion ? [item.emotion] : [];
const mediaIcon = { Imagem: ImageIcon, Vídeo: Film, Áudio: AudioLines };
const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const belongs = (item, folderId) => folderId === 'all' || (folderId === 'local' ? !item.folderRoot : item.folderRoot === folderId);
const dateOf = item => item.modifiedAt || (item.createdAt ? Date.parse(item.createdAt) : 0) || 0;

export function App() {
  const [media, setMedia] = useState([]);
  const [folders, setFolders] = useState([]);
  const [people, setPeople] = useState([]);
  const [savedTags, setSavedTags] = useState([]);
  const [savedCategories, setSavedCategories] = useState([]);
  const [tab, setTab] = useState('explore');
  const [transcriptionId, setTranscriptionId] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('ribbit-theme') === 'dark' ? 'dark' : 'light');
  const [folderId, setFolderId] = useState('all');
  const [selection, setSelection] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [randomCollapsed, setRandomCollapsed] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogIds, setCatalogIds] = useState([]);
  const [anchorId, setAnchorId] = useState(null);
  const [batchPerson, setBatchPerson] = useState('');
  const [batchNewPerson, setBatchNewPerson] = useState('');
  const [batchTags, setBatchTags] = useState('');
  const [batchCategory, setBatchCategory] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('Todos');
  const [listPerson, setListPerson] = useState('Todas');
  const [listTags, setListTags] = useState([]);
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [drawType, setDrawType] = useState('Todos');
  const [drawPerson, setDrawPerson] = useState('Todas');
  const [drawTags, setDrawTags] = useState([]);
  const [drawCategory, setDrawCategory] = useState('Todas');
  const [drawn, setDrawn] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = media.find(item => item.id === selection) || null;
  const preview = media.find(item => item.id === previewId) || null;
  const personOptions = unique([...people, ...media.map(item => item.person)]);
  const tagOptions = unique([...savedTags, ...media.flatMap(mediaTags)]);
  const categories = unique([...savedCategories, ...media.map(item => item.category)]);
  const shownFolder = folders.find(folder => folder.id === folderId);

  async function refresh(force = false) {
    try {
      const [items, folderList, taxonomy] = await Promise.all([library.listMedia(force === true), library.listFolders(), (library.listTaxonomy ? library.listTaxonomy() : Promise.all([library.listMedia(), library.listPeople()]).then(([items, people]) => ({ people, tags: unique(items.flatMap(mediaTags)), categories: unique(items.map(item => item.category)) })))]);
      setMedia(items); setFolders(folderList); setPeople(taxonomy.people); setSavedTags(taxonomy.tags); setSavedCategories(taxonomy.categories); setError('');
    } catch (cause) { setError(`Não foi possível atualizar a biblioteca: ${cause.message}`); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ribbit-theme', theme); }, [theme]);
  useEffect(() => { if (!previewId) return; const close = event => { if (event.key === 'Escape') setPreviewId(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [previewId]);

  const visible = useMemo(() => media.filter(item => belongs(item, folderId) && (view === 'Todos' || item.type === view) && (listPerson === 'Todas' || item.person === listPerson) && listTags.every(tag => mediaTags(item).includes(tag)) && `${item.name} ${item.relativePath || ''} ${item.category || ''} ${item.person || ''} ${mediaTags(item).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => sort === 'modified' ? dateOf(b) - dateOf(a) || a.name.localeCompare(b.name, 'pt-BR') : a.name.localeCompare(b.name, 'pt-BR')), [media, folderId, view, listPerson, listTags, query, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageVisible = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [folderId, query, view, listPerson, listTags, sort, pageSize]);  const candidates = useMemo(() => media.filter(item => !item.missing && belongs(item, folderId) && (drawType === 'Todos' || item.type === drawType) && (drawPerson === 'Todas' || item.person === drawPerson) && drawTags.every(tag => mediaTags(item).includes(tag)) && (drawCategory === 'Todas' || item.category === drawCategory)), [media, folderId, drawType, drawPerson, drawTags, drawCategory]);
  async function addMedia(folder = false) {
    setBusy(true); setError(''); setNotice('');
    try { const added = await (folder ? library.importFolder() : library.importMedia()); await refresh(); setNotice(folder ? `Pasta vinculada. ${added.length} nova(s) mídia(s).` : `${added.length} mídia(s) importada(s).`); }
    catch (cause) { setError(`Não foi possível adicionar mídia: ${cause.message}`); }
    finally { setBusy(false); }
  }
  async function copy(item) {
    try { if (item.type === 'Imagem') { await library.copyMedia(item.id); setNotice(`Imagem copiada: ${item.name}`); } else if (item.path) { await navigator.clipboard.writeText(item.path); setNotice(`Caminho copiado: ${item.name}`); } else { await library.openMedia(item.id); setNotice(`Arquivo exportado: ${item.name}`); } }
    catch (cause) { setError(`Falha ao copiar: ${cause.message}`); }
  }
  async function open(item) { try { const message = await library.openMedia(item.id); if (message) throw Error(message); } catch (cause) { setError(cause.message); } }
  async function remove(item) {
    if (!window.confirm(`Remover “${item.name}” do catálogo? O arquivo original será preservado.`)) return;
    try { await library.removeMedia(item.id); setMedia(current => current.filter(entry => entry.id !== item.id)); if (selection === item.id) setSelection(null); if (previewId === item.id) setPreviewId(null); setCatalogIds(current => current.filter(id => id !== item.id)); if (drawn?.id === item.id) setDrawn(null); }
    catch (cause) { setError(cause.message); }
  }
  async function saveClassification(item, key, value) {
    const updated = { ...item, [key]: value };
    try { await library.updateMedia({ id: item.id, category: updated.category, person: updated.person, tags: mediaTags(updated) }); setMedia(current => current.map(entry => entry.id === item.id ? updated : entry)); }
    catch (cause) { setError(`Falha ao salvar classificação: ${cause.message}`); throw cause; }
  }
  function chooseCatalogItem(id, shift) {
    const ids = pageVisible.map(item => item.id);
    const start = ids.indexOf(anchorId);
    const end = ids.indexOf(id);
    if (shift && start >= 0 && end >= 0) {
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      setCatalogIds(current => [...new Set([...current, ...range])]);
    } else {
      setCatalogIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
      setAnchorId(id);
    }
  }
  async function saveBatch(event) {
    event.preventDefault();
    if (!catalogIds.length) return;
    const person = batchNewPerson.trim() || batchPerson;
    const tags = [...new Set(batchTags.split(',').map(tag => tag.trim()).filter(Boolean))];
    if (!person && !tags.length && !batchCategory.trim()) { setError('Preencha ao menos um campo para catalogar.'); return; }
    setCatalogSaving(true); setError('');
    try {
      const data = { ids: catalogIds };
      if (person) data.person = person;
      if (tags.length) data.tags = tags;
      if (batchCategory.trim()) data.category = batchCategory.trim();
      await library.updateMediaBatch(data);
      if (batchNewPerson.trim()) setPeople(await library.addPerson(batchNewPerson.trim()));
      await refresh();
      setNotice(`${catalogIds.length} arquivo(s) catalogado(s).`);
      setCatalogOpen(false); setCatalogIds([]); setAnchorId(null);
      setBatchPerson(''); setBatchNewPerson(''); setBatchTags(''); setBatchCategory('');
    } catch (cause) { setError(`Falha ao catalogar: ${cause.message}`); }
    finally { setCatalogSaving(false); }
  }
  function draw() {
    if (!candidates.length) { setDrawn(null); return; }
    const different = candidates.filter(item => item.id !== drawn?.id);
    const pool = different.length ? different : candidates;
    setDrawn(pool[Math.floor(Math.random() * pool.length)]);
  }
  const toggleTag = (current, setter, tag) => setter(current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag]);
  const thumbnail = item => item.type === 'Imagem' && item.url && !item.missing ? <img src={item.url} alt="" loading="lazy"/> : (() => { const Icon = mediaIcon[item.type] || ImageIcon; return <Icon size={18}/>; })();
  return <div className="app-shell"><header className="topbar"><div className="brand"><img className="brand-logo" src={logo} alt="Ribbit Frame"/><span className="brand-subtitle">FERRAMENTAS PARA EDIÇÃO</span></div><div className="top-actions"><span className="local-badge"><i/> Local</span><button className="theme-toggle" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'} title={theme === 'light' ? 'Tema escuro' : 'Tema claro'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}<span>{theme === 'light' ? 'Escuro' : 'Claro'}</span></button><button className="icon-button" title="Atualizar biblioteca" aria-label="Atualizar biblioteca" onClick={() => refresh(true)}><RefreshCw size={16}/></button><button className="import-button" disabled={busy} onClick={() => addMedia(false)}><Upload size={15}/>Importar arquivos</button><button className="copy-button" disabled={busy || !window.forEditor} onClick={() => addMedia(true)}><FolderOpen size={15}/>Vincular pasta</button></div></header>
    <nav className="main-tabs" aria-label="Áreas do aplicativo"><button className={tab === 'explore' ? 'active' : ''} onClick={() => setTab('explore')}><FolderOpen size={16}/>Explorar arquivos</button><button className={tab === 'youtube' ? 'active' : ''} onClick={() => setTab('youtube')}><Download size={16}/>YouTube</button><button className={tab === 'sounds' ? 'active' : ''} onClick={() => setTab('sounds')}><AudioLines size={16}/>Efeitos sonoros</button><button className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}><Images size={16}/>Buscar imagens</button><button className={tab === 'transcription' ? 'active' : ''} onClick={() => setTab('transcription')}><Captions size={16}/>Legendas</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Configurações</button></nav>
    <UpdateNotice/>
    {!window.forEditor && <div className="feedback">Modo navegador: os arquivos ficam neste perfil. Para vincular pastas e baixar da web, abra o aplicativo desktop.</div>}
    {error && <div className="feedback error" role="alert">{error}</div>}{notice && <div className="feedback" role="status">{notice}</div>}
    {tab === 'sounds' ? <MyInstantsTools folders={folders} onImported={refresh}/> : tab === 'youtube' ? <YouTubeTools folders={folders} onImported={refresh}/> : tab === 'images' ? <ImageSearchTools onImported={refresh}/> : tab === 'settings' ? <SettingsTools onChanged={refresh} folders={folders} onFolderRemoved={root => { if (folderId === root) setFolderId('all'); setSelection(null); setPreviewId(null); setDrawn(null); refresh(true); }}/> : tab === 'transcription' ? null : <main className={`explore-layout ${randomCollapsed ? 'collapsed-random' : ''} ${foldersCollapsed ? 'collapsed-folders' : ''}`}>
      <aside className="workspace-panel folder-panel"><div className="section-title"><h2>Pastas</h2><button type="button" className="folder-collapse" onClick={() => setFoldersCollapsed(value => !value)} aria-label={foldersCollapsed ? "Expandir pastas" : "Recolher pastas"} title={foldersCollapsed ? "Expandir pastas" : "Recolher pastas"}>{foldersCollapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</button></div><div className="folder-list"><button className={folderId === 'all' ? 'active' : ''} onClick={() => setFolderId('all')}><Folder size={16}/><span>Todas as mídias</span><b>{media.length}</b></button>{folders.map(folder => <button key={folder.id} className={folderId === folder.id ? 'active' : ''} title={folder.path || folder.name} onClick={() => setFolderId(folder.id)}><Folder size={16}/><span>{folder.name}</span><b>{media.filter(item => belongs(item, folder.id)).length}</b></button>)}</div><div className="folder-footnote">Pastas vinculadas mostram os arquivos no local original.</div></aside>
      <section className="workspace-panel explorer"><div className="panel-heading"><div><h1>{shownFolder?.name || 'Todas as mídias'}</h1><p title={shownFolder?.path}>{shownFolder?.kind === 'linked' ? shownFolder.path : `${visible.length} de ${media.length} arquivos`}</p></div><span className="file-count">{visible.length}</span></div><div className="explorer-tools"><div className="search-box"><Search size={16}/><input aria-label="Buscar arquivos" placeholder="Buscar por nome, categoria ou tag…" value={query} onChange={event => setQuery(event.target.value)}/><button type="button" className="filter-icon" aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"} title={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"} aria-expanded={filtersOpen} aria-controls="explorer-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17}/></button></div>{filtersOpen && <div id="explorer-filters" className="filter-options"><div className="type-tabs">{['Todos','Imagem','Vídeo','Áudio'].map(value => <button key={value} className={view === value ? 'active' : ''} onClick={() => setView(value)}>{value === 'Todos' ? 'Todos' : value === 'Imagem' ? 'Imagens' : value === 'Vídeo' ? 'Vídeos' : 'Áudios'}</button>)}</div><div className="list-controls"><label>Pessoa<select value={listPerson} onChange={event => setListPerson(event.target.value)}><option>Todas</option>{personOptions.map(value => <option key={value}>{value}</option>)}</select></label><label>Ordenar<select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Nome A–Z</option><option value="modified">Modificação recente</option></select></label></div><div className="tag-filter-row"><span>Tags</span><div>{tagOptions.map(tag => <button key={tag} className={listTags.includes(tag) ? 'selected' : ''} aria-pressed={listTags.includes(tag)} onClick={() => toggleTag(listTags, setListTags, tag)}>{listTags.includes(tag) && <Check size={11}/>} {tag}</button>)}{!tagOptions.length && <small>Sem tags cadastradas</small>}</div></div></div>}</div><div className="catalog-toolbar"><button className="copy-button" onClick={() => { setCatalogOpen(value => !value); setCatalogIds([]); setAnchorId(null); }}><Tag size={15}/>{catalogOpen ? 'Cancelar catalogação' : 'Catalogar'}</button>{catalogOpen && <span>{catalogIds.length} arquivo(s) selecionado(s) · clique para selecionar, Shift+clique para um intervalo</span>}</div>{catalogOpen && <form className="batch-editor" onSubmit={saveBatch}><div className="tag-fields"><label>Pessoa<select value={batchPerson} onChange={event => setBatchPerson(event.target.value)}><option value="">Manter atual</option>{personOptions.map(name => <option key={name}>{name}</option>)}</select></label><label>Nova pessoa<input value={batchNewPerson} maxLength={120} onChange={event => setBatchNewPerson(event.target.value)} placeholder="Opcional"/></label><label>Tags para adicionar<input value={batchTags} onChange={event => setBatchTags(event.target.value)} placeholder="tag 1, tag 2"/></label><label>Categoria<input value={batchCategory} maxLength={120} onChange={event => setBatchCategory(event.target.value)} placeholder="Manter atual"/></label></div><button className="import-button" disabled={catalogSaving || !catalogIds.length}>{catalogSaving ? 'Salvando…' : `Salvar ${catalogIds.length} arquivo(s)`}</button></form>}<div className="file-list">{pageVisible.map(item => <article key={item.id} className={`file-row ${(catalogOpen ? catalogIds.includes(item.id) : selected?.id === item.id) ? 'selected' : ''}`} onMouseDown={event => { if (catalogOpen && event.shiftKey) event.preventDefault(); }} onClick={event => catalogOpen ? chooseCatalogItem(item.id, event.shiftKey) : (selected?.id === item.id ? setPreviewId(item.id) : setSelection(item.id))}><div className="file-thumb">{thumbnail(item)}</div><div className="file-main"><strong title={item.name}>{item.name}</strong><div className="file-badges">{item.person && <span className="person-badge" title={item.person}>{item.person}</span>}{mediaTags(item).length > 0 && <span className="tag-badge" title={mediaTags(item).join(', ')}>{mediaTags(item)[0]}{mediaTags(item).length > 1 ? ` + ${mediaTags(item).length - 1}` : ''}</span>}</div><small title={item.relativePath}>{item.relativePath || item.type} · {item.missing ? 'Arquivo ausente' : `${(item.size / 1048576).toFixed(1)} MB`} · {dateOf(item) ? new Date(dateOf(item)).toLocaleDateString('pt-BR') : 'Sem data'}</small></div><div className="file-actions"><button title="Abrir arquivo" aria-label={`Abrir ${item.name}`} onClick={event => { event.stopPropagation(); open(item); }}><FolderOpen size={15}/></button><button title="Copiar" aria-label={`Copiar ${item.name}`} onClick={event => { event.stopPropagation(); copy(item); }}><Copy size={15}/></button><button title="Remover do catálogo" aria-label={`Remover ${item.name}`} onClick={event => { event.stopPropagation(); remove(item); }}><Trash2 size={15}/></button></div></article>)}{!visible.length && <div className="empty-state"><FolderOpen size={26}/><h3>{media.length ? 'Nenhum arquivo com estes filtros' : 'Biblioteca vazia'}</h3><p>{media.length ? 'Ajuste a pasta, pessoa, tags ou busca.' : 'Importe arquivos ou vincule uma pasta para começar.'}</p></div>}</div><Pagination page={currentPage} pages={pages} pageSize={pageSize} total={visible.length} onPage={setPage} onPageSize={setPageSize}/></section>
      <aside className="workspace-panel randomizer"><button type="button" className="random-collapse" onClick={() => setRandomCollapsed(value => !value)} aria-label={randomCollapsed ? "Expandir busca aleatória" : "Recolher busca aleatória"} title={randomCollapsed ? "Expandir busca aleatória" : "Recolher busca aleatória"}>{randomCollapsed ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}</button><div className="panel-heading"><div><h2>Busca aleatória</h2><p>{folderId === 'all' ? 'Em toda a biblioteca' : `Na pasta ${shownFolder?.name || ''}`}</p></div><span className="shuffle-icon"><Sparkles size={19}/></span></div><div className="random-filters"><label><span>TIPO</span><select value={drawType} onChange={event => setDrawType(event.target.value)}>{['Todos','Imagem','Vídeo','Áudio'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>PESSOA</span><select value={drawPerson} onChange={event => setDrawPerson(event.target.value)}><option>Todas</option>{personOptions.map(value => <option key={value}>{value}</option>)}</select></label><label className="full-width"><span>CATEGORIA</span><select value={drawCategory} onChange={event => setDrawCategory(event.target.value)}><option>Todas</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><fieldset className="tag-filter full-width"><legend>TAGS</legend><small>Deve conter todas as tags selecionadas.</small><div className="tag-options">{tagOptions.map(tag => <label key={tag}><input type="checkbox" checked={drawTags.includes(tag)} onChange={() => toggleTag(drawTags, setDrawTags, tag)}/>{tag}</label>)}</div></fieldset><button className="shuffle-button" onClick={draw}><Shuffle size={16}/>Sortear entre {candidates.length}</button></div>{drawn ? <div className="result-card"><div className="result-art">{drawn.type === 'Imagem' && drawn.url ? <img src={drawn.url} alt="Prévia do resultado"/> : drawn.type === 'Vídeo' && drawn.url ? <video src={drawn.url} controls preload="metadata"/> : drawn.type === 'Áudio' && drawn.url ? <audio src={drawn.url} controls preload="metadata"/> : <Film size={26}/>}</div><div className="result-info"><h3>{drawn.name}</h3><p>{drawn.type} · {drawn.person || 'Sem pessoa'}</p></div><div className="result-actions"><button className="copy-button" onClick={() => copy(drawn)}><Copy size={14}/>Copiar</button><button className="copy-button" onClick={() => open(drawn)}><FolderOpen size={14}/>Abrir</button></div></div> : <div className="empty-state random-empty"><Shuffle size={26}/><h3>Pronto para sortear</h3><p>Escolha os filtros e encontre uma mídia da pasta selecionada.</p></div>}</aside>
    </main>}<TranscriptionTools media={media} initialId={transcriptionId} active={tab === "transcription"}/>{preview && <div className="image-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewId(null); }}><div className="image-modal media-preview-modal" role="dialog" aria-modal="true" aria-label={`Visualizar ${preview.name}`}><button type="button" className="image-modal-close" aria-label="Fechar visualização" onClick={() => setPreviewId(null)}><X size={18}/></button><div className="image-modal-preview">{preview.missing ? <p>Arquivo indisponível</p> : preview.type === 'Imagem' ? <img src={preview.url} alt={preview.name}/> : preview.type === 'Vídeo' ? <video src={preview.url} controls preload="metadata"/> : preview.type === 'Áudio' ? <audio src={preview.url} controls preload="metadata"/> : <p>Prévia indisponível</p>}</div><div className="image-modal-details"><span className="image-modal-source">{preview.type}</span><h2 title={preview.name}>{preview.name}</h2><p className="media-preview-path">{preview.relativePath || preview.path}</p><Classification key={preview.id} item={preview} people={personOptions} onSave={saveClassification}/><div className="image-modal-actions"><button type="button" className="copy-button" onClick={() => copy(preview)}><Copy size={15}/>Copiar</button><button type="button" className="copy-button" onClick={() => open(preview)}><FolderOpen size={15}/>Abrir arquivo</button>{["Áudio", "Vídeo"].includes(preview.type) && <button type="button" className="copy-button" onClick={() => { setTranscriptionId(preview.id); setPreviewId(null); setTab("transcription"); }}><Captions size={15}/>Gerar legenda</button>}</div></div></div></div>}<footer className="footer-note">Ribbit Frame · biblioteca local</footer></div>;
}



