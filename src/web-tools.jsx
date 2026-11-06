import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Image as ImageIcon, Link2, LoaderCircle, ExternalLink } from 'lucide-react';
import { Pagination } from './pagination';
import { library } from './browser-library';

export function YouTubeTools({ folders, onImported }) {
  const api = window.forEditor;
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState(null);
  const [format, setFormat] = useState('');
  const [folderId, setFolderId] = useState('downloads');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => api?.onWebProgress?.(setProgress), []);
  if (!api) return <div className="tool-empty">Downloads do YouTube disponíveis no aplicativo desktop.</div>;
  async function inspect(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null); setVideo(null);
    setProgress({ phase: 'inspecting', percent: null, label: 'Consultando vídeo e formatos…' });
    try { const data = await api.youtubeFormats(url); setVideo(data); setFormat(data.options[0]?.id || ''); setProgress(null); }
    catch (cause) { setError(cause.message); setProgress(null); }
    finally { setBusy(false); }
  }
  async function chooseFolder() {
    try { const chosen = await api.chooseDestination(); if (chosen) { await onImported(); setFolderId(chosen); } }
    catch (cause) { setError(cause.message); }
  }
  async function download() {
    setBusy(true); setError(''); setResult(null);
    setProgress({ phase: 'preparing', percent: null, label: 'Preparando download…' });
    try { const saved = await api.youtubeDownload(url, format, folderId); await onImported(); setResult(saved); setProgress({ phase: 'saved', percent: 100, label: 'Arquivo salvo na biblioteca.' }); }
    catch (cause) { setError(cause.message); setProgress(null); }
    finally { setBusy(false); }
  }
  return <section className="download-view">
    <div className="view-heading"><div><h1>Baixar do YouTube</h1><p>Consulte o vídeo, escolha formato, qualidade e pasta de destino.</p></div></div>
    <form className="url-form" onSubmit={inspect}><label htmlFor="youtube-url">Link do vídeo</label><div><Link2 size={18}/><input id="youtube-url" type="url" required placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={event => { setUrl(event.target.value); setVideo(null); setResult(null); setProgress(null); }}/><button disabled={busy || !url.trim()}>{busy && !video ? 'Consultando…' : 'Consultar'}</button></div></form>
    {video && <div className="download-layout"><div className="video-preview">{video.thumbnail ? <img src={video.thumbnail} alt={`Capa de ${video.title}`}/> : <div className="preview-placeholder"><ImageIcon size={32}/><span>Capa indisponível</span></div>}<div><span>VÍDEO ENCONTRADO</span><h2>{video.title}</h2></div></div><div className="download-controls"><label>Formato e qualidade<select value={format} onChange={event => setFormat(event.target.value)}>{video.options.map(option => <option key={option.id} value={option.id}>{option.audioOnly ? `Áudio · ${option.ext.toUpperCase()}` : `Vídeo · ${option.ext.toUpperCase()} · ${option.height}p · ${option.fps} fps`}</option>)}</select></label><label>Salvar na pasta<select value={folderId} onChange={event => setFolderId(event.target.value)}>{folders.filter(folder => folder.id === 'downloads' || folder.kind === 'linked').map(folder => <option key={folder.id} value={folder.id}>{folder.name === 'Downloads' ? 'Downloads (padrão)' : folder.path}</option>)}</select></label><button className="choose-folder" disabled={busy} onClick={chooseFolder}>Escolher outra pasta…</button><button className="primary-action" disabled={busy || !format} onClick={download}><Download size={16}/>{busy ? 'Baixando…' : 'Baixar para a biblioteca'}</button><p className="field-hint">Pasta vinculada: o arquivo será salvo diretamente no local escolhido.</p></div></div>}
    {progress && <div className={`download-status ${progress.phase === 'saved' ? 'complete' : ''}`} role="status"><div className="status-title">{progress.phase === 'saved' ? <CheckCircle2 size={18}/> : <LoaderCircle size={18} className="spinning"/>}<strong>{progress.phase === 'saved' ? 'Download concluído' : progress.phase === 'processing' ? 'Processando arquivo' : progress.phase === 'downloading' ? 'Baixando arquivo' : 'Preparando'}</strong><span>{progress.percent == null ? 'Em andamento' : `${Math.round(progress.percent)}%`}</span></div><div className={`progress-track ${progress.percent == null ? 'indeterminate' : ''}`} role="progressbar" aria-label="Progresso do download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent ?? undefined}><div style={progress.percent == null ? undefined : { width: `${progress.percent}%` }}/></div><p>{progress.label}</p></div>}
    {result && <div className="saved-result" role="status"><CheckCircle2 size={20}/><div><strong>Salvo com sucesso em {result.folderName}</strong><span>{result.path}</span></div></div>}
    {error && <div className="tool-error" role="alert">Falha no download: {error}</div>}
    {!video && !progress && !error && <div className="tool-empty"><Download size={27}/><strong>Seu próximo arquivo começa pelo link</strong><p>Depois da consulta, a capa e as opções de qualidade aparecem aqui.</p></div>}
  </section>;
}

export function ImageSearchTools({ onImported }) {
  const api = window.forEditor;
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [moreBusy, setMoreBusy] = useState(false);
  const [imagePages, setImagePages] = useState({});
  const [imagePageSize, setImagePageSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [folders, setFolders] = useState([]);
  const [people, setPeople] = useState([]);
  const [folderId, setFolderId] = useState('downloads');
  const [person, setPerson] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4500); return () => clearTimeout(timer); }, [message]);
  useEffect(() => {
    if (!api) return;
    Promise.all([api.listFolders(), api.listPeople()]).then(([foundFolders, foundPeople]) => { setFolders(foundFolders); setPeople(foundPeople); }).catch(error => setMessage(error.message));
  }, []);
  useEffect(() => {
    if (!selected) return;
    const close = event => { if (event.key === 'Escape' && !busy) setSelected(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selected, busy]);
  if (!api) return <div className="tool-empty">Busca de imagens disponível no aplicativo desktop.</div>;
  async function search(event) {
    event.preventDefault(); setBusy(true); setMessage('Buscando imagens…'); setGroups([]);
    try {
      const results = await api.imageSearch(query);
      setGroups(results); setSearchedQuery(query.trim()); setImagePages({});
      const count = results.reduce((total, group) => total + group.images.length, 0);
      setMessage(count ? `${count} imagem(ns) encontrada(s).` : 'Nenhuma imagem foi encontrada. Tente outras palavras.');
    } catch (error) { setMessage(`Erro: ${error.message}`); }
    finally { setBusy(false); }
  }
  async function loadMore() {
    setMoreBusy(true);
    try {
      const result = await api.imageMore(searchedQuery);
      setGroups(current => current.map(group => group.source === 'Pinterest' ? { ...group, images: [...new Map([...group.images, ...result.images].map(image => [image.url, image])).values()], hasMore: result.hasMore, error: result.error } : group));
      if (result.images.length) setImagePages(current => ({ ...current, Pinterest: Math.ceil((groups.find(group => group.source === 'Pinterest')?.images.length + result.images.length) / imagePageSize) }));
      setMessage(result.images.length ? `Mais ${result.images.length} imagem(ns) do Pinterest.` : 'Nenhuma imagem nova nesta página.');
    } catch (error) { setMessage(`Erro: ${error.message}`); }
    finally { setMoreBusy(false); }
  }
  async function chooseFolder() {
    try {
      const chosen = await api.chooseDestination();
      if (chosen) { setFolders(await api.listFolders()); setFolderId(chosen); }
    } catch (error) { setMessage(`Erro: ${error.message}`); }
  }
  async function save() {
    if (!selected) return;
    setBusy(true); setMessage('Salvando imagem…');
    try {
      const chosenPerson = newPerson.trim() || person;
      const tags = [...new Set(tagsText.split(',').map(tag => tag.trim()).filter(Boolean))];
      const saved = await api.imageSave({ url: selected.url, folderId, person: chosenPerson, tags });
      if (newPerson.trim()) setPeople(await api.addPerson(newPerson.trim()));
      await onImported();
      setMessage(`Imagem salva em ${saved.folderName} e incluída na biblioteca.`);
      setSelected(null); setPerson(''); setNewPerson(''); setTagsText('');
    } catch (error) { setMessage(`Erro: ${error.message}`); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!selected) return;
    setBusy(true);
    try { await api.imageCopy(selected.url); setMessage('Imagem copiada para a área de transferência.'); }
    catch (error) { setMessage(`Erro: ${error.message}`); }
    finally { setBusy(false); }
  }
  return <section className="download-view image-search-view">
    <div className="view-heading"><h1>Buscar imagens</h1><p>Pesquise por palavras no Google Imagens e no Pinterest. Abra um resultado para ver, copiar ou salvar.</p></div>
    <form className="url-form" onSubmit={search}><label htmlFor="image-query">O que você procura?</label><div><ImageIcon size={18}/><input id="image-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: pessoa surpresa, paisagem noturna…" minLength={2} required/><button disabled={busy || query.trim().length < 2}>{busy ? 'Buscando…' : 'Buscar'}</button></div></form>
    {message && <div className={`image-toast ${message.startsWith('Erro:') ? 'error' : ''}`} role="status">{message}</div>}
    {groups.map(group => <div key={group.source} className="image-source"><div className="image-source-heading"><h2>{group.source}</h2><span>{group.images.length} resultados</span>{group.source === 'Pinterest' && <button className="open-pinterest" title="Abrir Pinterest em outra janela" onClick={() => api.pinterestOpen(searchedQuery).catch(error => setMessage(`Erro: ${error.message}`))}><ExternalLink size={15}/>Abrir site</button>}</div>{group.error && <p className="source-error">Fonte indisponível: {group.error}</p>}<div className="image-results">{group.images.slice(((imagePages[group.source] || 1) - 1) * imagePageSize, (imagePages[group.source] || 1) * imagePageSize).map(image => <button key={image.url} onClick={() => setSelected(image)} title="Ampliar imagem"><img src={image.url} alt={`Resultado de ${group.source} para ${query}`} loading="lazy"/><span>Visualizar</span></button>)}</div><Pagination page={Math.min(imagePages[group.source] || 1, Math.max(1, Math.ceil(group.images.length / imagePageSize)))} pages={Math.max(1, Math.ceil(group.images.length / imagePageSize))} pageSize={imagePageSize} total={group.images.length} onPage={value => setImagePages(current => ({ ...current, [group.source]: value }))} onPageSize={value => { setImagePageSize(value); setImagePages({}); }}/>{group.source === 'Pinterest' && group.hasMore && <button className="image-more-button" onClick={loadMore} disabled={moreBusy || busy}>{moreBusy ? 'Carregando…' : 'Carregar mais do Pinterest'}</button>}</div>)}
    {selected && <div className="image-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelected(null); }}><div className="image-modal" role="dialog" aria-modal="true" aria-label="Visualizar imagem"><button className="image-modal-close" aria-label="Fechar" onClick={() => setSelected(null)} disabled={busy}>×</button><div className="image-modal-preview"><img src={selected.url} alt={`Imagem encontrada em ${selected.source}`}/></div><div className="image-modal-details"><span className="image-modal-source">{selected.source}</span><h2>Salvar na biblioteca</h2><label>Pasta<select value={folderId} onChange={event => setFolderId(event.target.value)}>{folders.filter(folder => folder.id === 'downloads' || folder.kind === 'linked').map(folder => <option key={folder.id} value={folder.id}>{folder.id === 'downloads' ? 'Downloads (padrão)' : folder.path}</option>)}</select></label><button type="button" className="choose-folder" onClick={chooseFolder} disabled={busy}>Escolher outra pasta…</button><label>Pessoa<select value={person} onChange={event => setPerson(event.target.value)}><option value="">Sem pessoa</option>{people.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Nova pessoa<input value={newPerson} maxLength={120} onChange={event => setNewPerson(event.target.value)} placeholder="Opcional"/></label><label>Tags<input value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="tag 1, tag 2"/></label><div className="image-modal-actions"><button className="copy-button" onClick={copy} disabled={busy}>Copiar imagem</button><button className="primary-action" onClick={save} disabled={busy}>{busy ? 'Aguarde…' : 'Salvar imagem'}</button></div></div></div></div>}
  </section>;
}
export function SettingsTools({ onChanged }) {
  const api = window.forEditor;
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    try { setConnected((await api.pinterestStatus()).connected); setError(''); }
    catch (cause) { setError(cause.message); }
  }
  useEffect(() => { if (api) refresh(); }, []);
  if (!api) return <section className="download-view"><div className="view-heading"><h1>Configurações</h1><p>Conexão de contas disponível no aplicativo desktop.</p></div><TaxonomySettings onChanged={onChanged}/></section>;
  async function login() {
    setBusy(true); setError('');
    try { await api.pinterestLogin(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError('');
    try { await api.pinterestDisconnect(); await refresh(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  return <section className="download-view settings-view"><div className="view-heading"><h1>Configurações</h1><p>Gerencie as contas usadas na busca de imagens.</p></div><div className="account-card"><div><h2>Pinterest</h2><p>O login abre em uma janela separada. A sessão fica salva apenas neste computador e pode ajudar a encontrar resultados do Pinterest.</p><strong className={connected ? 'account-connected' : ''}>{connected ? 'Conta conectada' : 'Conta não conectada'}</strong></div><div className="account-actions"><button className="primary-action" disabled={busy} onClick={login}>{connected ? 'Abrir Pinterest' : 'Conectar Pinterest'}</button><button className="copy-button" disabled={busy} onClick={refresh}>Atualizar estado</button>{connected && <button className="copy-button" disabled={busy} onClick={disconnect}>Desconectar</button>}</div></div><TaxonomySettings onChanged={onChanged}/>{error && <div className="tool-error" role="alert">{error}</div>}</section>;
}
function TaxonomySettings({ onChanged }) {
  const [taxonomy, setTaxonomy] = useState({ people: [], tags: [], categories: [] });
  const [drafts, setDrafts] = useState({ people: '', tags: '', categories: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() { if (!library.listTaxonomy) throw new Error('Reinicie o aplicativo para ativar a organização do catálogo.'); setTaxonomy(await library.listTaxonomy()); await onChanged?.(); }
  useEffect(() => { refresh().catch(cause => setError(cause.message)); }, []);
  async function add(event, kind) {
    event.preventDefault(); setBusy(true); setError('');
    try { if (!library.addTaxonomy) throw new Error('Reinicie o aplicativo para ativar esta opção.'); await library.addTaxonomy({ kind, name: drafts[kind] }); setDrafts(current => ({ ...current, [kind]: '' })); await refresh(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function remove(kind, name) {
    if (!window.confirm('Excluir "' + name + '"? Esta classificação será removida de todos os arquivos catalogados.')) return;
    setBusy(true); setError('');
    try { if (!library.removeTaxonomy) throw new Error('Reinicie o aplicativo para ativar esta opção.'); await library.removeTaxonomy({ kind, name }); await refresh(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  return <div className="taxonomy-settings"><h2>Organização do catálogo</h2><p>Gerencie pessoas, tags e categorias usadas nos arquivos.</p><div className="taxonomy-grid">{[['people', 'Pessoas'], ['tags', 'Tags'], ['categories', 'Categorias']].map(([kind, title]) => <section key={kind} className="taxonomy-card"><h3>{title} <span>{taxonomy[kind].length}</span></h3><form onSubmit={event => add(event, kind)}><input aria-label={'Nova ' + title.toLowerCase()} value={drafts[kind]} maxLength={120} onChange={event => setDrafts(current => ({ ...current, [kind]: event.target.value }))} placeholder={'Adicionar ' + title.toLowerCase()} required/><button disabled={busy || !drafts[kind].trim()}>Adicionar</button></form><div className="taxonomy-list">{taxonomy[kind].map(name => <div key={name}><span title={name}>{name}</span><button type="button" disabled={busy} aria-label={'Excluir ' + name} onClick={() => remove(kind, name)}>Excluir</button></div>)}{!taxonomy[kind].length && <small>Nenhum item cadastrado.</small>}</div></section>)}</div>{error && <div className="tool-error" role="alert">{error}</div>}</div>;
}
