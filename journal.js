/* ============================================================
   Журнал оператора — считывание показаний со станции
   Читает значения напрямую из тех же объектов SECTIONS (data.js),
   которые изменяет simulator.js, поэтому всегда видит актуальные данные.
   ============================================================ */
(function () {
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const FIELDS = [
    { key: 'freq', label: 'Частота', code: '003', unit: 'Гц', decimals: 2 },
    { key: 'current', label: 'Ток двигателя', code: ['004', '005', '006'], agg: 'max', unit: 'А', decimals: 1 },
    { key: 'load', label: 'Загрузка', code: '018', unit: '%', decimals: 0 },
    { key: 'zsp', label: 'Зсп (глубина спуска)', code: '227', unit: 'м', decimals: 0 },
    { key: 'iso', label: 'Сопр. изоляции', code: '024', unit: 'кОм', decimals: 0 },
    { key: 'temp', label: 'Температура', code: '030', unit: '°C', decimals: 0 },
    { key: 'press', label: 'Давление', code: '028', unit: 'атм.', decimals: 0 },
    { key: 'cos', label: 'Cos φ', code: '017', unit: '', decimals: 2 },
    { key: 'pact', label: 'Активная мощность', code: '015', unit: 'кВт', decimals: 1 },
    { key: 'uout', label: 'Выходное напряжение', code: '013', unit: 'В', decimals: 0 },
  ];

  function findFunc(code) {
    for (const s of SECTIONS) {
      const f = s.functions.find((x) => x.code === code);
      if (f) return f;
    }
    return null;
  }

  function readStationValue(field) {
    const codes = Array.isArray(field.code) ? field.code : [field.code];
    const vals = codes.map((c) => {
      const f = findFunc(c);
      return f && typeof f.value === 'number' ? f.value : (f ? parseFloat(f.value) : NaN);
    }).filter((v) => !isNaN(v));
    if (!vals.length) return null;
    let v;
    if (field.agg === 'max') v = Math.max(...vals);
    else v = vals[0];
    return v.toFixed(field.decimals);
  }

  // ---- build the field table ----
  const tbody = document.getElementById('journal-fields-body');
  tbody.innerHTML = FIELDS.map((f) => `
    <tr>
      <td>${escapeHtml(f.label)}</td>
      <td><input type="text" id="jf-${f.key}" placeholder="—"></td>
      <td>${escapeHtml(f.unit)}</td>
    </tr>
  `).join('');

  function readFromStation() {
    FIELDS.forEach((f) => {
      const v = readStationValue(f);
      const el = document.getElementById('jf-' + f.key);
      if (el && v !== null) el.value = v;
    });
    flashButton('btn-journal-read');
  }

  function flashButton(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transform = 'scale(.97)';
    setTimeout(() => { el.style.transform = ''; }, 120);
  }

  // ---- history ----
  const entries = [];
  const historyBody = document.getElementById('journal-history-body');

  function renderHistory() {
    if (!entries.length) {
      historyBody.innerHTML = `<tr class="journal-empty-row"><td colspan="${FIELDS.length + 1}">Записей пока нет — считайте показания и нажмите «Записать в журнал».</td></tr>`;
      return;
    }
    historyBody.innerHTML = entries.map((e) => `
      <tr>
        <td>${escapeHtml(e.time)}</td>
        ${FIELDS.map((f) => `<td>${escapeHtml(e.values[f.key] || '—')}</td>`).join('')}
      </tr>
    `).join('');
  }

  function addEntry() {
    const values = {};
    let hasAny = false;
    FIELDS.forEach((f) => {
      const el = document.getElementById('jf-' + f.key);
      const v = el ? el.value.trim() : '';
      values[f.key] = v;
      if (v) hasAny = true;
    });
    if (!hasAny) { alert('Сначала считайте или впишите показания.'); return; }
    const time = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entries.unshift({ time, values });
    renderHistory();
  }

  function clearJournal() {
    if (!entries.length) return;
    if (!confirm('Очистить весь журнал записей?')) return;
    entries.length = 0;
    renderHistory();
  }

  function downloadCsv() {
    if (!entries.length) { alert('Журнал пуст — нечего скачивать.'); return; }
    const header = ['Время', ...FIELDS.map((f) => `${f.label} (${f.unit || '-'})`)];
    const rows = entries.map((e) => [e.time, ...FIELDS.map((f) => e.values[f.key] || '')]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elekton05-journal-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.getElementById('btn-journal-read').addEventListener('click', readFromStation);
  document.getElementById('btn-journal-add').addEventListener('click', addEntry);
  document.getElementById('btn-journal-csv').addEventListener('click', downloadCsv);
  document.getElementById('btn-journal-clear').addEventListener('click', clearJournal);

  renderHistory();
  // подставим первые значения сразу при загрузке страницы
  setTimeout(readFromStation, 500);
})();
