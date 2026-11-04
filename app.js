const D = window.DATA, $app = document.getElementById('app');
const KEY = 'eng_progress_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
let S = Object.assign({ coins: 0, done: {} }, load());
const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
const hasCloud = TG && TG.isVersionAtLeast('6.9') && TG.CloudStorage;
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  if (!hasCloud) return;
  const s = JSON.stringify(S);   // Telegram keeps at most 4096 characters per value: the weak-word list is the part we can lose
  TG.CloudStorage.setItem(KEY, s.length > 4000 ? JSON.stringify({ ...S, weak: {} }) : s, () => {});   // survives a reinstall and follows the user across devices
};
const haptic = ok => { if (TG && TG.HapticFeedback) TG.HapticFeedback.notificationOccurred(ok ? 'success' : 'error'); };
const syncBack = () => {   // inside Telegram the header's own back button replaces ours
  if (!TG || !TG.isVersionAtLeast('6.1')) return;
  if (document.querySelector('.back')) TG.BackButton.show(); else TG.BackButton.hide();
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let cur = null;
const play = src => { if (!src) return; if (!cur) cur = new Audio(); cur.pause(); cur.src = src; cur.play().catch(() => {}); };   // one element: phones allow it to replay after the first tap
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const header = (title, back) => `<div class="top">${back ? `<button class="back" data-go="${back}" aria-label="Orqaga">‹</button>` : ''}<h1>${esc(title)}</h1><span class="coin">🪙 ${S.coins}</span></div>`;
// Unit 1 keeps its original ids so progress saved before units existed stays valid.
let cu = 0;
const U = () => D.units[cu];
const uidOf = (i, id) => (i && id !== 'alphabet' ? `u${i + 1}:${id}` : id);
const uid = id => uidOf(cu, id);
const touchDay = () => {   // daily streak: playing on consecutive days grows it, a missed day restarts it
  const day = d => d.toLocaleDateString('en-CA'), today = day(new Date());
  if (S.lastDay === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak = S.lastDay === day(y) ? (S.streak || 0) + 1 : 1;
  S.lastDay = today;
};
const finish = (id, coins) => { const k = uid(id), first = !S.done[k]; S.done[k] = true; if (first) S.coins += coins; touchDay(); save(); return first ? coins : 0; };

const CHAT_ON = false;   // the AI chat stays hidden until the server has an API key
const GAMES = ['gMatch', 'gFall', 'gListen', 'gSpeak', 'gType'];
const PARTS = ['video', 'words', 'practice', 'grammar', 'exercises'];
const partsOf = u => (u.video ? PARTS : PARTS.slice(1));
const stars = (i, g) => (S.best && S.best[uidOf(i, g)]) || 0;
const unlocked = i => !i || (S.done[uidOf(i - 1, 'words')] && GAMES.some(g => stars(i - 1, g)));
const rowHtml = (go, ic, t, sub, right, extra = '') => `<button class="item" data-go="${go}" ${extra}><span class="ic">${ic}</span><span><b>${esc(t)}</b><small>${esc(sub)}</small></span>${right ? `<span class="tick">${right}</span>` : ''}</button>`;
function home() {
  const n = S.streak || 0;
  $app.innerHTML = header('Inglizcha noldan') + `<div class="main">
    <div class="hero"><h2>Salom! 👋</h2><p>${n ? `🔥 ${n} kunlik seriya. Bugun ham davom eting!` : "Har kuni bir oz o'qing. Shunda tez o'rganasiz."}</p></div>
    <div class="sec">Boshlanish</div>
    ${rowHtml('alphabet', '🔤', 'Alifbo', '26 ta harf, talaffuzi bilan', S.done.alphabet ? '✓' : '')}
    <div class="sec">Darslar</div>
    ${D.units.map((u, i) => {
      if (!unlocked(i)) return `<button class="item locked" disabled><span class="ic">🔒</span><span><b>${i + 1}-unit: ${esc(u.title)}</b><small>Avval ${i}-unitda so'zlar va bitta o'yinni tugating</small></span></button>`;
      const parts = partsOf(u), done = parts.filter(p => S.done[uidOf(i, p)]).length + GAMES.filter(g => stars(i, g)).length, all = parts.length + GAMES.length;
      return rowHtml('unit', '📘', `${i + 1}-unit: ${u.title}`, `${done}/${all} bo'lim tugagan`, done === all ? '✓' : '', `data-unit="${i}"`);
    }).join('')}
  </div>`;
}
function unit() {
  const u = U(), tick = id => S.done[uid(id)] ? '✓' : '', st = g => '⭐'.repeat(stars(cu, g));
  $app.innerHTML = header(`${cu + 1}-unit: ${u.title}`, 'home') + `<div class="main">
    <div class="sec">O'rganish</div>
    ${u.video ? rowHtml('video', '🎬', 'Video dars', u.videoTitle, tick('video')) : ''}
    ${rowHtml('words', '📚', "So'zlar", u.words.length + " ta yangi so'z", tick('words'))}
    ${rowHtml('practice', '🗣', "So'z mashqi", 'Aytib va yozib mashq qiling', tick('practice'))}
    ${rowHtml('grammar', '📐', 'Grammatika', u.grammar.title, tick('grammar'))}
    ${rowHtml('exercises', '✏️', 'Grammatika mashqlari', exRun() ? `Davom eting: ${exRun().i}/${exRun().q.length}` : `${u.ex.length} ta mashq`, tick('exercises'))}
    ${CHAT_ON ? rowHtml('chat', '🤖', 'Emma bilan suhbat', "Sun'iy intellekt bilan inglizcha yozishing", tick('chat')) : ''}
    <div class="sec">O'yinlar</div>
    ${rowHtml('gMatch', '🧩', 'Juftini top', "So'z va ma'nosini vaqtga qarshi juftlang", st('gMatch'))}
    ${rowHtml('gFall', '☄️', "Tushayotgan so'zlar", "So'z yerga tushmasidan tarjimasini toping", st('gFall'))}
    ${rowHtml('gListen', '🎧', 'Eshit va ur', 'Eshiting va rasmini tez toping', st('gListen'))}
    ${rowHtml('gSpeak', '🎤', 'Aytib ol', "So'zni vaqt tugamasidan ovoz bilan ayting", st('gSpeak'))}
    ${rowHtml('gType', '⌨️', 'Eshit va yoz', "Eshitgan so'zingizni tez yozing", st('gType'))}
  </div>`;
}
function video() {
  $app.innerHTML = header('Video dars', 'unit') + `<div class="main"><video class="lesson" src="video/lesson${cu + 1}.mp4" controls playsinline preload="metadata"></video>
    <p class="hint">"Endi siz ayting!" chiqqanda baland ovozda takrorlang.</p>
    <button class="btn" data-finish="video:5">Ko'rdim (+5 🪙)</button></div>`;
}
// Chat with the AI tutor. history holds what the server needs; msgs also keeps the Uzbek lines and corrections for display.
const API_URL = window.API_URL || 'http://127.0.0.1:8787';
const MAX_TURNS = 8;
const FIRST = { en: "Hello! I am Emma. What is your name?", uz: 'Salom! Men Emmaman. Ismingiz nima?' };
const CHAT_ERR = { limit: "Bugungi suhbat limiti tugadi. Ertaga davom etamiz!", not_configured: "Suhbat hali sozlanmagan.", auth: "Ilovani Telegram ichidan oching.", busy: "Emma band. Birozdan keyin yana urinib ko'ring." };
let msgs = [], history = [], chatDone = false, sending = false;
function chat() { msgs = [{ who: 'ai', ...FIRST }]; history = [{ role: 'assistant', content: FIRST.en }]; chatDone = false; sending = false; drawChat(); }
function drawChat(err) {
  const turns = msgs.filter(m => m.who === 'me').length, over = chatDone || turns >= MAX_TURNS;
  const old = document.getElementById('cin'), keep = old ? old.value : '';
  $app.innerHTML = header('Emma bilan suhbat', 'unit') + `<div class="main chat"><div class="msgs" id="msgs">` + msgs.map(m => m.who === 'me'
    ? `<div class="me">${esc(m.en)}</div>`
    : `${m.fix ? `<div class="fix">✏️ ${esc(m.fix)}</div>` : ''}<div class="ai"><b>${esc(m.en)}</b><small>${esc(m.uz)}</small></div>`).join('') +
    (sending ? '<div class="ai typing">Emma yozmoqda...</div>' : '') + (err ? `<div class="fb no">${esc(err)}</div>` : '') + `</div>` +
    (over ? `<button class="btn" data-finish="chat:15">Suhbatni tugatish (+15 🪙)</button>`
      : `<form class="cform" id="cform"><input id="cin" maxlength="200" autocomplete="off" placeholder="Inglizcha yozing..." aria-label="Xabar"><button class="btn" id="csend" ${sending ? 'disabled' : ''}>➤</button></form>`) + `</div>`;
  const inp = document.getElementById('cin'); if (inp) { inp.value = keep; if (!sending) inp.focus(); }
  const box = document.getElementById('msgs'); box.scrollTop = box.scrollHeight;
}
async function sendChat(text) {
  sending = true; msgs.push({ who: 'me', en: text }); history.push({ role: 'user', content: text }); drawChat();
  document.getElementById('cin').value = '';
  let err = null;
  try {
    const r = await fetch(API_URL + '/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-init-data': TG ? TG.initData : '' }, body: JSON.stringify({ history }) });
    const d = await r.json();
    if (!document.getElementById('msgs') || !history.length) return;   // left the screen meanwhile
    if (r.ok) { msgs.push({ who: 'ai', en: d.en, uz: d.uz, fix: d.correction }); history.push({ role: 'assistant', content: d.en }); chatDone = d.done; haptic(!d.correction); }
    else err = CHAT_ERR[d.error] || "Javob kelmadi. Yana urinib ko'ring.";
  } catch (e) { err = "Internet bilan muammo. Yana urinib ko'ring."; }
  sending = false;
  if (err) { const lost = msgs.pop(); history.pop(); drawChat(err); const i = document.getElementById('cin'); if (i) i.value = lost.en; return; }
  drawChat();
}
document.addEventListener('submit', ev => {
  if (ev.target.id !== 'xf') return;
  ev.preventDefault();
  const i = document.getElementById('xin'), v = i.value.trim(), e = Q[qi];
  if (!v || answered) return;
  i.disabled = true; ev.target.querySelector('button').disabled = true;
  feedback(e, isAnswer(v, e.w), e.w[0]);
});
document.addEventListener('submit', ev => {
  if (ev.target.id !== 'cform') return;
  ev.preventDefault();
  const text = document.getElementById('cin').value.trim();
  if (text && !sending) sendChat(text);
});
function alphabet() {
  $app.innerHTML = header('Alifbo', 'home') + `<div class="main"><p class="hint">Harfni bosing va eshiting. Ikki nuqta (:) tovush cho'zilishini bildiradi.</p><div class="grid">` +
    D.alphabet.map((a, i) => `<button class="let" data-letter="${i}"><b>${a.up} ${a.lo}</b><small>${esc(a.say)}</small><span class="p">${a.pic}</span><small>${esc(a.word)} — ${esc(a.uz)}</small></button>`).join('') +
    `</div><button class="btn" data-finish="alphabet:10">Tugatdim (+10 🪙)</button></div>`;
}
let wi = 0;
function words() {
  const u = U(), w = u.words[wi], last = wi === u.words.length - 1;
  $app.innerHTML = header("So'zlar", 'unit') + `<div class="main">
    <div class="bar"><i style="width:${(wi + 1) / u.words.length * 100}%"></i></div>
    <div class="card"><div class="pic">${w.pic}</div><p class="en">${esc(w.en)}</p><div class="tr">[${esc(w.tr)}]</div><p class="uz">${esc(w.uz)}</p>
      <button class="snd" data-play="${w.a}">🔊 Eshitish</button>
      <div id="wspk" style="margin-top:10px"></div>
      <div class="ex"><p><b>${esc(w.ex)}</b></p><p class="u">🇺🇿 ${esc(w.exUz)}</p><button class="snd" data-play="${w.aEx}">🔊 Gapni eshitish</button></div></div>
    <div class="spacer"></div>
    <button class="btn" data-next-word>${last ? 'Tugatdim (+15 🪙)' : 'Keyingi'}</button>
    ${wi ? '<button class="btn sec2" data-prev-word>Oldingi</button>' : ''}</div>`;
  play(w.a);
  speakBox(document.getElementById('wspk'), w.en, w.a, ok => { document.getElementById('wspk').innerHTML = ok ? `<div class="fb ok">✅ Barakalla!</div>` : ''; if (ok) mark(w, true); });
}
function grammar() {
  const g = U().grammar;
  $app.innerHTML = header('Grammatika', 'unit') + `<div class="main"><h2 style="margin:0">${esc(g.title)}</h2><p style="margin:0">${esc(g.intro)}</p>
    <table>${g.rows.map(r => `<tr><td>${esc(r.sub)} <b>${esc(r.be)}</b></td><td>${esc(r.en)}<span class="u">🇺🇿 ${esc(r.uz)}</span></td><td><button class="snd" style="margin:0" data-play="${r.a}" aria-label="Eshitish">🔊</button></td></tr>`).join('')}</table>
    <div class="note">${esc(g.neg)}</div><div class="spacer"></div><button class="btn" data-finish="grammar:10">Tushundim (+10 🪙)</button></div>`;
}
let Q = [], qi = 0, wrong = 0, answered = false, built = [];
// A half-done round is kept on this device, so leaving does not restart a long list.
const RUN_KEY = 'eng_exrun_v1';
const runs = () => { try { return JSON.parse(localStorage.getItem(RUN_KEY)) || {}; } catch (e) { return {}; } };
const setRun = v => { const r = runs(); if (v) r[uid('exercises')] = v; else delete r[uid('exercises')]; try { localStorage.setItem(RUN_KEY, JSON.stringify(r)); } catch (e) {} };
function exRun() { const r = runs()[uid('exercises')]; return r && r.i > 0 && r.q.every(n => U().ex[n]) ? r : null; }
function startEx() {
  const r = exRun();
  Q = r ? r.q.map(n => U().ex[n]) : shuffle(U().ex); qi = r ? r.i : 0; wrong = r ? r.w : 0;
  exercise();
}
function exercise() {
  answered = false; built = [];
  setRun({ q: Q.map(x => U().ex.indexOf(x)), i: qi, w: wrong });
  const e = Q[qi], pct = qi / Q.length * 100;
  let body = '';
  if (e.t === 'choose') body = `<p class="q">${esc(e.q)}</p>`;
  if (e.t === 'fill') body = `<p class="hint">Bo'sh joyni to'ldiring</p><p class="q">${esc(e.q)}</p><p class="hint">🇺🇿 ${esc(e.uz)}</p>`;
  if (e.t === 'fix') body = `<p class="hint">Bu gapda xato bor. To'g'risini tanlang</p><p class="q bad-s">${esc(e.bad)}</p><p class="hint">🇺🇿 ${esc(e.uz)}</p>`;
  if (e.t === 'write') body = `<p class="hint">Inglizcha yozing</p><p class="q">🇺🇿 ${esc(e.uz)}</p><form class="cform" id="xf"><input id="xin" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Inglizcha yozing..." aria-label="Javob"><button class="btn" aria-label="Tekshirish">➤</button></form>`;
  if (e.t === 'listen') body = `<p class="hint">Eshiting va to'g'risini tanlang</p><div><button class="snd" data-play="${e.a_say}">🔊 Yana eshitish</button></div>`;
  if (e.t === 'build') {
    e._bank = shuffle(e.w);
    body = `<p class="hint">Gapni yig'ing</p><p class="q">🇺🇿 ${esc(e.uz)}</p><div class="slot" id="slot"></div><div class="bank" id="bank"></div><button class="btn" id="check" disabled>Tekshirish</button>`;
  } else if (e.t !== 'write') body += e.o.map((o, i) => `<button class="opt" data-opt="${i}">${esc(o)}</button>`).join('');
  $app.innerHTML = `<div class="top"><button class="back" data-go="unit" aria-label="Orqaga">‹</button><div class="bar"><i style="width:${pct}%"></i></div><span class="coin">🪙 ${S.coins}</span></div><div class="main">${body}<div id="fb"></div></div>`;
  if (e.t === 'build') drawBuild(e);
  if (e.t === 'listen') play(e.a_say);
  if (e.t === 'write') document.getElementById('xin').focus();
}
function drawBuild(e) {
  const left = e._bank.slice();
  built.forEach(w => left.splice(left.indexOf(w), 1));
  document.getElementById('slot').innerHTML = built.map((w, i) => `<button class="chip" data-unbuild="${i}">${esc(w)}</button>`).join('');
  document.getElementById('bank').innerHTML = left.map(w => `<button class="chip" data-build="${esc(w)}">${esc(w)}</button>`).join('');
  document.getElementById('check').disabled = built.length !== e.w.length;
}
function feedback(e, ok, answer) {
  answered = true; haptic(ok);
  if (!ok) { wrong++; Q.push(e); }   // a wrong question comes back at the end
  document.getElementById('fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? "To'g'ri! 🎉" : "To'g'ri javob: " + esc(answer)}</div><button class="btn" style="margin-top:10px" data-next-ex>Davom etish</button>`;
  const full = e.t === 'fill' ? e.q.replace('___', e.o[e.a]) : e.t === 'build' ? e.w.join(' ') : e.t === 'write' ? e.w[0] : e.t === 'fix' ? e.o[e.a] : null;
  if (full) play(U().sent[full]);
}
function result(title, msg, got, go = 'unit') {
  $app.innerHTML = header(title) + `<div class="main center"><div class="big">🏆</div><h2 style="margin:0">${esc(msg)}</h2>
    <p class="hint">${got ? '+' + got + ' 🪙 oldingiz' : "Bu bo'lim uchun coin oldin berilgan"}</p><div class="spacer"></div><button class="btn" data-go="${go}">Davom etish</button></div>`;
}
const screens = { home, unit, video, chat, alphabet, grammar, words: () => { wi = 0; words(); }, exercises: startEx };
document.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  setTimeout(syncBack);
  const d = t.dataset;
  if (d.unit !== undefined) cu = +d.unit;
  if (d.go) { if (window.stopGame) stopGame(); if (window.stopVideo) stopVideo(); return screens[d.go](); }
  if (d.c !== undefined) return window.cueTap && cueTap(t, d.c);
  if (d.g !== undefined) return window.gameTap && gameTap(t, d.g);
  if (d.play) return play(d.play);
  if (d.letter !== undefined) { const a = D.alphabet[+d.letter]; play(a.aL); setTimeout(() => play(a.aW), 900); return; }
  if (d.finish) { const [id, c] = d.finish.split(':'); return result('Barakalla!', "Bo'lim tugadi", finish(id, +c), id === 'alphabet' ? 'home' : 'unit'); }
  if ('nextWord' in d) { if (wi < U().words.length - 1) { wi++; return words(); } return result('Barakalla!', "So'zlar tugadi", finish('words', 15)); }
  if ('prevWord' in d) { wi--; return words(); }
  const e = Q[qi];
  if (d.opt !== undefined && !answered) {
    const i = +d.opt, ok = i === e.a;
    document.querySelectorAll('.opt').forEach((b, n) => { if (n === e.a) b.classList.add('ok'); else if (n === i) b.classList.add('no'); b.disabled = true; });
    return feedback(e, ok, e.o[e.a]);
  }
  if (d.build !== undefined && !answered) { built.push(d.build); return drawBuild(e); }
  if (d.unbuild !== undefined && !answered) { built.splice(+d.unbuild, 1); return drawBuild(e); }
  if (t.id === 'check' && !answered) { t.style.display = 'none'; return feedback(e, built.join(' ') === e.w.join(' '), e.w.join(' ')); }
  if ('nextEx' in d) { qi++; if (qi < Q.length) return exercise(); setRun(null); return result('Barakalla!', wrong ? wrong + ' ta xato bilan tugatdingiz' : 'Xatosiz tugatdingiz!', finish('exercises', 20)); }
});
if (TG) {
  document.body.classList.add('in-tg');
  TG.ready(); TG.expand();
  if (TG.isVersionAtLeast('6.1')) { TG.setHeaderColor('#ffffff'); TG.setBackgroundColor('#f9fafb'); TG.BackButton.onClick(() => { const b = document.querySelector('.back'); if (b) b.click(); }); }
  if (hasCloud) TG.CloudStorage.getItem(KEY, (err, v) => {   // keep whichever progress is further along
    if (err || !v) return;
    let c; try { c = JSON.parse(v); } catch (e) { return; }
    if ((c.coins || 0) <= S.coins) return;
    S = Object.assign({ coins: 0, done: {} }, c);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    if (document.querySelector('.hero')) home();
  });
}
home();
