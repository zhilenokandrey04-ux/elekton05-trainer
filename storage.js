/* ============================================================
   Хранилище прогресса — сохраняет выполненные задания, лучший
   результат теста и настройку звука между визитами (localStorage).
   Если localStorage недоступен (приватный режим и т.п.) — тихо
   отключается, ничего не ломая.
   ============================================================ */
(function () {
  const KEY = 'elekton05-progress-v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }

  function patch(partial) {
    const current = load();
    const merged = Object.assign({}, current, partial);
    save(merged);
    return merged;
  }

  window.ElektonStore = { load, save, patch };
})();
