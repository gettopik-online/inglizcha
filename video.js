// Interactive lesson player: the video stops at each cue and goes on only after the learner has taken part.
let vTimer = 0, vCues = [], vScore = 0, vTotal = 0, vTries = 0, vBuilt = [], vBank = [];
const vEl = () => document.querySelector('video.lesson');
window.stopVideo = () => { Speech.stop(); clearInterval(vTimer); vTimer = 0; const v = vEl(); if (v) v.pause(); };

function vScoreCount() { return vCues.filter(c => c.type === 'choose' || c.type === 'build').length; }

screens.video = () => {
  const u = U(), n = cu + 1;
  vCues = u.cues.map(c => ({ ...c, seen: false })); vScore = 0; vTotal = vScoreCount();
  $app.innerHTML = header('Video dars', 'unit') + `<div class="main vwrap">
    <div class="vbox"><video class="lesson" src="video/lesson${n}.mp4" playsinline preload="auto"></video>
      <button class="vstart" id="vstart" data-c="start" aria-label="Boshlash">▶</button>
      <div class="cue" id="cue" hidden></div></div>
    <div class="vbar"><button class="snd" data-c="back5" aria-label="5 soniya orqaga">⟲ 5</button><button class="snd" id="vpp" data-c="pp" aria-label="To'xtatish">⏸</button><div class="bar"><i id="vprog" style="width:0"></i></div><span class="coin" id="vdots">0/${vTotal}</span></div>
    <p class="hint" id="vhint">Dars davomida video to'xtaydi. Javob bersangiz, davom etadi.</p></div>`;
  const v = vEl();
  v.addEventListener('ended', vEnd);
  clearInterval(vTimer);
  vTimer = setInterval(() => {
    const p = document.getElementById('vprog'); if (!p || !v.duration) return;
    p.style.width = v.currentTime / v.duration * 100 + '%';
    if (v.paused) return;
    const c = vCues.find(x => !x.seen && v.currentTime >= x.t);
    if (c) vStop(c);
  }, 100);
};

function vStop(c) {
  const v = vEl(); v.pause(); c.seen = true; vTries = 0; vCur = c;
  if (c.skip) v.currentTime = c.skip;
  const box = document.getElementById('cue'); box.hidden = false;
  if (c.type === 'choose') box.innerHTML = `<p class="cq">${esc(c.q)}</p>` + c.o.map((o, i) => `<button class="opt" data-c="o${i}">${esc(o)}</button>`).join('');
  if (c.type === 'say') box.innerHTML = `<p class="cq">🎤 ${esc(c.q)}</p><p class="csay">${esc(c.say)}</p><div id="cspk"></div>`;
  if (c.type === 'say') speakBox(document.getElementById('cspk'), c.say, c.audio, () => vGo());
  if (c.type === 'name') box.innerHTML = `<p class="cq">🎤 ${esc(c.q)}</p><p class="csay">${esc(c.pre)} <span id="nameShow">${esc(S.name || '...')}</span></p><input id="nameIn" maxlength="30" autocomplete="off" placeholder="Ismingiz" aria-label="Ismingiz" value="${esc(S.name || '')}"><button class="btn" data-c="name">Aytdim ✓</button>`;
  if (c.type === 'pick') box.innerHTML = `<p class="cq">🎤 ${esc(c.q)}</p><p class="csay">${esc(c.pre)} <span id="pickShow">...</span></p><div class="bank">${c.o.map((o, i) => `<button class="chip" data-c="p${i}">${esc(o)}</button>`).join('')}</div><button class="btn" id="pickGo" data-c="go" disabled>Aytdim ✓</button>`;
  if (c.type === 'build') { vBuilt = []; vBank = shuffle(c.w); while (c.w.length > 1 && vBank.join(' ') === c.w.join(' ')) vBank = shuffle(c.w); vDrawBuild(c); }
}
let vCur = null;
function vDrawBuild(c) {
  const left = vBank.slice(); vBuilt.forEach(w => left.splice(left.indexOf(w), 1));
  document.getElementById('cue').innerHTML = `<p class="cq">🧩 ${esc(c.q)}</p><div class="slot">${vBuilt.map((w, i) => `<button class="chip" data-c="u${i}">${esc(w)}</button>`).join('')}</div>
    <div class="bank">${left.map(w => `<button class="chip" data-c="b${vBank.indexOf(w)}">${esc(w)}</button>`).join('')}</div><div id="cfb"></div>`;
  if (vBuilt.length === c.w.length) {
    const ok = vBuilt.join(' ') === c.w.join(' ');
    if (ok) return vRight(c.audio);
    vTries++; haptic(false); vBuilt = [];
    setTimeout(() => { if (vCur === c) { vDrawBuild(c); const f = document.getElementById('cfb'); if (f) f.innerHTML = '<div class="fb no">Tartibi boshqacha. Yana urinib ko\'ring.</div>'; } }, 350);
  }
}
function vRight(audio) {
  if (!vTries) vScore++;
  haptic(true);
  document.getElementById('vdots').textContent = vScore + '/' + vTotal;
  const box = document.getElementById('cue');
  box.insertAdjacentHTML('beforeend', `<div class="fb ok" style="margin-top:8px">${vTries ? "To'g'ri!" : "To'g'ri! +1 🪙"}</div>`);
  if (audio) play(audio);
  setTimeout(() => { if (vCur) vGo(); }, audio ? 1300 : 800);
}
function vGo() {
  vCur = null;
  const box = document.getElementById('cue'), v = vEl(); if (!box || !v) return;
  box.hidden = true; box.innerHTML = ''; v.play().catch(() => {});
}
function vEnd() {
  clearInterval(vTimer); vCur = null;
  const got = finish('video', 5 + vScore), who = S.name ? ', ' + S.name : '';
  $app.innerHTML = header('Video dars', 'unit') + `<div class="main center"><div class="stars">${vScore === vTotal ? '⭐⭐⭐' : vScore >= vTotal / 2 ? '⭐⭐' : '⭐'}</div>
    <h2 style="margin:0">Barakalla${esc(who)}!</h2><p class="hint">${vTotal} ta savoldan ${vScore} tasiga birinchi urinishda to'g'ri javob berdingiz.</p>
    <p class="hint">${got ? '+' + got + ' 🪙 oldingiz' : "Bu dars uchun coin oldin berilgan"}</p><div class="spacer"></div>
    <button class="btn" data-go="words">So'zlarga o'tish</button><button class="btn sec2" data-go="video">Darsni qayta ko'rish</button></div>`;
  syncBack();
}
window.cueTap = (t, k) => {
  const v = vEl(), c = vCur;
  if (k === 'start') { t.remove(); v.play().catch(() => {}); document.getElementById('vhint').textContent = ''; return; }
  if (k === 'pp') { if (c) return; if (v.paused) { v.play().catch(() => {}); t.textContent = '⏸'; } else { v.pause(); t.textContent = '▶'; } return; }
  if (k === 'back5') { if (c) return; v.currentTime = Math.max(0, v.currentTime - 5); return; }
  if (!c) return;
  if (k === 'hear') return play(c.audio);
  if (k === 'go') return vGo();
  if (k === 'name') { const n = document.getElementById('nameIn').value.trim(); if (n) { S.name = n; save(); } return vGo(); }
  if (k[0] === 'p') { document.getElementById('pickShow').textContent = c.o[+k.slice(1)]; document.getElementById('pickGo').disabled = false; return play(c.audios[+k.slice(1)]); }
  if (k[0] === 'b') { vBuilt.push(vBank[+k.slice(1)]); return vDrawBuild(c); }
  if (k[0] === 'u') { vBuilt.splice(+k.slice(1), 1); return vDrawBuild(c); }
  if (k[0] === 'o') {
    if (t.disabled) return;
    if (+k.slice(1) === c.a) {
      document.querySelectorAll('#cue .opt').forEach(b => b.disabled = true);
      t.classList.add('ok'); return vRight();
    }
    vTries++; haptic(false); t.classList.add('no'); t.disabled = true;
  }
};
document.addEventListener('input', ev => { if (ev.target.id === 'nameIn') document.getElementById('nameShow').textContent = ev.target.value.trim() || '...'; });
