/* ============================================================
   ЭЛЕКТОН-05 — тренажёр панели «Электон-09.1»
   ============================================================ */
(function () {
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const mainMenuList = SECTIONS.map((s) => ({
    code: String(s.id).padStart(2, '0'),
    l1: s.title,
    l2: `функции ${s.range}`,
    type: 'section-link',
    ref: s,
  }));

  const state = {
    stack: [{ list: SECTIONS[0].functions, windowStart: 0, cursor: 0, level: 'root', label: 'Текущие параметры' }],
    editing: null, // {item, type:'enum'|'num', idx, valueStr, digPositions, digCursor}
    running: false,
    mode: 'автоматический',
    fault: null, // {msg, desc}
    heating: false,
    elapsed: 0, // seconds
    visitedMain: false,
    visitedSections: new Set(),
    startedOnce: false,
    stoppedManually: false,
  };

  // ---------- helpers ----------
  function top() { return state.stack[state.stack.length - 1]; }

  function digitPositions(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) if (/[0-9]/.test(str[i])) out.push(i);
    return out;
  }

  function formatValue(item) {
    if (item.kind === 'time') return String(item.value);
    if (item.type === 'enum') return item.value;
    if (item.secret) return item.value && Number(item.value) !== 0 ? '*****' : '0';
    if (typeof item.value === 'number') {
      const s = item.value.toFixed(item.decimals != null ? item.decimals : 0);
      return item.unit ? `${s} ${item.unit}` : s;
    }
    return String(item.value);
  }

  function clampWindow(frame) {
    if (frame.cursor < frame.windowStart) frame.windowStart = frame.cursor;
    else if (frame.cursor > frame.windowStart + 1) frame.windowStart = frame.cursor - 1;
    if (frame.windowStart > frame.list.length - 2) frame.windowStart = Math.max(0, frame.list.length - 2);
    if (frame.windowStart < 0) frame.windowStart = 0;
  }

  function fmtElapsed() {
    const h = Math.floor(state.elapsed / 3600);
    const m = Math.floor((state.elapsed % 3600) / 60);
    return `${h}ч${String(m).padStart(2, '0')}м`;
  }

  // ---------- logging / toast ----------
  const logEl = document.getElementById('log');
  function log(msg) {
    const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.innerHTML = `<span>${t}</span> ${escapeHtml(msg)}`;
    logEl.appendChild(div);
    logEl.scrollTop = 0;
  }
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  }

  // ---------- navigation ----------
  function goLeft() {
    if (state.editing) return;
    if (state.stack.length > 1) {
      state.stack.pop();
    } else {
      state.stack.push({ list: mainMenuList, windowStart: 0, cursor: 0, level: 'main', label: 'Главное меню' });
      state.visitedMain = true;
    }
    render();
  }

  function goRight() {
    if (state.editing) return;
    const t = top();
    if (t.level === 'main') {
      const sec = t.list[t.cursor].ref;
      state.stack.push({ list: sec.functions, windowStart: 0, cursor: 0, level: 'section', label: sec.title, sectionRef: sec });
      state.visitedSections.add(sec.id);
      log(`Открыт раздел: ${sec.id}. ${sec.title}`);
    }
    render();
  }

  function moveCursor(delta) {
    const t = top();
    if (state.editing) return;
    t.cursor = Math.max(0, Math.min(t.list.length - 1, t.cursor + delta));
    clampWindow(t);
    render();
  }

  // ---------- editing ----------
  function currentItem() {
    const t = top();
    return t.list[t.cursor];
  }

  function startEdit() {
    const item = currentItem();
    if (!item || item.type === 'ro' || item.ro || item.type === 'section-link') {
      toast('Только чтение — параметр недоступен для изменения');
      return;
    }
    if (item.type === 'enum') {
      state.editing = { item, type: 'enum', idx: Math.max(0, item.options.indexOf(item.value)) };
    } else {
      const raw = item.secret ? String(item.value) : formatValue(item);
      const digs = digitPositions(raw);
      state.editing = { item, type: 'num', valueStr: raw, digPositions: digs, digCursor: digs.length ? 0 : -1, orig: raw };
    }
    render();
  }

  function cancelEdit() {
    if (!state.editing) return;
    state.editing = null;
    render();
  }

  function commitEdit() {
    const ed = state.editing;
    if (!ed) return;
    const item = ed.item;
    if (ed.type === 'enum') {
      item.value = item.options[ed.idx];
      log(`${item.code} «${item.l1}» → ${item.value}`);
      if (item.action === 'reset-section' && item.value === 'ДА') {
        toast('Уставки раздела восстановлены по умолчанию');
        setTimeout(() => { item.value = 'НЕТ'; render(); }, 700);
      }
      if (item.code === '000') state.mode = item.value;
    } else {
      let str = ed.valueStr;
      if (item.kind === 'time') {
        item.value = str;
      } else if (item.secret) {
        item.value = parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
      } else {
        const num = parseFloat(str);
        item.value = isNaN(num) ? item.value : num;
      }
      log(`${item.code} «${item.l1}» → ${formatValue(item)}`);
    }
    state.editing = null;
    render();
    updateTasks();
  }

  function editDigitMove(delta) {
    const ed = state.editing;
    if (!ed || ed.type !== 'num' || !ed.digPositions.length) return;
    ed.digCursor = Math.max(0, Math.min(ed.digPositions.length - 1, ed.digCursor + delta));
    render();
  }

  function editDigitChange(delta) {
    const ed = state.editing;
    if (!ed) return;
    if (ed.type === 'enum') {
      const n = ed.item.options.length;
      ed.idx = (ed.idx + delta + n) % n;
      render();
      return;
    }
    if (!ed.digPositions.length) return;
    const pos = ed.digPositions[ed.digCursor];
    const chars = ed.valueStr.split('');
    let d = parseInt(chars[pos], 10);
    d = (d + delta + 10) % 10;
    chars[pos] = String(d);
    ed.valueStr = chars.join('');
    render();
  }

  // ---------- run / stop / faults ----------
  function doStart() {
    if (state.fault) { toast('Сначала сбросьте аварию'); return; }
    if (state.running) return;
    state.running = true;
    state.startedOnce = true;
    log('Нажата кнопка ПУСК — двигатель включён');
    render();
    updateTasks();
  }
  function doStop() {
    if (!state.running && !state.fault) { render(); return; }
    state.running = false;
    state.fault = null;
    state.stoppedManually = true;
    log('Нажата кнопка СТОП — двигатель остановлен (ОПЕРАТОР)');
    render();
    updateTasks();
  }
  function doHeat() {
    state.heating = !state.heating;
    log(`Подогрев ${state.heating ? 'включён' : 'выключен'}`);
    render();
  }
  function triggerFault(msg, desc) {
    state.fault = { msg, desc };
    state.running = false;
    log(`⚠ Останов по защите: ${msg}`);
    render();
  }
  function clearFault() {
    state.fault = null;
    log('Авария сброшена, пуск разрешён');
    render();
  }

  // ---------- rendering ----------
  function led(id, cls) {
    const el = document.getElementById(id);
    el.className = 'led ' + (cls || '');
  }

  function renderLeds() {
    if (state.fault) {
      led('led-stop', 'on-red'); led('led-wait', ''); led('led-run', '');
    } else if (state.running) {
      led('led-stop', ''); led('led-wait', ''); led('led-run', 'on-green');
    } else if (state.mode === 'автоматический') {
      led('led-stop', ''); led('led-wait', 'on-amber'); led('led-run', '');
    } else {
      led('led-stop', 'on-red'); led('led-wait', ''); led('led-run', '');
    }
    document.getElementById('heat-led').className = 'led ' + (state.heating ? 'on-amber' : '');
  }

  function line001() {
    let l1status, l2;
    if (state.fault) { l1status = `СТОП ${state.fault.msg}`; l2 = 'БЛОК'; }
    else if (state.running) { l1status = 'РАБОТА'; l2 = `время раб. ${fmtElapsed()}`; }
    else if (state.mode === 'автоматический') { l1status = 'СТОП'; l2 = 'АПВ  ожидание'; }
    else { l1status = 'СТОП'; l2 = 'пуск разрешён'; }
    return { l1: `001 ${l1status}`, l2 };
  }

  function itemLines(item, isSelected) {
    const editingThis = state.editing && state.editing.item === item;
    const marker = editingThis ? '+' : (isSelected ? '\u25BA' : ' ');
    let l1, l2html;

    if (item.code === '001') {
      const d = line001();
      l1 = `${marker}${d.l1}`;
      l2html = `  ${escapeHtml(d.l2)}`;
      return { l1: escapeHtml(l1), l2: l2html };
    }

    l1 = `${marker}${item.code} ${item.l1}`;

    if (item.type === 'section-link') {
      l2html = `  ${escapeHtml(item.l2)}`;
      return { l1: escapeHtml(l1), l2: l2html };
    }
    if (item.type === 'ro') {
      l2html = `  ${escapeHtml(item.l2 || '')}`;
      return { l1: escapeHtml(l1), l2: l2html };
    }

    if (editingThis) {
      if (state.editing.type === 'enum') {
        l2html = `  ${escapeHtml(state.editing.item.options[state.editing.idx])}`;
      } else {
        const chars = state.editing.valueStr.split('');
        const activePos = state.editing.digPositions[state.editing.digCursor];
        let html = '  ';
        chars.forEach((c, i) => {
          if (i === activePos) html += `<span class="cursor blink">${escapeHtml(c)}</span>`;
          else html += escapeHtml(c);
        });
        if (item.unit) html += ` ${escapeHtml(item.unit)}`;
        l2html = html;
      }
    } else {
      l2html = `  ${escapeHtml(formatValue(item))}`;
    }
    return { l1: escapeHtml(l1), l2: l2html };
  }

  function render() {
    const t = top();
    clampWindow(t);
    const rows = [];
    const a = t.list[t.windowStart];
    const b = t.list[t.windowStart + 1];
    if (a) rows.push(itemLines(a, t.cursor === t.windowStart));
    if (b) rows.push(itemLines(b, t.cursor === t.windowStart + 1));

    const screenEl = document.getElementById('lcd-screen');
    const lines = [];
    rows.forEach((r) => { lines.push(r.l1); lines.push(r.l2); });
    while (lines.length < 4) lines.push('');
    screenEl.innerHTML = lines.map((l) => `<div class="lrow">${l}</div>`).join('');

    // crumb
    const parts = ['ЭЛЕКТОН-05'];
    state.stack.forEach((f) => parts.push(f.label));
    document.getElementById('crumb').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${escapeHtml(p)}</b>` : escapeHtml(p))).join(' <span class="sep">›</span> ');

    // status strip
    document.getElementById('status-strip').textContent =
      `${state.mode.toUpperCase()} · ${state.running ? 'РАБОТА ' + fmtElapsed() : (state.fault ? 'АВАРИЯ' : 'СТОП')}`;

    renderLeds();
  }

  function updateTasks() {
    const map = {
      t1: state.visitedMain,
      t2: state.visitedSections.has(3),
      t3: (() => { const f = SECTIONS[2].functions.find((x) => x.code === '048'); return f && f.value === 'АПВ'; })(),
      t4: (() => { const f = SECTIONS[0].functions.find((x) => x.code === '003'); return f && f.value !== 50; })(),
      t5: state.startedOnce && state.stoppedManually,
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById('task-' + id);
      if (el) el.classList.toggle('done', !!map[id]);
    });
  }

  // ---------- key wiring ----------
  function pressFx(el) {
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 110);
  }

  function bindKey(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => { pressFx(el); fn(); });
  }

  bindKey('k-up', () => { state.editing ? editDigitChange(1) : moveCursor(-1); });
  bindKey('k-down', () => { state.editing ? editDigitChange(-1) : moveCursor(1); });
  bindKey('k-left', () => { state.editing ? editDigitMove(-1) : goLeft(); });
  bindKey('k-right', () => { state.editing ? editDigitMove(1) : goRight(); });
  bindKey('k-enter', () => { state.editing ? commitEdit() : startEdit(); });
  bindKey('k-esc', () => cancelEdit());
  bindKey('k-start', doStart);
  bindKey('k-stop', doStop);
  bindKey('k-heat', doHeat);

  window.addEventListener('keydown', (e) => {
    const map = {
      ArrowUp: 'k-up', ArrowDown: 'k-down', ArrowLeft: 'k-left', ArrowRight: 'k-right',
      Enter: 'k-enter', Escape: 'k-esc',
    };
    if (map[e.key]) { e.preventDefault(); document.getElementById(map[e.key]).click(); }
  });

  // ---------- fault sidebar ----------
  const faultSelect = document.getElementById('fault-select');
  STOP_MESSAGES.forEach(([msg, desc]) => {
    const opt = document.createElement('option');
    opt.value = msg; opt.textContent = msg;
    opt.dataset.desc = desc;
    faultSelect.appendChild(opt);
  });
  document.getElementById('btn-fault').addEventListener('click', () => {
    const msg = faultSelect.value;
    const desc = faultSelect.selectedOptions[0].dataset.desc;
    triggerFault(msg, desc);
    document.getElementById('fault-desc').textContent = desc;
  });
  document.getElementById('btn-clear-fault').addEventListener('click', clearFault);
  faultSelect.addEventListener('change', () => {
    document.getElementById('fault-desc').textContent = faultSelect.selectedOptions[0].dataset.desc;
  });
  faultSelect.selectedIndex = 0;
  document.getElementById('fault-desc').textContent = faultSelect.selectedOptions[0].dataset.desc;

  // ---------- clock ----------
  setInterval(() => {
    if (state.running) { state.elapsed += 1; render(); }
  }, 1000);

  // ---------- boot ----------
  log('Питание подано. Загрузка «ЭЛЕКТОН-09»…');
  setTimeout(() => { log('Готово. Экран «Текущие параметры».'); render(); updateTasks(); }, 400);
  render();
})();
