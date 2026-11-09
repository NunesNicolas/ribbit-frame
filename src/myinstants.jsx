import { useState } from 'react';
import { AudioLines, Download, Search } from 'lucide-react';

export function MyInstantsTools({ folders, onImported }) {
  const api = window.forEditor;
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [folderId, setFolderId] = useState('local');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  if (!api) return <section className="download-view"><p>Busca de efeitos sonoros disponível no aplicativo desktop.</p></section>;
  async function search(nextPage = 1, term = query) {
    setBusy(true); setMessage('');
    try {
      const result = await api.myinstantsSearch(term.trim(), nextPage);
      setData(result); setSearched(term.trim()); setPage(nextPage);
      if (!result.sounds.length) setMessage('Nenhum som encontrado para esta busca.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function save(sound) {
    setSaving(sound.url); setMessage('');
    try {
      const item = await api.myinstantsSave({ url: sound.url, folderId });
      await onImported();
      setMessage(`${item.name} salvo na biblioteca.`);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(''); }
  }
  return <section className="download-view image-search-view">
    <div className="view-heading"><h1>Efeitos sonoros</h1><p>Pesquise no MyInstants, ouça e salve MP3 na sua biblioteca.</p></div>
    <form className="url-form" onSubmit={event => { event.preventDefault(); search(); }}><label htmlFor="sound-query">Buscar som</label><div><Search size={18}/><input id="sound-query" type="search" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={100} placeholder="Ex.: risada, explosão, meme…" required/><button disabled={busy || query.trim().length < 2}>{busy ? 'Buscando…' : 'Buscar'}</button></div></form>
    <label className="sound-destination">Salvar em <select value={folderId} onChange={event => setFolderId(event.target.value)}>{folders.filter(folder => folder.id === 'local' || folder.kind === 'linked').map(folder => <option key={folder.id} value={folder.id}>{folder.id === 'local' ? 'Local' : folder.name}</option>)}</select></label>
    {message && <div className="image-toast" role="status">{message}</div>}
    {data && <><p>{data.count} resultado(s) para “{searched}” · página {page}</p><div className="sound-results">{data.sounds.map(sound => <article className="sound-result" key={sound.url}><div><AudioLines size={19}/><strong>{sound.name}</strong></div><audio src={sound.url} controls preload="none"/><button className="copy-button" onClick={() => save(sound)} disabled={Boolean(saving)}><Download size={15}/>{saving === sound.url ? 'Salvando…' : 'Salvar MP3'}</button></article>)}</div><div className="sound-pages"><button className="copy-button" disabled={busy || page <= 1} onClick={() => search(page - 1, searched)}>Anterior</button><span>Página {page}</span><button className="copy-button" disabled={busy || !data.hasMore} onClick={() => search(page + 1, searched)}>Próxima</button></div></>}
    <p className="field-hint">A busca usa a API pública do MyInstants, limitada a 10 consultas por minuto sem conta.</p>
  </section>;
}
