import { useState } from 'react';

export function Classification({ item, people, onSave }) {
  const [person, setPerson] = useState(item.person || '');
  const [category, setCategory] = useState(item.category || '');
  const [tagsText, setTagsText] = useState((item.tags || (item.emotion ? [item.emotion] : [])).join(', '));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    const tags = [...new Set(tagsText.split(',').map(tag => tag.trim().slice(0, 120)).filter(Boolean))].slice(0, 100);
    try {
      await onSave({ ...item, person, category, tags }, 'tags', tags);
      setTagsText(tags.join(', '));
      setSaved(true);
    } catch {} finally { setSaving(false); }
  };
  return <form className="selected-editor" onSubmit={submit} onChange={() => setSaved(false)}>
    <div className="eyebrow">CLASSIFICAR SELECIONADO</div>
    <strong>{item.name}</strong>
    <div className="tag-fields">
      <label>Pessoa<select value={person} onChange={event => setPerson(event.target.value)}><option value="">Sem pessoa</option>{people.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Tags (separadas por vírgula)<input value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="feliz, reação, meme"/></label>
      <label>Categoria<input value={category} maxLength={120} onChange={event => setCategory(event.target.value)}/></label>
    </div>
    <button className="copy-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar classificação'}</button>
    {saved && <span role="status">Classificação salva.</span>}
  </form>;
}
