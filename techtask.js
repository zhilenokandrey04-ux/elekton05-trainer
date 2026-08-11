/* ============================================================
   Задание технолога — второй этап проверки.
   Появляется после успешной сдачи журнала оператора: технолог
   просит изменить конкретные уставки на станции. Тренируемый
   вносит правки через саму панель (ВВОД/разряды/список значений),
   затем нажимает «Проверить изменения».
   ============================================================ */
(function () {
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // Пул кандидатов — только редактируемые уставки, не пересекается с функциями журнала оператора
  const POOL = [
    { code: '000', label: 'Режим работы', kind: 'enum', section: '1. Текущие параметры' },
    { code: '048', label: 'Перегруз двиг.', kind: 'enum', section: '3. Уставки и защиты' },
    { code: '049', label: 'Перегруз двиг., уставка', kind: 'num', unit: '%', decimals: 0, min: 60, max: 150, section: '3. Уставки и защиты' },
    { code: '055', label: 'Недогруз двиг.', kind: 'enum', section: '3. Уставки и защиты' },
    { code: '062', label: 'Дисб. тока двиг.', kind: 'enum', section: '3. Уставки и защиты' },
    { code: '063', label: 'Дисб. тока двиг., уставка', kind: 'num', unit: '%', decimals: 0, min: 5, max: 30, section: '3. Уставки и защиты' },
    { code: '069', label: 'Сопр. изоляции (защита)', kind: 'enum', section: '3. Уставки и защиты' },
    { code: '070', label: 'Сопр. изоляции, уставка', kind: 'num', unit: 'кОм', decimals: 0, min: 10, max: 80, section: '3. Уставки и защиты' },
    { code: '071', label: 'Турбин. вращение (защита)', kind: 'enum', section: '3. Уставки и защиты' },
    { code: '072', label: 'Турбин. вращение, уставка', kind: 'num', unit: 'Гц', decimals: 0, min: 2, max: 10, section: '3. Уставки и защиты' },
    { code: '082', label: 'Направл. вращения', kind: 'enum', section: '4. Настройка ПЧ' },
    { code: '083', label: 'Режим пуска', kind: 'enum', section: '4. Настройка ПЧ' },
    { code: '110', label: 'Миним. частота (защита)', kind: 'enum', section: '4. Настройка ПЧ' },
    { code: '111', label: 'Миним. частота, уставка', kind: 'num', unit: 'Гц', decimals: 2, min: 3, max: 15, section: '4. Настройка ПЧ' },
    { code: '115', label: 'Максим. частота (защита)', kind: 'enum', section: '4. Настройка ПЧ' },
    { code: '116', label: 'Максим. частота, уставка', kind: 'num', unit: 'Гц', decimals: 2, min: 50, max: 75, section: '4. Настройка ПЧ' },
    { code: '121', label: 'Компенсация Ud', kind: 'enum', section: '4. Настройка ПЧ' },
  ];

  function findFunc(code) {
    for (const s of SECTIONS) {
      const f = s.functions.find((x) => x.code === code);
      if (f) return f;
    }
    return null;
  }

  function randNum(min, max, decimals) {
    const v = Math.random() * (max - min) + min;
    return parseFloat(v.toFixed(decimals));
  }

  let currentTask = [];

  function pickTask(n) {
    const shuffled = POOL.slice().sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, n);
    return chosen.map((entry) => {
      const f = findFunc(entry.code);
      let targetValue, targetDisplay;
      if (entry.kind === 'enum') {
        const opts = f.options.filter((o) => o !== f.value);
        const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : f.options[0];
        targetValue = pick;
        targetDisplay = pick;
      } else {
        let v;
        let guard = 0;
        do { v = randNum(entry.min, entry.max, entry.decimals); guard++; } while (v === f.value && guard < 20);
        targetValue = v;
        targetDisplay = `${v.toFixed(entry.decimals)}${entry.unit ? ' ' + entry.unit : ''}`;
      }
      return Object.assign({}, entry, { targetValue, targetDisplay });
    });
  }

  function renderTask() {
    const box = document.getElementById('techtask-list');
    box.innerHTML = currentTask.map((t, i) => `
      <li class="techtask-item" id="tt-item-${i}">
        <span class="tt-code">${escapeHtml(t.code)}</span> «${escapeHtml(t.label)}»
        <span class="tt-where">(раздел ${escapeHtml(t.section)})</span>
        → установить <b class="tt-target">${escapeHtml(t.targetDisplay)}</b>
      </li>
    `).join('');
    const result = document.getElementById('techtask-result');
    result.textContent = '';
    result.className = 'journal-score';
  }

  function showTask() {
    currentTask = pickTask(3);
    const panel = document.getElementById('techtask-panel');
    panel.style.display = '';
    renderTask();
    if (typeof window.__electonLog === 'function') window.__electonLog('Технолог передал задание на изменение параметров');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function checkTask() {
    if (!currentTask.length) return;
    let correct = 0;
    currentTask.forEach((t, i) => {
      const f = findFunc(t.code);
      const li = document.getElementById('tt-item-' + i);
      let ok, curDisplay;
      if (t.kind === 'enum') {
        ok = f.value === t.targetValue;
        curDisplay = f.value;
      } else {
        const cur = Number(f.value);
        ok = cur.toFixed(t.decimals) === Number(t.targetValue).toFixed(t.decimals);
        curDisplay = `${cur.toFixed(t.decimals)}${t.unit ? ' ' + t.unit : ''}`;
      }
      if (ok) correct++;
      li.className = 'techtask-item ' + (ok ? 'tt-ok' : 'tt-bad');
      li.innerHTML = `
        <span class="tt-mark">${ok ? '✔' : '✘'}</span>
        <span class="tt-code">${escapeHtml(t.code)}</span> «${escapeHtml(t.label)}»
        → нужно: <b class="tt-target">${escapeHtml(t.targetDisplay)}</b>
        · сейчас: <span class="tt-current">${escapeHtml(String(curDisplay))}</span>
      `;
    });
    const result = document.getElementById('techtask-result');
    if (correct === currentTask.length) {
      result.textContent = `Верно: ${correct} из ${currentTask.length} — все изменения внесены правильно!`;
      result.className = 'journal-score ok';
    } else {
      result.textContent = `Верно: ${correct} из ${currentTask.length} — проверьте пункты, отмеченные красным.`;
      result.className = 'journal-score bad';
    }
    if (typeof window.__electonLog === 'function') window.__electonLog(`Проверка задания технолога: ${correct} из ${currentTask.length} верно`);
    if (typeof window.__electonRender === 'function') window.__electonRender();
  }

  const checkBtn = document.getElementById('btn-techtask-check');
  const newBtn = document.getElementById('btn-techtask-new');
  if (checkBtn) checkBtn.addEventListener('click', checkTask);
  if (newBtn) newBtn.addEventListener('click', showTask);

  // вызывается из journal.js при успешной сдаче журнала
  window.__electonShowTechTask = showTask;
})();
