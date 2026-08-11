(function () {
  const frames = [
    ['\u25BA000 Режим работы', '  автоматический', '001 РАБОТА', '  время раб. 1520ч16м'],
    ['\u25BA003 Вых. частота', '  50.00 Гц', '004 Ток двигателя U', '  90.0 А'],
    ['\u25BA018 Загрузка', '  74 %', '019 Температура IGBT', '  41.0 °C'],
    ['\u25BA048 Перегруз двиг.', '  БЛОК', '049 Перегруз двиг.', '  уст. 100 %'],
  ];
  const el = document.getElementById('hero-lcd');
  if (!el) return;
  let i = 0;
  function paint() {
    el.innerHTML = frames[i].map((l) => `<div class="lcd-row">${l}</div>`).join('');
    i = (i + 1) % frames.length;
  }
  paint();
  setInterval(paint, 2400);
})();
