import React from 'react';

export function Pagination({ page, pages, pageSize, onPage, onPageSize, total }) {
  return <div className="pagination">
    <label>Por página <select value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[20, 40, 80, 120].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    <span>{total ? `Página ${page} de ${pages} · ${total} itens` : 'Nenhum item'}</span>
    <div><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button></div>
  </div>;
}
