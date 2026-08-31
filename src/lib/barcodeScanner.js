// Сканер штрихкодов: камера (Quagga) + ручной ввод + звуковой сигнал
// Используется в каталоге товаров и в инвентаризации

// Короткий звуковой сигнал (Web Audio, без файлов)
export const beep = (freq = 1200, dur = 100, vol = 0.15) => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const g = ac.createGain();
    g.connect(ac.destination);
    g.gain.value = vol;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start();
    setTimeout(() => { try { o.stop(); ac.close(); } catch (e) {} }, dur);
  } catch (e) { /* звук недоступен — не критично */ }
};

// Сканирование: открывает камеру, распознаёт штрихкод, пикает и вызывает onResult(code)
// lockDelay — пауза между сканами (чтобы один код не сработал 10 раз подряд)
export const scanBarcode = (onResult, { lockDelay = 2500, onBeep = null } = {}) => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Камера недоступна — введите штрихкод вручную в поле ввода');
    return;
  }
  import('quagga').then(function(mod) {
    var Quagga = mod.default || mod;
    var w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center';
    var v = document.createElement('div'); v.id = 'qv';
    v.style.cssText = 'position:relative;width:100%;max-width:500px;overflow:hidden;border-radius:12px;background:#000';
    var f = document.createElement('div');
    f.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;width:320px;height:130px;border:2px solid rgba(255,255,255,.5);border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.4);pointer-events:none';
    var i = document.createElement('input'); i.type = 'text'; i.placeholder = 'Введите штрихкод вручную…';
    i.style.cssText = 'width:80%;max-width:360px;margin-top:16px;padding:12px 16px;border:none;border-radius:12px;font-size:16px;text-align:center;letter-spacing:4px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);outline:none;font-family:inherit';
    var c = document.createElement('div'); c.textContent = '✕'; c.title = 'Закрыть';
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;width:36px;height:36px;background:rgba(0,0,0,.4);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;font-weight:700;line-height:1';
    v.appendChild(f); w.appendChild(v); w.appendChild(i); document.body.appendChild(w);
    document.body.appendChild(c);
    setTimeout(function() {
      var cv = document.getElementById('qv');
      if (cv) {
        cv.querySelectorAll('video').forEach(function(el) { el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0'; });
        cv.querySelectorAll('canvas').forEach(function(el) { el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0'; });
      }
    }, 200);
    var q = null;
    var lock = false;
    var done = function(val) {
      if (val && !lock) {
        lock = true;
        beep(1200, 100);
        if (onBeep) onBeep();
        if (onResult) onResult(val.trim());
        setTimeout(function() { lock = false; }, lockDelay);
      }
      cl();
    };
    var cl = function() { if (q) { q.stop(); q = null; } w.remove(); c.remove(); };
    i.onkeydown = function(e) { if (e.key === 'Enter' && i.value.trim()) { done(i.value.trim()); } };
    c.onclick = cl;
    Quagga.init({
      inputStream: { name: 'Live', type: 'LiveStream', target: v, targetSize: 1, constraints: { width: 640, height: 480, facingMode: 'environment' } },
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader', 'upc_e_reader'] },
      locate: true
    }, function(err) {
      if (err) { alert('Ошибка камеры: ' + (err && err.message ? err.message : 'не удалось запустить')); w.remove(); c.remove(); return; }
      q = Quagga;
      Quagga.start();
      Quagga.onDetected(function(data) { if (data && data.codeResult && data.codeResult.code) { done(data.codeResult.code); } });
    });
  }).catch(function() { alert('Ошибка загрузки сканера'); });
};
