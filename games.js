// Games over the unit's words. Each game sets gameTap (button handler) and stopGame (clears its timers when leaving).
const pool = () => U().words;
const weak = () => (S.weak = S.weak || {});
const mark = (w, ok) => { const m = weak(); m[w.en] = Math.max(0, (m[w.en] || 0) + (ok ? -1 : 2)); haptic(ok); };
// words the player keeps missing come up first, the rest in random order
const pick = n => shuffle(pool()).map(w => [w, (weak()[w.en] || 0) + Math.random()]).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
const others = (w, n) => shuffle(pool().filter(x => x !== w && x.uz !== w.uz)).slice(0, n);
const gameTop = (right) => `<div class="top"><button class="back" data-go="unit" aria-label="Orqaga">‹</button><div class="bar"><i id="gbar" style="width:100%"></i></div><span class="coin" id="gstat">${right}</span></div>`;
const wait = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };
let timers = [], raf = 0;
window.stopGame = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); window.gameTap = null; };
const score = { gMatch: 'Juftini top', gFall: 'Tushayotgan so\'zlar', gListen: 'Eshit va ur' };

function gameOver(id, stars, line) {
  stopGame();
  S.best = S.best || {};
  const k = uid(id), prev = S.best[k] || 0;
  const got = Math.max(0, stars - prev) * 5;   // coins only for beating your own best, so replays can't farm them
  S.best[k] = Math.max(stars, prev);
  S.coins += got; touchDay(); save();
  $app.innerHTML = header(score[id], 'unit') + `<div class="main center"><div class="stars">${'⭐'.repeat(stars) || '💪'}</div>
    <h2 style="margin:0">${stars ? 'Barakalla!' : 'Yana urinib ko\'ring'}</h2><p class="hint">${esc(line)}</p>
    <p class="hint">${got ? '+' + got + ' 🪙 oldingiz' : stars === 3 ? 'Eng yuqori natija!' : 'Coin olish uchun rekordingizni yangilang (rekord: ' + S.best[k] + ' ⭐)'}</p>
    <div class="spacer"></div><button class="btn" data-go="${id}">Yana o'ynash</button><button class="btn sec2" data-go="unit">Unitga qaytish</button></div>`;
  syncBack();
}

// ---- Juftini top: match English words to their meaning against the clock
screens.gMatch = () => {
  stopGame();
  const queue = pick(12), total = queue.length, LIM = 60000, started = Date.now();
  let L = [], R = [], sel = null, errors = 0, matched = 0, penalty = 0, busy = false;
  const first = queue.splice(0, 5); L = first.slice(); R = shuffle(first);
  const draw = (flash) => {
    const cell = (w, side, i) => w ? `<button class="tile ${sel && sel[0] === side && sel[1] === i ? 'sel' : ''} ${flash && flash.some(f => f[0] === side && f[1] === i) ? flash.cls : ''}" data-g="${side}:${i}">${side === 'L' ? `<b>${esc(w.en)}</b>` : `<span class="pp">${w.pic}</span><small>${esc(w.uz)}</small>`}</button>` : '<div></div>';
    document.getElementById('gboard').innerHTML = L.map((w, i) => cell(w, 'L', i) + cell(R[i], 'R', i)).join('');
    document.getElementById('gstat').textContent = matched + '/' + total;
  };
  $app.innerHTML = gameTop('0/' + total) + `<div class="main"><p class="hint">So'z va ma'nosini juftlang. Xato 2 soniya oladi.</p><div class="pairs" id="gboard"></div></div>`;
  draw();
  const tick = () => {
    const left = LIM - (Date.now() - started) - penalty;
    document.getElementById('gbar').style.width = Math.max(0, left / LIM * 100) + '%';
    if (left <= 0) return gameOver('gMatch', 0, matched + ' ta juft topdingiz, vaqt tugadi.');
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  window.gameTap = (t, g) => {
    if (busy) return;
    const [side, si] = g.split(':'), i = +si;
    if (!sel || sel[0] === side) { sel = [side, i]; if (side === 'L') play(L[i].a); return draw(); }
    const li = side === 'L' ? i : sel[1], ri = side === 'R' ? i : sel[1], w = L[li], ok = w === R[ri];
    const flash = [['L', li], ['R', ri]]; flash.cls = ok ? 'ok' : 'no';
    sel = null; busy = true; mark(w, ok);
    if (ok) { matched++; play(w.a); } else { errors++; penalty += 2000; }
    draw(flash);
    wait(() => {
      busy = false;
      if (ok) {
        const nx = queue.shift();
        L[li] = nx || null; R[ri] = nx || null;
        if (matched === total) return gameOver('gMatch', errors <= 1 ? 3 : errors <= 4 ? 2 : 1, total + ' ta juft, ' + errors + ' ta xato.');
      }
      draw();
    }, ok ? 280 : 450);
  };
};

// ---- Tushayotgan so'zlar: answer before the word reaches the ground; it gets faster
screens.gFall = () => {
  stopGame();
  const list = pick(15); let idx = 0, lives = 3, right = 0, locked = false, cw = null, opts = [];
  $app.innerHTML = gameTop('❤️❤️❤️') + `<div class="main"><div class="sky" id="sky"><div class="drop" id="drop"></div><div class="ground"></div></div><div class="fopts" id="fopts"></div></div>`;
  const stat = () => { document.getElementById('gstat').textContent = '❤️'.repeat(lives) || '💔'; document.getElementById('gbar').style.width = idx / list.length * 100 + '%'; };
  const end = () => lives > 0 ? gameOver('gFall', lives === 3 ? 3 : lives === 2 ? 2 : 1, right + ' ta so\'zni ushladingiz.') : gameOver('gFall', 0, right + ' ta so\'zni ushladingiz, jon tugadi.');
  const after = () => { idx++; stat(); if (!lives || idx >= list.length) return wait(end, 150); wait(round, 150); };
  const miss = () => {
    locked = true; lives--; mark(cw, false);
    document.getElementById('drop').classList.add('bad');
    document.getElementById('drop').innerHTML = `${esc(cw.en)} = ${esc(cw.uz)}`;
    document.querySelectorAll('.fopts button').forEach((b, i) => { if (opts[i] === cw) b.classList.add('ok'); });
    stat(); wait(after, 1100);
  };
  const round = () => {
    locked = false; cw = list[idx];
    opts = shuffle([cw, ...others(cw, 2)]);
    const drop = document.getElementById('drop'), sky = document.getElementById('sky');
    drop.className = 'drop'; drop.textContent = cw.en; drop.style.transform = 'translate(-50%,0)';
    document.getElementById('fopts').innerHTML = opts.map((o, i) => `<button class="opt" data-g="${i}">${esc(o.uz)}</button>`).join('');
    const dur = Math.max(2800, 6500 - idx * 260), t0 = performance.now(), H = () => sky.clientHeight - drop.offsetHeight - 14;
    const fall = now => {
      const p = (now - t0) / dur;
      if (p >= 1) return miss();
      drop.style.transform = `translate(-50%,${p * H()}px)`;
      raf = requestAnimationFrame(fall);
    };
    raf = requestAnimationFrame(fall);
  };
  window.gameTap = (t, g) => {
    if (locked) return;
    cancelAnimationFrame(raf);
    if (opts[+g] !== cw) { t.classList.add('no'); return miss(); }
    locked = true; right++; mark(cw, true); play(cw.a);
    t.classList.add('ok'); document.getElementById('drop').classList.add('good');
    wait(after, 350);
  };
  stat(); round();
};

// ---- Eshit va ur: hear the word, hit its picture before the bar runs out
screens.gListen = () => {
  stopGame();
  const list = pick(10), LIM = 6000; let idx = 0, right = 0, pts = 0, locked = false, cw = null, opts = [], t0 = 0;
  $app.innerHTML = gameTop('0 ball') + `<div class="main"><div class="center"><button class="snd" id="again" data-g="again">🔊 Yana eshitish</button></div><div class="tiles" id="ltiles"></div></div>`;
  const next = () => { idx++; if (idx >= list.length) return gameOver('gListen', right === 10 ? 3 : right >= 8 ? 2 : right >= 6 ? 1 : 0, right + '/10 to\'g\'ri, ' + pts + ' ball.'); round(); };
  const reveal = () => document.querySelectorAll('#ltiles button').forEach((b, i) => { if (opts[i] === cw) b.classList.add('ok'); });
  const round = () => {
    locked = false; cw = list[idx]; opts = shuffle([cw, ...others(cw, 3)]);
    document.getElementById('ltiles').innerHTML = opts.map((o, i) => `<button class="tile big-t" data-g="${i}"><span class="pp">${o.pic}</span><small>${esc(o.uz)}</small></button>`).join('');
    play(cw.a); t0 = performance.now();
    const tick = now => {
      const left = 1 - (now - t0) / LIM;
      document.getElementById('gbar').style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) { locked = true; mark(cw, false); reveal(); return wait(next, 1100); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  window.gameTap = (t, g) => {
    if (g === 'again') return play(cw.a);
    if (locked) return;
    locked = true; cancelAnimationFrame(raf);
    const ok = opts[+g] === cw; mark(cw, ok);
    if (ok) { right++; pts += 10 + Math.round((1 - (performance.now() - t0) / LIM) * 10); t.classList.add('ok'); }
    else { t.classList.add('no'); reveal(); }
    document.getElementById('gstat').textContent = pts + ' ball';
    wait(next, ok ? 450 : 1100);
  };
  round();
};
