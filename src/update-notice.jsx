import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

export function UpdateNotice() {
  const api = window.forEditor;
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!api?.updateCheck) return;
    let mounted = true;
    api.updateCheck().then(value => { if (mounted) setUpdate(value); }).catch(() => {});
    const unsubscribe = api.onUpdateProgress?.(value => { if (mounted) setPercent(value); });
    return () => { mounted = false; unsubscribe?.(); };
  }, [api]);
  if (!update && !error) return null;
  async function install() {
    setBusy(true); setError(''); setPercent(0);
    try { await api.updateInstall(); }
    catch (cause) { setError(cause.message); setBusy(false); setPercent(null); }
  }
  return <div className="update-notice" role="status"><div><strong>{error ? 'Falha ao atualizar' : `Nova versão disponível: ${update.tag}`}</strong><span>{error || (busy ? `Baixando atualização: ${percent ?? 0}%` : 'Baixe e abra o instalador pelo aplicativo.')}</span></div>{busy ? <progress max="100" value={percent ?? 0}/> : <button className="primary-action" onClick={install}><Download size={15}/>Instalar atualização</button>}</div>;
}

