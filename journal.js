/* ============================================================
   Журнал оператора — режим проверки
   Тренируемый читает показания с панели и вписывает их вручную,
   кнопка «Проверить» сверяет ввод с реальными значениями станции
   и подсвечивает поля зелёным/красным.
   ============================================================ */
(function () {
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const FIELDS = [
    { key: 'freq', label: 'Частота', code: '003', unit: 'Гц', decimals: 2, min: 35, max: 65 },
    { key: 'current', label: 'Ток двигателя', code: ['004', '005', '006'], agg: 'max', unit: 'А', decimals: 1, min: 40, max: 140 },
    { key: 'load', label: 'Загрузка', code: '018', unit: '%', decimals: 0, min: 30, max: 100 },
    { key: 'zsp', label: 'ЗСП (уставка недогруза)', code: '056', unit: '%', decimals: 0, min: 40, max: 90 },
    { key: 'iso', label: 'Сопр. изоляции', code: '024', unit: 'кОм', decimals: 0, min: 200, max: 9999 },
    { key: 'temp', label: 'Температура', code: '030', unit: '°C', decimals: 0, min: 15, max: 95 },
    { key: 'press', label: 'Давление', code: '028', unit: 'атм.', decimals: 0, min: 10, max: 180 },
    { key: 'cos', label: 'Cos φ', code: '017', unit: '', decimals: 2, min: 0.6, max: 0.95 },
    { key: 'pact', label: 'Активная мощность', code: '015', unit: 'кВт', decimals: 1, min: 15, max: 140 },
    { key: 'uout', label: 'Выходное напряжение', code: '013', unit: 'В', decimals: 0, min: 340, max: 400 },
  ];

  function findFunc(code) {
    for (const s of SECTIONS) {
      const f = s.functions.find((x) => x.code === code);
      if (f) return f;
    }
    return null;
  }

  function targetString(field) {
    const codes = Array.isArray(field.code) ? field.code : [field.code];
    const vals = codes.map((c) => {
      const f = findFunc(c);
      return f && typeof f.value === 'number' ? f.value : (f ? parseFloat(f.value) : NaN);
    }).filter((v) => !isNaN(v));
    if (!vals.length) return null;
    const v = field.agg === 'max' ? Math.max(...vals) : vals[0];
    return v.toFixed(field.decimals);
  }

  function rand(min, max, decimals) {
    const v = Math.random() * (max - min) + min;
    return parseFloat(v.toFixed(decimals));
  }

  // ---- построение полей ----
  const tbody = document.getElementById('journal-fields-body');
  tbody.innerHTML = FIELDS.map((f) => `
    <tr>
      <td>${escapeHtml(f.label)}</td>
      <td><input type="text" id="jf-${f.key}" placeholder="—" autocomplete="off"></td>
      <td>${escapeHtml(f.unit)}</td>
    </tr>
  `).join('');

  // сброс подсветки при правке поля
  FIELDS.forEach((f) => {
    const el = document.getElementById('jf-' + f.key);
    el.addEventListener('input', () => {
      el.classList.remove('jf-correct', 'jf-wrong');
    });
  });

  function scorebox(text, cls) {
    const box = document.getElementById('journal-score');
    box.textContent = text;
    box.className = 'journal-score ' + (cls || '');
  }

  // ---- лучший результат (сохраняется между визитами) ----
  function loadBest() {
    if (!window.ElektonStore) return null;
    return window.ElektonStore.load().bestScore || null;
  }
  function maybeSaveBest(correct, total) {
    if (!window.ElektonStore) return;
    const store = window.ElektonStore.load();
    const prev = store.bestScore;
    if (!prev || correct > prev.correct) {
      window.ElektonStore.patch({ bestScore: { correct, total, date: new Date().toLocaleDateString('ru-RU') } });
    }
    renderBest();
  }
  function renderBest() {
    const el = document.getElementById('journal-best');
    if (!el) return;
    const best = loadBest();
    el.textContent = best
      ? `Лучший результат: ${best.correct} из ${best.total} (сохранено ${best.date})`
      : 'Лучший результат: пока нет попыток';
  }

  // ---- «Обновить показания» — генерирует новый вариант на станции ----
  function randomizeStation() {
    FIELDS.forEach((f) => {
      const v = rand(f.min, f.max, f.decimals);
      const codes = Array.isArray(f.code) ? f.code : [f.code];
      codes.forEach((c) => {
        const func = findFunc(c);
        if (func) func.value = v;
      });
    });
    FIELDS.forEach((f) => {
      const el = document.getElementById('jf-' + f.key);
      el.value = '';
      el.classList.remove('jf-correct', 'jf-wrong');
    });
    scorebox('Новые показания на станции. Считайте их с панели и впишите значения.', '');
    if (typeof window.__electonRender === 'function') window.__electonRender();
    if (typeof window.__electonLog === 'function') window.__electonLog('Показания станции обновлены (новый вариант проверки)');
  }

  // ---- «Проверить» — сверяет ввод с реальными значениями ----
  function checkAnswers() {
    let correct = 0;
    let filled = 0;
    FIELDS.forEach((f) => {
      const el = document.getElementById('jf-' + f.key);
      const raw = el.value.trim().replace(',', '.');
      el.classList.remove('jf-correct', 'jf-wrong');
      if (!raw) { el.classList.add('jf-wrong'); return; }
      filled++;
      const num = parseFloat(raw);
      const target = targetString(f);
      const typedFixed = isNaN(num) ? null : num.toFixed(f.decimals);
      if (typedFixed !== null && target !== null && typedFixed === target) {
        el.classList.add('jf-correct');
        correct++;
      } else {
        el.classList.add('jf-wrong');
      }
    });
    if (filled === 0) {
      scorebox('Сначала впишите показания, которые видите на панели.', '');
      return;
    }
    const pct = Math.round((correct / FIELDS.length) * 100);
    if (correct === FIELDS.length) {
      scorebox(`Верно: ${correct} из ${FIELDS.length} (${pct}%) — все показания сняты правильно!`, 'ok');
    } else {
      scorebox(`Верно: ${correct} из ${FIELDS.length} (${pct}%) — красным отмечены ошибки, исправьте и проверьте снова.`, 'bad');
    }
    maybeSaveBest(correct, FIELDS.length);
    if (typeof window.__electonLog === 'function') window.__electonLog(`Проверка журнала: ${correct} из ${FIELDS.length} верно`);
  }

  // ---- подсказка «Считать со станции» (режим тренировки, не для теста) ----
  function readFromStation() {
    FIELDS.forEach((f) => {
      const v = targetString(f);
      const el = document.getElementById('jf-' + f.key);
      if (el && v !== null) { el.value = v; el.classList.remove('jf-correct', 'jf-wrong'); }
    });
    scorebox('Подставлены подсказки — для проверки себя используйте «Обновить показания» без подсказок.', '');
  }

  // ---- история записей ----
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

  document.getElementById('btn-randomize').addEventListener('click', randomizeStation);
  document.getElementById('btn-journal-check').addEventListener('click', checkAnswers);
  document.getElementById('btn-journal-read').addEventListener('click', readFromStation);
  document.getElementById('btn-journal-add').addEventListener('click', addEntry);
  document.getElementById('btn-journal-csv').addEventListener('click', downloadCsv);
  document.getElementById('btn-journal-clear').addEventListener('click', clearJournal);

  renderHistory();
  renderBest(); // показать сохранённый лучший результат сразу при загрузке
  // при загрузке страницы сразу готовим первый вариант для проверки
  setTimeout(randomizeStation, 500);
})();
