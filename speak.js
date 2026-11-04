// Speaking practice. Uses the browser's speech recognition where it exists; where it does not (many in-app browsers),
// the learner records themselves, compares with the native voice and judges honestly. Answer checks for writing live here too.
const CONTRACT = { "i'm": 'i am', "you're": 'you are', "he's": 'he is', "she's": 'she is', "we're": 'we are', "they're": 'they are', "what's": 'what is', "i've": 'i have', "isn't": 'is not', "it's": 'it is', "there's": 'there is', "aren't": 'are not', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', cannot: 'can not', "wasn't": 'was not', "weren't": 'were not' };
const normText = s => String(s).toLowerCase().replace(/[’`]/g, "'").split(/\s+/).map(w => CONTRACT[w.replace(/[.,!?]/g, '')] || w).join(' ').replace(/[.,!?"']/g, '').replace(/\s+/g, ' ').trim();
const isAnswer = (text, accepted) => accepted.some(a => normText(a) === normText(text));
// words a recogniser commonly hears instead of a short English word
const SOUNDS_LIKE = { i: ['eye', 'aye', 'hi'], you: ['u', 'yu'], no: ['know'], two: ['to', 'too'], son: ['sun'], one: ['won'], our: ['hour'], her: ['hur'], do: ['due', 'dew'], we: ['wee'], he: ['hee'], she: ['shee'], my: ['mai'], his: ['hiss'], is: ['iz'] };
const heardRight = (expected, alts) => {
  const e = normText(expected), ok = [e, ...(SOUNDS_LIKE[e] || [])];
  return alts.some(a => { const n = normText(a); return ok.includes(n) || ` ${n} `.includes(` ${e} `); });
};

const Speech = {
  rec: null,
  can: () => !Speech.blocked && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  // cb({ok, heard}) on a result; cb({silent:true}) when nothing was heard; cb({failed:true}) when recognition cannot work here
  listen(expected, cb) {
    Speech.stop();
    const R = window.SpeechRecognition || window.webkitSpeechRecognition, r = new R();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
    let done = false; const once = v => { if (!done) { done = true; if (Speech.rec === r) Speech.rec = null; cb(v); } };
    r.onresult = ev => { const alts = [...ev.results[0]].map(x => x.transcript); once({ ok: heardRight(expected, alts), heard: alts[0] }); };
    r.onerror = ev => { if (ev.error === 'no-speech' || ev.error === 'aborted') once({ silent: true }); else { Speech.blocked = true; once({ failed: true }); } };
    r.onend = () => once({ silent: true });
    Speech.rec = r;
    try { r.start(); } catch (e) { Speech.blocked = true; once({ failed: true }); }
  },
  stop() { const r = Speech.rec; Speech.rec = null; if (r) { r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch (e) {} } },
};
const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const recordFor = async ms => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  const stopped = new Promise(res => { rec.onstop = res; });
  rec.start(); setTimeout(() => rec.state === 'recording' && rec.stop(), ms);
  await stopped; stream.getTracks().forEach(t => t.stop());
  return URL.createObjectURL(new Blob(parts, { type: rec.mimeType }));
};

// A self-contained speaking box inside `el`. onDone(ok) fires once the learner has said it, or chose to move on.
function speakBox(el, expected, audio, onDone) {
  Speech.stop();
  const live = () => el.isConnected;
  const hear = `<button type="button" class="snd" data-sp="hear">🔊 Eshitish</button>`;
  const bind = (h) => { el.querySelectorAll('[data-sp]').forEach(b => { b.onclick = () => h[b.dataset.sp](b); }); };
  const finish_ = ok => { Speech.stop(); onDone(ok); };
  const common = { hear: () => play(audio), skip: () => finish_(false), yes: () => finish_(true), no: () => finish_(false) };
  const selfCheck = (extra = '') => {
    el.innerHTML = `<p class="hint">${extra}Inglizcha aytdingizmi? O'zingiz baholang:</p><div class="spk">${hear}<button type="button" class="snd" data-sp="yes">✅ Aytdim</button><button type="button" class="snd bad" data-sp="no">❌ Aytolmadim</button></div>`;
    bind(common);
  };
  const recMode = () => {
    el.innerHTML = `<div class="spk">${hear}<button type="button" class="snd mic" data-sp="rec">🎤 Yozib olish</button><button type="button" class="snd bad" data-sp="skip">O'tkazish</button></div>`;
    bind({ ...common, rec: async b => {
      b.disabled = true; b.textContent = '🔴 Gapiring...';
      let url; try { url = await recordFor(2500); } catch (e) { if (live()) selfCheck(); return; }
      if (!live()) return;
      el.innerHTML = `<p class="hint">Ovozingizni tinglab, to'g'ri aytganingiz bilan solishtiring:</p><div class="spk"><button type="button" class="snd" data-sp="mine">🗣 Mening ovozim</button>${hear}<button type="button" class="snd" data-sp="yes">✅ To'g'ri</button><button type="button" class="snd bad" data-sp="again">🔁 Yana</button></div>`;
      bind({ ...common, mine: () => play(url), again: recMode });
    } });
  };
  const srMode = (msg = '') => {
    el.innerHTML = `${msg}<div class="spk">${hear}<button type="button" class="snd mic" data-sp="talk">🎤 Bosib, ayting</button><button type="button" class="snd bad" data-sp="skip">O'tkazish</button></div>`;
    bind({ ...common, talk: b => {
      b.disabled = true; b.textContent = '🔴 Tinglayapman...';
      Speech.listen(expected, r => {
        if (!live()) return;
        if (r.failed) return canRecord() ? recMode() : selfCheck();
        if (r.silent) return srMode(`<p class="hint">Ovoz eshitilmadi. Yana urinib ko'ring.</p>`);
        if (r.ok) { el.innerHTML = `<div class="fb ok">✅ Zo'r! "${esc(r.heard)}"</div>`; haptic(true); return setTimeout(() => live() && onDone(true), 800); }
        haptic(false); srMode(`<div class="fb no">Eshitildi: "${esc(r.heard)}". Yana urinib ko'ring.</div>`);
      });
    } });
  };
  if (Speech.can()) srMode(); else if (canRecord()) recMode(); else selfCheck();
}
