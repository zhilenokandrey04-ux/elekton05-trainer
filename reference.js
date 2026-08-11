(function () {
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const secFilter = document.getElementById('secFilter');
  SECTIONS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.id}. ${s.title}`;
    secFilter.appendChild(opt);
  });

  function valueLabel(f) {
    if (f.type === 'ro') return f.l2 || '—';
    if (f.type === 'enum') return `[${f.options.join(' / ')}]  тек.: ${f.value}`;
    if (f.kind === 'time') return f.value;
    if (typeof f.value === 'number') return `${f.value}${f.unit ? ' ' + f.unit : ''}`;
    return String(f.value ?? '—');
  }

  function renderResults() {
    const q = document.getElementById('q').value.trim().toLowerCase();
    const secId = secFilter.value;
    const rows = [];
    SECTIONS.forEach((s) => {
      if (secId && String(s.id) !== secId) return;
      s.functions.forEach((f) => {
        const hay = `${f.code} ${f.l1} ${f.l2 || ''} ${(f.help || '')}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        rows.push({ s, f });
      });
    });

    const box = document.getElementById('results');
    if (!rows.length) { box.innerHTML = '<div class="empty">Ничего не найдено.</div>'; return; }

    box.innerHTML = `<table class="ref">
      <thead><tr><th style="width:70px;">№</th><th style="width:150px;">Раздел</th><th>Название</th><th>Значение / диапазон</th></tr></thead>
      <tbody>
        ${rows.map(({ s, f }) => `
          <tr>
            <td class="code">${escapeHtml(f.code)}</td>
            <td><span class="sec-tag">${s.id}</span>${escapeHtml(s.title)}</td>
            <td>${escapeHtml(f.l1)}${f.help ? `<div class="default" style="margin-top:3px;font-size:12px;">${escapeHtml(f.help)}</div>` : ''}</td>
            <td class="default">${escapeHtml(valueLabel(f))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  document.getElementById('q').addEventListener('input', renderResults);
  secFilter.addEventListener('change', renderResults);
  renderResults();

  document.getElementById('messages').innerHTML = STOP_MESSAGES.map(([msg, desc]) => `
    <div class="msg-row">
      <div class="msg-name">${escapeHtml(msg)}</div>
      <div class="default">${escapeHtml(desc)}</div>
    </div>
  `).join('');
})();
