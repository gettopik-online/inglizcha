// Word practice (say / write) and the speaking and typing games. Built on pick/mark/wait/gameTop/gameOver from games.js.
const stopGameBase = window.stopGame;
window.stopGame = () => { stopGameBase(); Speech.stop(); };
Object.assign(score, { gSpeak: 'Aytib ol', gType: 'Eshit va yoz' });
const inputForm = (id, ph) => `<form class="cform" id="${id}"><input id="${id}In" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}" aria-label="${ph}"><button class="btn" aria-label="Tekshirish">➤</button></form>`;
let onWordForm = null;
document.addEventListener('submit', ev => {
  if (ev.target.id !== 'wf') return;
  ev.preventDefault();
  const i = document.getElementById('wfIn'), v = i.value.trim();
  if (v && onWordForm) onWordForm(v);
});

// ---- So'z mashqi: each word is either said aloud or written, the missed ones come back at the end
screens.practice = () => {
  stopGame();
  const q = pick(10).map((w, i) => ({ w, kind: ['say', 'write', 'hear'][i % 3] })); let i = 0, right = 0, firstCount = q.length;
  const next = () => { i++; if (i < q.length) return card(); const got = finish('practice', 10); result('Barakalla!', `${firstCount} ta so'zdan ${right} tasini birinchi urinishda topdingiz`, got); };
  const after = (it, ok) => { mark(it.w, ok); if (ok && i < firstCount) right++; if (!ok) q.push(it); };
  const reveal = it => `<div class="fb no">To'g'ri javob: ${esc(it.w.en)}</div>`;
  const card = () => {
    const it = q[i], w = it.w, say = it.kind === 'say', hear = it.kind === 'hear';
    $app.innerHTML = header("So'z mashqi", 'unit') + `<div class="main"><div class="bar"><i style="width:${Math.min(i, q.length) / q.length * 100}%"></i></div>
      <div class="card"><div class="pic">${hear ? '🎧' : w.pic}</div>${hear ? '' : `<p class="uz">${esc(w.uz)}</p>`}
      <p class="hint">${say ? 'Inglizcha ayting' : hear ? "Eshitganingizni yozing" : 'Inglizcha yozing'}</p>${hear ? `<button class="snd" data-play="${w.a}">🔊 Yana eshitish</button>` : ''}</div>
      <div id="wbox">${say ? '' : inputForm('wf', 'Inglizcha yozing...')}</div><div id="wfb"></div></div>`;
    const go = ok => { after(it, ok); if (ok) play(w.a); document.getElementById('wfb').innerHTML = (ok ? `<div class="fb ok">To'g'ri! ${esc(w.en)} 🎉</div>` : reveal(it)) + `<button class="btn" style="margin-top:8px" id="wnext" type="button">Davom etish</button>`; document.getElementById('wbox').innerHTML = ''; const b = document.getElementById('wnext'); b.onclick = next; if (!ok) play(w.a); };
    if (say) speakBox(document.getElementById('wbox'), w.en, w.a, go);
    else { onWordForm = v => go(isAnswer(v, [w.en])); document.getElementById('wfIn').focus(); if (hear) play(w.a); }
  };
  card();
};

// ---- Aytib ol: say each word before the bar runs out
screens.gSpeak = () => {
  stopGame();
  const list = pick(10), LIM = 9000; let idx = 0, right = 0, locked = false, t0 = 0, cw = null;
  const live = Speech.can();
  $app.innerHTML = gameTop('0/10') + `<div class="main"><div class="card"><div class="pic" id="spic"></div><p class="uz" id="suz"></p><p class="hint" id="shint"></p></div><div id="sbox"></div></div>`;
  const stat = () => { document.getElementById('gstat').textContent = right + '/10'; };
  const over = () => gameOver('gSpeak', right >= 9 ? 3 : right >= 7 ? 2 : right >= 5 ? 1 : 0, right + '/10 so\'zni aytdingiz.');
  const next = () => { idx++; if (idx >= list.length) return over(); round(); };
  const res = ok => {
    if (locked) return; locked = true; cancelAnimationFrame(raf); Speech.stop(); mark(cw, ok); if (ok) right++; stat();
    document.getElementById('shint').innerHTML = `<b>${esc(cw.en)}</b>`; document.getElementById('sbox').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? 'Zo\'r! 🎉' : 'Mana bunday aytiladi'}</div>`; play(cw.a);
    wait(next, ok ? 900 : 1700);
  };
  const hearLoop = () => {   // keeps listening until time is up: no extra tap per word, that is what makes it a game
    if (locked || !Speech.can()) return;
    Speech.listen(cw.en, r => {
      if (locked) return;
      if (r.ok) return res(true);
      if (r.failed) { document.getElementById('sbox').innerHTML = selfBtns(); return; }
      if (r.heard) document.getElementById('shint').textContent = 'Eshitildi: ' + r.heard;
      wait(hearLoop, 120);
    });
  };
  const selfBtns = () => `<div class="spk"><button class="snd" data-g="yes">✅ Aytdim</button><button class="snd bad" data-g="no">❌ Aytolmadim</button></div>`;
  const round = () => {
    locked = false; cw = list[idx]; t0 = performance.now();
    document.getElementById('spic').textContent = cw.pic; document.getElementById('suz').textContent = cw.uz;
    document.getElementById('shint').textContent = 'Inglizcha ayting!';
    document.getElementById('sbox').innerHTML = live ? `<div class="fb listen">🔴 Tinglayapman...</div><button class="snd bad" data-g="no">O'tkazish</button>` : selfBtns();
    const tick = now => {
      const left = 1 - (now - t0) / LIM;
      document.getElementById('gbar').style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) return res(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (live) hearLoop();
  };
  window.gameTap = (t, g) => { if (g === 'yes') res(true); if (g === 'no') res(false); };
  round();
};

// ---- Eshit va yoz: hear the word, type it before the bar runs out; a wrong try gives the first letter
screens.gType = () => {
  stopGame();
  const list = pick(10), LIM = 18000; let idx = 0, right = 0, locked = false, t0 = 0, cw = null;
  $app.innerHTML = gameTop('0/10') + `<div class="main"><div class="card"><div class="pic" id="tpic"></div><p class="uz" id="tuz"></p><button class="snd" data-g="hear">🔊 Yana eshitish</button><p class="hint" id="thint"></p></div>${inputForm('wf', 'Yozing...')}<div id="tfb"></div></div>`;
  const over = () => gameOver('gType', right >= 9 ? 3 : right >= 7 ? 2 : right >= 5 ? 1 : 0, right + '/10 so\'zni to\'g\'ri yozdingiz.');
  const end = ok => {
    locked = true; cancelAnimationFrame(raf); mark(cw, ok); if (ok) right++;
    document.getElementById('gstat').textContent = right + '/10';
    document.getElementById('tfb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? 'To\'g\'ri! 🎉' : 'To\'g\'ri javob: ' + esc(cw.en)}</div>`;
    wait(() => { idx++; idx >= list.length ? over() : round(); }, ok ? 700 : 1700);
  };
  const round = () => {
    locked = false; cw = list[idx]; t0 = performance.now();
    document.getElementById('tpic').textContent = cw.pic; document.getElementById('tuz').textContent = cw.uz;
    document.getElementById('thint').textContent = ''; document.getElementById('tfb').innerHTML = '';
    const i = document.getElementById('wfIn'); i.value = ''; i.focus(); play(cw.a);
    const tick = now => {
      const left = 1 - (now - t0) / LIM;
      document.getElementById('gbar').style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) return end(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  onWordForm = v => {
    if (locked) return;
    if (isAnswer(v, [cw.en])) return end(true);
    haptic(false);
    document.getElementById('thint').textContent = `Yana urining: ${cw.en[0]}${'_'.repeat(cw.en.length - 1)}`;
    const i = document.getElementById('wfIn'); i.select();
  };
  window.gameTap = (t, g) => { if (g === 'hear') play(cw.a); };
  round();
};
