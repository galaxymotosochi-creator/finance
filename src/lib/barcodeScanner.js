// Сканер штрихкодов: камера (Quagga) + ручной ввод + звуковой сигнал
// Используется в каталоге товаров и в инвентаризации

// Короткий звуковой сигнал (Web Audio, без файлов)
// Один общий AudioContext на всю страницу: браузеры ограничивают число контекстов (~6),
// если создавать новый на каждый пик — звук перестаёт появляться
let _ac = null;
export const beep = (freq = 1200, dur = 100, vol = 0.15) => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_ac) _ac = new AC();
    if (_ac.state === 'suspended') _ac.resume();
    const t0 = _ac.currentTime;
    const g = _ac.createGain();
    g.connect(_ac.destination);
    // Плавный envelope: без резких старт/стоп → нет щелчков и искажений
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
    const o = _ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur / 1000 + 0.02);
  } catch (e) { /* звук недоступен — не критично */ }
};

// Сканирование: открывает камеру, распознаёт штрихкод, пикает и вызывает onResult(code)
// continuous: true — окно не закрывается после скана (непрерывный режим для инвентаризации),
// закрывается только крестиком ✕
export const scanBarcode = (onResult, { lockDelay = 2500, onBeep = null, continuous = false } = {}) => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Камера недоступна — введите штрихкод вручную в поле ввода');
    return;
  }
  import('quagga').then(function(mod) {
    var Quagga = mod.default || mod;
    var w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    // Экран загрузки с анимированной полосочкой (как в кассе)
    var loadInner = document.createElement('div');
    loadInner.style.cssText = 'background:#fff;border-radius:16px;padding:28px 40px;text-align:center;box-shadow:0 8px 60px rgba(0,0,0,.15)';
    loadInner.innerHTML = '<div style="width:200px;height:4px;background:#eee;border-radius:2px;overflow:hidden;margin:0 auto"><div style="width:0%;height:100%;background:#222;border-radius:2px;animation:scanLoad 2s ease-in-out forwards"></div></div>';
    w.appendChild(loadInner);
    var v = document.createElement('div'); v.id = 'qv';
    v.style.cssText = 'position:relative;width:100%;max-width:500px;overflow:hidden;border-radius:12px;background:#000;display:none';
    var f = document.createElement('div');
    f.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:320px;height:130px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i = document.createElement('input'); i.type = 'text'; i.placeholder = 'Введите штрихкод вручную…';
    i.style.cssText = 'width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c = document.createElement('div'); c.textContent = '✕'; c.title = 'Закрыть';
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    v.appendChild(f); w.appendChild(v); document.body.appendChild(w);
    document.body.appendChild(c);
    // CSS-анимации: полосочка загрузки + плавное появление видео
    if (!document.getElementById('scan-style')) {
      var ss = document.createElement('style'); ss.id = 'scan-style';
      ss.textContent = '@keyframes scanLoad{0%{width:0%}50%{width:65%}100%{width:100%}}.scanner-visible video{animation:scanFadeIn .3s ease}@keyframes scanFadeIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(ss);
    }
    setTimeout(function() {
      var cv = document.getElementById('qv');
      if (cv) {
        cv.querySelectorAll('video').forEach(function(el) { el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0'; });
        cv.querySelectorAll('canvas').forEach(function(el) { el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0'; });
      }
    }, 200);
    var q = null;
    // Простой и надёжный принцип: повторный скан того же кода разрешён всегда,
    // если прошло >= 1200мс с последнего срабатывания этого кода.
    // Не зависит от того, как Quagga шлёт события (непрерывно или по появлению).
    var lastFire = {}; // code -> ts последнего срабатывания
    var emit = function(code) {
      if (!code) return;
      var now = Date.now();
      var last = lastFire[code] || 0;
      if (now - last >= 1200) {
        lastFire[code] = now;
        fire(code);
      }
    };
    var fire = function(val) {
      beep(1200, 100);
      if (onBeep) onBeep();
      if (onResult) onResult(val.trim());
      // В непрерывном режиме окно остаётся открытым — закрытие только крестиком
      if (!continuous) cl();
    };
    var cl = function() { if (q) { q.stop(); q = null; } w.remove(); c.remove(); };
    i.onkeydown = function(e) { if (e.key === 'Enter' && i.value.trim()) { fire(i.value.trim()); i.value = ''; } };
    c.onclick = cl;
    Quagga.init({
      inputStream: { name: 'Live', type: 'LiveStream', target: v, targetSize: 1, constraints: { width: 640, height: 480, facingMode: 'environment' } },
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader', 'upc_e_reader'] },
      locate: true
    }, function(err) {
      if (err) { alert('Ошибка камеры: ' + (err && err.message ? err.message : 'не удалось запустить')); w.remove(); c.remove(); return; }
      // Загрузка завершена: убираем полосочку, добавляем ручной ввод, показываем видео
      loadInner.remove();
      w.appendChild(i);
      v.style.display = 'block';
      q = Quagga;
      Quagga.start();
      setTimeout(function() { v.classList.add('scanner-visible'); }, 50);
      Quagga.onDetected(function(data) { if (data && data.codeResult && data.codeResult.code) { emit(data.codeResult.code); } });
    });
  }).catch(function() { alert('Ошибка загрузки сканера'); });
};
