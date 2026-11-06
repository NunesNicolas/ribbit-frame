import { useEffect, useMemo, useState } from 'react';
import { Captions, FolderOpen, LoaderCircle, Square } from 'lucide-react';

export function TranscriptionTools({ media, initialId, active }) {
  const api = window.forEditor;
  const [selectedId, setSelectedId] = useState(initialId || '');
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('large-v3-turbo');
  const [language, setLanguage] = useState('pt');
  const [format, setFormat] = useState('srt');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const files = useMemo(() => media.filter(item => ['Áudio', 'Vídeo'].includes(item.type) && !item.missing)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [media]);
  const matches = files.filter(item => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  useEffect(() => { if (initialId) setSelectedId(initialId); }, [initialId]);
  useEffect(() => api?.onTranscriptionProgress(setProgress), [api]);
  if (!api) return active ? <div className="tool-empty">A transcrição local está disponível no aplicativo desktop.</div> : null;
  async function chooseDestination() {
    try { const folder = await api.transcriptionDestination(); if (folder) setDestination(folder); }
    catch (cause) { setError(cause.message); }
  }
  async function start(event) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError(''); setResult(null);
    setProgress({ phase: 'setup', label: 'Preparando a transcrição local…' });
    try { setResult(await api.transcriptionRun({ id: selectedId, model, language, format, destination })); }
    catch (cause) { setError(cause.message); setProgress(null); }
    finally { setBusy(false); }
  }
  return <section className="download-view transcription-view" hidden={!active}>
    <div className="view-heading"><h1>Gerar legendas</h1><p>Transcreva áudio ou vídeo da biblioteca no próprio computador.</p></div>
    <form className="transcription-form" onSubmit={start}>
      <label>Buscar mídia<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome do áudio ou vídeo"/></label>
      <label>Arquivo<select value={selectedId} onChange={event => setSelectedId(event.target.value)} required><option value="">Selecione um arquivo</option>{matches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{selectedId && !matches.some(item => item.id === selectedId) && files.find(item => item.id === selectedId) && <option value={selectedId}>{files.find(item => item.id === selectedId).name}</option>}</select></label>
      <div className="transcription-options"><label>Modelo<select value={model} onChange={event => setModel(event.target.value)}><option value="large-v3-turbo">Large v3 Turbo</option></select></label><label>Idioma<select value={language} onChange={event => setLanguage(event.target.value)}><option value="auto">Detectar automaticamente</option><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option></select></label><label>Formato<select value={format} onChange={event => setFormat(event.target.value)}><option value="srt">SRT · Premiere</option><option value="vtt">VTT</option><option value="json">JSON · segmentos e tempos</option></select></label></div>
      <div className="transcription-destination"><span title={destination || undefined}>{destination || 'Salvar em Legendas, na pasta de dados do app'}</span><button type="button" className="copy-button" onClick={chooseDestination} disabled={busy}>Escolher pasta…</button>{destination && <button type="button" className="copy-button" onClick={() => setDestination('')} disabled={busy}>Usar padrão</button>}</div>
      <div className="transcription-actions"><button className="primary-action" disabled={busy || !selectedId}><Captions size={16}/>{busy ? 'Gerando legenda…' : 'Gerar legenda'}</button>{busy && <button type="button" className="copy-button" onClick={() => api.transcriptionCancel()}><Square size={14}/>Cancelar</button>}</div>
    </form>
    {progress && <div className={`download-status ${progress.phase === 'saved' ? 'complete' : ''}`} role="status"><div className="status-title">{busy && <LoaderCircle size={18} className="spinning"/>}<strong>{progress.phase === 'saved' ? 'Legenda concluída' : progress.phase === 'transcribing' ? 'Transcrevendo' : 'Preparando'}</strong><span>{progress.percent == null ? 'Em andamento' : `${progress.percent}%`}</span></div><div className="progress-track" role="progressbar" aria-label="Progresso da transcrição" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent ?? undefined}><div style={{ width: `${progress.percent || 0}%` }}/></div><p>{progress.label}</p></div>}
    {result && <div className="saved-result" role="status"><Captions size={20}/><div><strong>{result.segments} trecho(s) · {result.language?.toUpperCase()}</strong><span>{result.path}</span><button type="button" className="copy-button" onClick={() => api.transcriptionShow(result.path)}><FolderOpen size={15}/>Mostrar arquivo</button></div></div>}
    {error && <div className="tool-error" role="alert">Não foi possível gerar a legenda: {error}</div>}
    <p className="field-hint">Na primeira utilização, o app prepara Faster-Whisper e baixa o modelo large-v3-turbo. Depois, a transcrição funciona offline. Para português, selecione o idioma Português; este modelo exige mais memória e espaço em disco.</p>
  </section>;
}



