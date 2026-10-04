/* CHAOS & CONTROL — workout check-in PWA
   Vanilla JS, no build step. Data stays on this device:
   localStorage (sessions, steps, food, skills) + IndexedDB (photos).
   No geolocation is used anywhere in this app. */
'use strict';
(function () {
// ---------------------------------------------------------------- constants
const LS_KEY = 'cc.v1';
const LIFTS = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
const TYPES = [...LIFTS, 'Other/Cardio'];
const ABBR = { 'Upper A': 'UA', 'Lower A': 'LA', 'Upper B': 'UB', 'Lower B': 'LB', 'Other/Cardio': '??' };
const SUIT = { 'Upper A': 's-spade', 'Lower A': 's-club', 'Upper B': 's-heart', 'Lower B': 's-diamond', 'Other/Cardio': 's-wild' };
const SCHEDULE = { 1: 'Upper A', 2: 'Lower A', 4: 'Upper B', 5: 'Lower B' }; // Mon Tue Thu Fri
const REST_DAYS = [0, 3, 6]; // Sun Wed Sat
const GYMS = ['The WAVE Athletics (Waverly, NE)', 'Waverly High School'];
const STEP_GOAL = 10000, STEP_MIN = 8000;
const CAL = [2250, 2450], PRO = [160, 185];
const WEEK_TARGET = 4;
const SKILL_COLORS = ['g', 'p', 'b'];
const HYPE = [
  'Chaos in the set. Control in the rep.',
  'Show up. Clock in. Leave lighter.',
  '197 → 185. One shift at a time.',
  'Wild energy. Tight form.',
  'Discipline is the trick up your sleeve.',
  'The plan is the punchline. Execute it.',
  'Flip the card. Finish the set.',
  'Laugh at the weight. Then move it.',
  'Quiet mind. Loud lifts.',
  'Four shifts a week. No calling in sick.',
  'The deck is stacked — you stacked it.',
  'Nobody is watching. Train like they are.',
  'Stay hungry. Stay in the deficit.',
  'Land every rep like a perfect dismount.',
  'Let the music be chaos. Let the bar path be control.',
  'Wild card energy, front-row discipline.',
  'Today’s rep is tomorrow’s receipt.',
  'Controlled descent. Explosive finish.',
  'The only joke here is skipping legs.',
  'Clock in like it’s payday.'
];
const SEED_FAVS = [['Regular pop', 150, 0], ['Protein oats', 545, 37], ['Chicken rice bowl', 555, 59], ['Greek yogurt bowl', 265, 24], ['Whey shake', 120, 24]];
const SEED_SKILLS = [['Cooking', '🍳', 3], ['Meal prep', '🥡', 1], ['Reading', '📚', 3], ['Morning routine', '☀️', 5], ['No-phone hour', '📵', 3]];
const EMOJI_PICKS = ['🍳', '🥡', '📚', '☀️', '📵', '🧘', '🎸', '✍️', '🧠', '💤', '🚶', '🧹', '💰', '🎯', '🃏', '⚡'];

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const dateKey = d => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dateKey(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtNum = n => Math.round(n).toLocaleString('en-US');
const fmtTime = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDay = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDur = ms => { const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return h ? `${h}h ${pad(m % 60)}m` : `${m}m`; };
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(pad); };
const shortGym = g => g.replace(/\s*\(.*\)\s*/, '').trim();
const scheduledType = (d = new Date()) => SCHEDULE[new Date(d).getDay()] || 'Other/Cardio';
const isRestDay = (d = new Date()) => REST_DAYS.includes(new Date(d).getDay());
const ago = t => {
  if (!t) return 'never';
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return 'today ' + fmtTime(t);
  if (days === 1) return 'yesterday';
  return days + ' days ago';
};
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* iOS: unsupported */ } };
const randHype = () => HYPE[Math.floor(Math.random() * HYPE.length)];

// ---------------------------------------------------------------- state
function freshState() {
  return {
    v: 1, created: Date.now(), sessions: [], active: null, steps: {}, food: {}, rest: {},
    favorites: SEED_FAVS.map(([name, cal, protein]) => ({ id: uid(), name, cal, protein })),
    skills: SEED_SKILLS.map(([name, emoji, target]) => ({ id: uid(), name, emoji, target, created: Date.now() })),
    skillLogs: [],
    settings: { gym: GYMS[0], gymOther: '' }
  };
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw), f = freshState();
    return Object.assign(f, s, { settings: Object.assign(f.settings, s.settings || {}) });
  } catch (e) { console.warn('state load failed', e); return freshState(); }
}
let S = load();
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch (e) { toast('Storage full — export a backup'); }
}
const ui = { tab: 'clock', type: scheduledType(), typeDay: todayKey(), weekOff: 0, foodDay: todayKey(), stepsDay: todayKey(), favEdit: false, note: '', hype: randHype() };

// ---------------------------------------------------------------- IndexedDB photos
const idb = {
  _db: null,
  open() {
    return this._db || (this._db = new Promise((res, rej) => {
      const r = indexedDB.open('cc-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode); const st = t.objectStore('photos');
      const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  put(id, blob) { return this.tx('readwrite', st => st.put(blob, id)); },
  get(id) { return this.tx('readonly', st => st.get(id)); },
  del(id) { return this.tx('readwrite', st => st.delete(id)); },
  keys() { return this.tx('readonly', st => st.getAllKeys()); }
};
const urlCache = new Map();
async function photoURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  try { const b = await idb.get(id); if (!b) return null; const u = URL.createObjectURL(b); urlCache.set(id, u); return u; }
  catch (e) { return null; }
}
function hydrate(root) {
  $$('img[data-photo]', root).forEach(async img => {
    const u = await photoURL(img.dataset.photo);
    if (u) img.src = u; else img.replaceWith(Object.assign(document.createElement('div'), { className: 'ph', textContent: 'NO PHOTO' }));
  });
}
async function deletePhotos(...ids) { for (const id of ids.filter(Boolean)) { try { await idb.del(id); await idb.del(id + '_t'); } catch (e) {} urlCache.delete(id); urlCache.delete(id + '_t'); } }

// ---------------------------------------------------------------- photo: stamp + compress
function loadImage(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode failed')); };
    img.src = u; // modern browsers apply EXIF orientation when drawing
  });
}
const canvasBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function processPhoto(file, lines) {
  try { await document.fonts.load('800 32px "Barlow Condensed"'); } catch (e) {}
  const img = await loadImage(file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight, s = Math.min(1, 1280 / Math.max(w0, h0));
  const w = Math.round(w0 * s), h = Math.round(h0 * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  stamp(x, w, h, lines);
  const blob = await canvasBlob(c, 0.7);
  const ts = Math.min(1, 360 / Math.max(w, h)); const t = document.createElement('canvas');
  t.width = Math.round(w * ts); t.height = Math.round(h * ts); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  const thumb = await canvasBlob(t, 0.72);
  return { blob, thumb, w, h, url: URL.createObjectURL(blob) };
}
function stamp(x, w, h, lines) {
  const fs = Math.max(16, Math.round(Math.min(w, h) * 0.042));
  const font = (wt, sz) => `${wt} ${sz}px "Barlow Condensed","Arial Narrow",sans-serif`;
  const lw = Math.max(...lines.map((l, i) => { x.font = font(i ? 700 : 800, i ? fs * .82 : fs); return x.measureText(l).width; }));
  const padX = fs * .7, lh = fs * 1.12, bw = lw + padX * 2 + fs, bh = lh * lines.length + fs * .7;
  const bx = Math.round(fs * .5), by = Math.round(h - bh - fs * .5);
  x.save();
  x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + bw, by); x.lineTo(bx + bw - fs * .9, by + bh); x.lineTo(bx, by + bh); x.closePath();
  x.fillStyle = 'rgba(11,11,18,.82)'; x.fill();
  x.fillStyle = '#7CFF3A'; x.fillRect(bx, by, Math.max(4, fs * .22), bh);
  x.fillStyle = '#1E90FF'; x.fillRect(bx, by + bh - Math.max(3, fs * .14), bw - fs * .9, Math.max(3, fs * .14));
  x.textBaseline = 'top';
  lines.forEach((l, i) => {
    x.font = font(i ? 700 : 800, i ? fs * .82 : fs);
    x.fillStyle = i === 0 ? '#7CFF3A' : i === lines.length - 1 ? '#6CB8FF' : '#F3EEFA';
    x.fillText(l, bx + padX, by + fs * .38 + i * lh);
  });
  x.restore();
}

// ---------------------------------------------------------------- stats
const LIFT = s => LIFTS.includes(s.type);
function sessionsIn(ws, we) { return S.sessions.filter(s => s.start >= +ws && s.start < +we); }
function liftCount(ws) { return sessionsIn(ws, addDays(ws, 7)).filter(LIFT).length; }
function workoutStreak() {
  let ws = weekStart(new Date()), n = 0;
  if (liftCount(ws) >= WEEK_TARGET) n++;
  ws = addDays(ws, -7);
  const first = S.sessions.reduce((m, s) => Math.min(m, s.start), Infinity);
  while (+ws + 7 * 864e5 > first && liftCount(ws) >= WEEK_TARGET) { n++; ws = addDays(ws, -7); }
  return n;
}
const stepsOn = k => (S.steps[k] && S.steps[k].n) || 0;
function restCredit(k) {
  const r = S.rest[k]; if (!r) return 0;
  if (!REST_DAYS.includes(keyToDate(k).getDay())) return 0;
  return (stepsOn(k) >= STEP_MIN || (r.walkMin || 0) > 0) ? 0.5 : 0;
}
function foodTotals(k) { return (S.food[k] || []).reduce((a, e) => ({ cal: a.cal + (+e.cal || 0), pro: a.pro + (+e.protein || 0) }), { cal: 0, pro: 0 }); }
function skillWeekCount(id, ws) { const we = addDays(ws, 7); return S.skillLogs.filter(l => l.skillId === id && l.t >= +ws && l.t < +we).length; }
function skillStreak(sk) {
  const tgt = sk.target || 1; let ws = weekStart(new Date()), n = 0;
  if (skillWeekCount(sk.id, ws) >= tgt) n++;
  ws = addDays(ws, -7);
  const first = S.skillLogs.filter(l => l.skillId === sk.id).reduce((m, l) => Math.min(m, l.t), Infinity);
  while (+ws + 7 * 864e5 > first && skillWeekCount(sk.id, ws) >= tgt) { n++; ws = addDays(ws, -7); }
  return n;
}
function skillLast(id) { return S.skillLogs.filter(l => l.skillId === id).reduce((m, l) => Math.max(m, l.t), 0); }
function weekSummary(ws) {
  ws = weekStart(ws); const we = addDays(ws, 7), now = new Date();
  const all = sessionsIn(ws, we).sort((a, b) => a.start - b.start);
  const lifts = all.filter(LIFT);
  const days = [...Array(7)].map((_, i) => dateKey(addDays(ws, i)));
  const past = days.filter(k => keyToDate(k) <= now);
  const stepDays = past.filter(k => S.steps[k]);
  const foodDays = past.filter(k => (S.food[k] || []).length);
  const ft = foodDays.map(foodTotals);
  return {
    ws, we, days, all, lifts, liftCount: lifts.length,
    totalMs: all.reduce((a, s) => a + (s.end - s.start), 0),
    restCredits: days.reduce((a, k) => a + restCredit(k), 0),
    restMax: days.filter(k => REST_DAYS.includes(keyToDate(k).getDay())).length * 0.5,
    avgSteps: stepDays.length ? stepDays.reduce((a, k) => a + stepsOn(k), 0) / stepDays.length : null, stepDays: stepDays.length,
    avgCal: ft.length ? ft.reduce((a, t) => a + t.cal, 0) / ft.length : null,
    avgPro: ft.length ? ft.reduce((a, t) => a + t.pro, 0) / ft.length : null, foodDays: foodDays.length,
    photos: all.flatMap(s => [s.photoIn, s.photoOut]).filter(Boolean),
    skills: S.skills.map(sk => ({ ...sk, count: skillWeekCount(sk.id, ws) }))
  };
}

// ---------------------------------------------------------------- small render helpers
function ring(val, max, { size = 84, stroke = 10, color = 'var(--blue)', marker = null, glow = true } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, val / max)), h = size / 2;
  let mk = '';
  if (marker != null) {
    const a = (marker / max) * 2 * Math.PI - Math.PI / 2, r1 = r - stroke * .9, r2 = r + stroke * .9;
    mk = `<line x1="${h + Math.cos(a) * r1}" y1="${h + Math.sin(a) * r1}" x2="${h + Math.cos(a) * r2}" y2="${h + Math.sin(a) * r2}" stroke="#7CFF3A" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle class="trk" cx="${h}" cy="${h}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="arc" cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${h} ${h})" ${glow ? `style="filter:drop-shadow(0 0 6px ${color})"` : ''}/>
    ${mk}</svg>`;
}
const suit = (t, cls = 'pc-suit') => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#${SUIT[t] || 's-wild'}"/></svg>`;
function currentGym() { return S.settings.gym === 'Other' ? (S.settings.gymOther.trim() || 'Other gym') : S.settings.gym; }

function weekDaysHTML(ws) {
  const today = todayKey();
  return `<div class="days">${[...Array(7)].map((_, i) => {
    const d = addDays(ws, i), k = dateKey(d), dow = d.getDay();
    const ss = S.sessions.filter(s => dateKey(s.start) === k);
    const lift = ss.find(LIFT), other = ss.find(s => !LIFT(s));
    let cls = 'day', inner = '';
    if (lift) { cls += ' lift'; inner = ABBR[lift.type]; }
    else if (other) { cls += ' other'; inner = '??'; }
    else if (restCredit(k)) { cls += ' rest'; inner = '½'; }
    else if (S.rest[k]) cls += ' rest-pend';
    else if (SCHEDULE[dow]) { cls += ' sched'; }
    if (k === today) cls += ' today';
    return `<div class="${cls}"><i>${inner}</i>${'MTWTFSS'[i]}</div>`;
  }).join('')}</div>`;
}
function bonusHTML(sum) {
  const pct = sum.restMax ? (sum.restCredits / sum.restMax) * 100 : 0;
  return `<div class="bonus"><span class="mini" style="color:var(--green)">REST BONUS</span><div class="bar"><b style="width:${pct}%"></b></div><span class="mini">${sum.restCredits.toFixed(1)} / ${sum.restMax.toFixed(1)}</span></div>`;
}
function skillStripHTML() {
  const ws = weekStart(new Date());
  if (!S.skills.length) return '';
  return `<div class="label" style="margin-top:12px">SKILLS THIS WEEK <span class="blue">TAP TO OPEN</span></div><div class="skillstrip">${S.skills.map((sk, i) => {
    const n = skillWeekCount(sk.id, ws), t = sk.target;
    return `<button class="chip c-${SKILL_COLORS[i % 3]} ${t && n >= t ? 'done' : ''}" data-act="tab" data-tab="skills"><span class="e">${esc(sk.emoji || '◆')}</span>${esc(sk.name)} <small>${n}${t ? '/' + t : ''}</small></button>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- CLOCK view
function renderClock() {
  const v = $('#view-clock');
  if (ui.typeDay !== todayKey()) { ui.type = scheduledType(); ui.typeDay = todayKey(); }
  v.innerHTML = S.active ? activeHTML() : idleHTML();
  hydrate(v); tick();
  $('#liveDot').hidden = !S.active;
}
function idleHTML() {
  const sched = scheduledType(), ws = weekStart(new Date()), sum = weekSummary(ws), streak = workoutStreak();
  const g = S.settings.gym, today = new Date(), liftDay = !!SCHEDULE[today.getDay()];
  return `
  <div class="hype" id="hype"><span>${esc(ui.hype)}</span></div>
  <div class="label">PICK YOUR HAND <span>${today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · <b>${liftDay ? esc(sched.toUpperCase()) : 'REST DAY'}</b></span></div>
  <div class="hand">${TYPES.map(t => `
    <button class="pcard ${t === ui.type ? 'sel' : ''}" data-act="pickType" data-type="${t}" aria-pressed="${t === ui.type}">
      <span class="pc-idx">${ABBR[t]}</span>${suit(t)}<span class="pc-name">${t === 'Other/Cardio' ? 'Other / Cardio' : t}</span>
      ${t === sched && liftDay ? '<em>TODAY</em>' : ''}
    </button>`).join('')}</div>
  <div class="label">GYM</div>
  <div class="gyms">
    ${[...GYMS, 'Other'].map(o => `<button class="gym ${g === o ? 'sel' : ''}" data-act="pickGym" data-gym="${esc(o)}"><i></i>${esc(o)}</button>`).join('')}
    ${g === 'Other' ? `<input class="txt" id="gymOther" placeholder="Gym name" value="${esc(S.settings.gymOther)}" autocomplete="off">` : ''}
  </div>
  <div class="clock-wrap">
    <button class="clockin" data-act="clockIn" id="clockInBtn" aria-label="Clock in: take a photo of your equipment">
      <span class="ci-ring"></span>
      <span class="ci-core">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.6"/></svg>
        <b>CLOCK IN</b><small>PHOTO PROOF REQUIRED</small>
      </span>
    </button>
  </div>
  <div class="label">THIS WEEK <span class="blue">${fmtShort(ws).toUpperCase()} – ${fmtShort(addDays(ws, 6)).toUpperCase()}</span></div>
  <div class="weekstrip">
    <div class="tile ring-tile" data-act="tab" data-tab="log">${ring(sum.liftCount, WEEK_TARGET, { size: 70, stroke: 9 })}<div><div class="big">${sum.liftCount}/${WEEK_TARGET}</div><div class="mini">lifts done</div></div></div>
    <div class="tile streak-tile"><div class="big">${streak}<span> WK</span></div><div class="mini">4/4 streak</div></div>
  </div>
  ${weekDaysHTML(ws)}
  ${bonusHTML(sum)}
  ${skillStripHTML()}
  ${isRestDay() ? restCardHTML() : ''}
  ${today.getDay() === 0 ? summaryHTML(ws, false) : ''}`;
}
function restCardHTML() {
  const k = todayKey(), r = S.rest[k], st = stepsOn(k), cr = restCredit(k);
  let status;
  if (cr) status = `<b style="color:var(--green)">½ CREDIT BANKED.</b> ${r.walkMin ? `Walk: ${r.walkMin} min. ` : ''}Steps: ${fmtNum(st)}.`;
  else if (r) status = `Logged, but the half credit is pending. Hit ${fmtNum(STEP_MIN)} steps (now ${fmtNum(st)}) or add a walk.`;
  else status = `Rest counts too. Hit ${fmtNum(STEP_MIN)}+ steps or log a walk for <b style="color:var(--green)">½ day credit</b>.`;
  return `<div class="card-x rest-card"><h3>REST DAY // RECOVER LOUD</h3><p>${status}</p>
    <button class="btn g" data-act="restLog" id="restBtn">${r ? 'UPDATE REST / WALK' : 'LOG REST / WALK'}</button></div>`;
}
function activeHTML() {
  const a = S.active, el = Date.now() - a.start;
  return `<div class="active-wrap">
    <span class="live"><i></i>ON THE CLOCK</span>
    <h2 class="sess-title">${esc(a.type)}</h2>
    <div class="sess-gym">${esc(a.gym)}</div>
    <div class="timer-box"><div class="timer" id="timer">${timerHTML(el)}</div>
      <div class="timer-sub">STARTED ${fmtTime(a.start)} · ${fmtDay(a.start).toUpperCase()}</div>
      <div class="chev-run"><i></i><i></i><i></i><i></i><i></i></div></div>
    <div class="hype" id="hype"><span>${esc(ui.hype)}</span></div>
    <div class="proof"><img data-photo="${a.photoIn}_t" alt="Check-in photo"><div><b>CHECK-IN PROOF LOCKED</b><small>Stamped ${fmtTime(a.start)} · saved on this phone</small></div></div>
    ${el > 3 * 36e5 ? `<div class="warn">Over 3 hours on the clock. Forgot to clock out? You can set the real end time when you clock out.</div>` : ''}
    <button class="clockout" data-act="clockOut" id="clockOutBtn">CLOCK OUT</button>
  </div>`;
}
const timerHTML = ms => { const [h, m, s] = fmtClock(ms); return `${h}:${m}<span class="sec">:${s}</span>`; };
function tick() {
  if (!S.active) { if (document.title.includes('·')) document.title = 'Chaos & Control — Check-In'; return; }
  const el = Date.now() - S.active.start, t = $('#timer');
  if (t) t.innerHTML = timerHTML(el);
  const sd = $('#coDur'); if (sd) sd.textContent = fmtDur(el);
  document.title = `${fmtClock(el).join(':')} · ${S.active.type}`;
}
setInterval(tick, 1000);
setInterval(() => { ui.hype = randHype(); const h = $('#hype'); if (h) h.innerHTML = `<span>${esc(ui.hype)}</span>`; }, 9000);

// clock-in flow
let pending = null, photoPurpose = 'in';
function choosePhoto(purpose) { photoPurpose = purpose; const i = $('#photoInput'); i.value = ''; i.click(); }
$('#photoInput').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  toast('Stamping proof…');
  try {
    const when = new Date();
    const type = photoPurpose === 'in' ? ui.type : S.active.type;
    const gym = photoPurpose === 'in' ? currentGym() : S.active.gym;
    const lines = [`CHAOS & CONTROL · ${photoPurpose === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}`, `${type.toUpperCase()} · ${shortGym(gym).toUpperCase()}`,
      when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).toUpperCase()];
    if (pending && pending.url) URL.revokeObjectURL(pending.url);
    pending = Object.assign(await processPhoto(f, lines), { purpose: photoPurpose, when: +when });
    hideToast();
    if (photoPurpose === 'in') openClockInConfirm(); else openClockOut(true);
  } catch (err) { console.error(err); toast('Could not read that photo, try again'); }
});
function openClockInConfirm() {
  openSheet(`<h2>PROOF <span style="color:var(--green)">LOCKED</span></h2>
    <p class="sub">${esc(ui.type)} · ${esc(currentGym())}</p>
    <img class="preview" id="pvIn" src="${pending.url}" alt="Stamped check-in photo">
    <p class="sub" style="font-size:12px">${pending.w}×${pending.h} · ${Math.round(pending.blob.size / 1024)} KB · stays on this phone</p>
    <div class="row"><button class="btn o" data-act="retakeIn">RETAKE</button><button class="btn g" data-act="confirmIn" id="confirmIn">CLOCK IN ▸</button></div>`);
}
async function confirmClockIn() {
  if (!pending || pending.purpose !== 'in' || S.active) return;
  const id = uid(), pid = `p_${id}_in`;
  try { await idb.put(pid, pending.blob); await idb.put(pid + '_t', pending.thumb); }
  catch (e) { toast('Photo save failed. Is storage blocked?'); return; }
  S.active = { id, type: ui.type, gym: currentGym(), start: Date.now(), photoIn: pid, photoMeta: { w: pending.w, h: pending.h, bytes: pending.blob.size } };
  save(); pending = null; closeSheet();
  buzz([40, 30, 90]); burst('CLOCKED IN', S.active.type.toUpperCase());
  ui.hype = randHype(); renderClock();
}
function openClockOut(keep) {
  if (!S.active) return;
  if (!keep) pending = null;
  const a = S.active, el = Date.now() - a.start, out = pending && pending.purpose === 'out';
  const long = el > 3 * 36e5;
  const localISO = t => { const d = new Date(t); return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  openSheet(`<h2>END THE <span style="color:var(--blue)">SHIFT</span>?</h2>
    <p class="sub">${esc(a.type)} · <b id="coDur" style="color:var(--blue-hi)">${fmtDur(el)}</b> on the clock</p>
    ${out ? `<img class="preview" id="pvOut" src="${pending.url}" alt="Finish photo"><button class="btn o full" data-act="photoOut">RETAKE FINISH PHOTO</button>`
          : `<button class="btn o full" data-act="photoOut" id="photoOutBtn">📸 ADD FINISH PHOTO (OPTIONAL)</button>`}
    <label class="field"><span>Note (optional)</span><input class="txt" id="coNote" maxlength="140" placeholder="PRs, how it felt, what to fix" value="${esc(ui.note)}"></label>
    ${long ? `<label class="field"><span>Forgot to clock out? Real end time</span><input class="txt" type="datetime-local" id="coEnd" min="${localISO(a.start)}" max="${localISO(Date.now())}" value="${localISO(Date.now())}"></label>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn o" data-act="closeSheet">KEEP GOING</button><button class="btn b" data-act="confirmOut" id="confirmOut">CLOCK OUT ▸</button></div>
    <p style="text-align:center;margin-top:16px"><button data-act="discard" style="color:var(--muted);font-size:13px;text-decoration:underline">Discard this session (clocked in by mistake)</button></p>`);
  const n = $('#coNote'); if (n) n.addEventListener('input', () => { ui.note = n.value; });
}
async function confirmClockOut() {
  const a = S.active; if (!a) return;
  let end = Date.now();
  const ce = $('#coEnd'); if (ce && ce.value) { const t = new Date(ce.value).getTime(); if (t > a.start && t <= end) end = t; }
  let photoOut = null;
  if (pending && pending.purpose === 'out') {
    photoOut = `p_${a.id}_out`;
    try { await idb.put(photoOut, pending.blob); await idb.put(photoOut + '_t', pending.thumb); } catch (e) { photoOut = null; }
  }
  const sess = { id: a.id, type: a.type, gym: a.gym, start: a.start, end, dur: end - a.start, photoIn: a.photoIn, photoOut, note: (ui.note || '').trim(), photoMeta: a.photoMeta };
  S.sessions.push(sess); S.active = null; save();
  pending = null; ui.note = ''; closeSheet();
  buzz([90, 50, 90, 50, 220]);
  renderClock(); revealCard(sess);
}
async function discardActive() {
  if (!S.active || !confirm('Discard this session? The check-in photo will be deleted.')) return;
  await deletePhotos(S.active.photoIn); S.active = null; save(); pending = null; closeSheet(); renderClock(); toast('Session discarded');
}
function burst(title, sub) {
  const b = $('#burst'); $('#burstTitle').textContent = title; $('#burstSub').textContent = sub;
  b.classList.remove('play', 'flash'); void b.offsetWidth; b.classList.add('play', 'flash');
  clearTimeout(burst._t); burst._t = setTimeout(() => b.classList.remove('play', 'flash'), 1500);
}
function cardBackSVG() {
  // self-drawn wildcard back: diagonal split, chevrons, diamond lattice and a big "?" star
  return `<svg viewBox="0 0 280 400" preserveAspectRatio="none">
    <defs><pattern id="dm" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="20" height="20" fill="#5B2A86"/><rect width="10" height="10" fill="#4a2270"/></pattern></defs>
    <rect width="280" height="400" fill="url(#dm)"/>
    <polygon points="0,0 280,0 280,150 0,250" fill="#0B0B12" opacity=".55"/>
    <rect x="14" y="14" width="252" height="372" rx="12" fill="none" stroke="#7CFF3A" stroke-width="4"/>
    <rect x="24" y="24" width="232" height="352" rx="8" fill="none" stroke="#1E90FF" stroke-width="2" stroke-dasharray="10 6"/>
    <g fill="#1E90FF">${[0, 1, 2].map(i => `<path d="M${88 + i * 34} 300h16l22 26-22 26h-16l22-26z"/>`).join('')}</g>
    <g transform="translate(140 170)"><path d="M0-90 22-28 88-34 36 8 60 72 0 34-60 72-36 8-88-34-22-28Z" fill="#7CFF3A" stroke="#000" stroke-width="5"/>
      <text y="26" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="84" fill="#0B0B12">?</text></g>
    <text x="140" y="58" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="26" fill="#F3EEFA" letter-spacing="3">CHAOS &amp; CONTROL</text>
  </svg>`;
}
function revealCard(sess) {
  const r = $('#reveal'), n = liftCount(weekStart(sess.start)), isLift = LIFT(sess);
  const idx = `${ABBR[sess.type]}<small>${isLift ? n + '/4' : 'BONUS'}</small>`;
  r.innerHTML = `<div class="flip" id="flipCard">
      <div class="face back">${cardBackSVG()}</div>
      <div class="face front">
        <div class="idx tl">${idx}</div><div class="idx br">${idx}</div>
        <div class="mid">
          <span class="stamp">SESSION LOGGED</span>
          <h3>${esc(sess.type)}</h3>
          <div class="d">${fmtDur(sess.end - sess.start)}</div>
          <div class="m">${fmtTime(sess.start)} – ${fmtTime(sess.end)} · ${esc(shortGym(sess.gym))}</div>
          <img data-photo="${sess.photoOut || sess.photoIn}_t" alt="">
          <div class="hl">${isLift ? (n >= 4 ? 'Four for four. Week secured.' : `${4 - n} more to lock the week.`) : 'Bonus round. Extra chaos, banked.'}</div>
        </div>
      </div></div>
    <button class="btn g bank" data-act="closeReveal" id="bankBtn">BANK IT ▸</button>`;
  hydrate(r);
  r.classList.remove('flipped'); r.classList.add('show');
  setTimeout(() => { r.classList.add('flipped'); buzz(30); }, 450);
}

// rest day
function openRestSheet() {
  const k = todayKey(), r = S.rest[k] || {}, st = stepsOn(k);
  openSheet(`<h2>REST <span style="color:var(--green)">/ WALK</span></h2>
    <p class="sub">Rest days (Wed, Sat, Sun) earn <b style="color:var(--green)">½ day credit</b> when you hit ${fmtNum(STEP_MIN)}+ steps or log a walk. The 4/4 lift streak doesn't change. This fills the bonus meter.</p>
    <div class="tile" style="margin:10px 0"><span class="mini">Steps today</span><div style="font-family:var(--cond);font-weight:800;font-size:30px;color:${st >= STEP_MIN ? 'var(--green)' : 'var(--blue-hi)'}">${fmtNum(st)} ${st >= STEP_MIN ? '✓' : `<small style="font-size:14px;color:var(--muted)">/ ${fmtNum(STEP_MIN)} min</small>`}</div></div>
    <label class="field"><span>Walk minutes (optional)</span><input class="txt" type="number" inputmode="numeric" min="0" max="600" id="walkMin" value="${r.walkMin || ''}" placeholder="e.g. 30"></label>
    <button class="btn g full" data-act="saveRest" id="saveRest">LOG IT</button>`);
}
function saveRest() {
  const k = todayKey(), m = Math.max(0, Math.min(600, parseInt($('#walkMin').value, 10) || 0));
  S.rest[k] = { walkMin: m, t: Date.now() }; save(); closeSheet();
  const cr = restCredit(k);
  buzz(cr ? [40, 30, 80] : 30);
  toast(cr ? '½ rest credit banked' : `Logged. Hit ${fmtNum(STEP_MIN)} steps or add a walk for the credit`);
  renderAll();
}

// ---------------------------------------------------------------- weekly summary
function summaryHTML(ws, nav) {
  const s = weekSummary(ws), streak = workoutStreak();
  const v = (x, f) => x == null ? '—' : f(x);
  const sunday = +s.ws === +weekStart(new Date()) && new Date().getDay() === 0;
  return `<div class="card-x summary">
    <div class="sum-head"><div><h3>${sunday ? 'SUNDAY ' : ''}WEEKLY CHECK-IN</h3>
      <small>${fmtShort(s.ws).toUpperCase()} – ${fmtShort(addDays(s.ws, 6)).toUpperCase()}</small></div>
      ${nav ? `<div class="wknav"><button data-act="weekPrev" aria-label="Previous week">‹</button><button data-act="weekNext" aria-label="Next week" ${ui.weekOff >= 0 ? 'disabled' : ''}>›</button></div>` : ''}</div>
    <div class="sum-grid">
      <div class="stat"><b>${s.liftCount}/${WEEK_TARGET}</b><small>LIFTS</small><em>${streak} wk streak</em></div>
      <div class="stat"><b>${fmtDur(s.totalMs)}</b><small>TRAINING</small><em>${s.all.length} session${s.all.length === 1 ? '' : 's'}</em></div>
      <div class="stat g"><b>${s.restCredits.toFixed(1)}</b><small>REST CREDIT</small><em>of ${s.restMax.toFixed(1)} bonus</em></div>
      <div class="stat"><b>${v(s.avgSteps, fmtNum)}</b><small>AVG STEPS</small><em>${s.stepDays} day${s.stepDays === 1 ? '' : 's'} synced</em></div>
      <div class="stat p"><b>${v(s.avgCal, fmtNum)}</b><small>AVG CAL</small><em>goal ${CAL[0]}–${CAL[1]}</em></div>
      <div class="stat p"><b>${v(s.avgPro, x => fmtNum(x) + 'g')}</b><small>AVG PROTEIN</small><em>goal ${PRO[0]}–${PRO[1]}g</em></div>
    </div>
    ${s.skills.length ? `<div class="mini" style="margin-bottom:4px">SKILLS THIS WEEK</div><div class="sum-skills">${s.skills.map(k => `<span class="${k.target && k.count >= k.target ? 'hit' : ''}">${esc(k.emoji || '◆')} ${esc(k.name)} ${k.count}${k.target ? '/' + k.target : ''}</span>`).join('')}</div>` : ''}
    <div class="thumbs">${s.photos.length ? s.photos.map(p => `<img data-photo="${p}_t" alt="">`).join('') : '<div class="empty">No check-in photos this week yet.</div>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn g" data-act="shareImage" data-ws="${+s.ws}" >▣ SHARE IMAGE</button><button class="btn b" data-act="shareText" data-ws="${+s.ws}" >✎ SHARE TEXT</button></div>
  </div>`;
}
function summaryText(ws) {
  const s = weekSummary(ws), streak = workoutStreak(), pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const L = [];
  L.push('CHAOS & CONTROL: WEEKLY CHECK-IN');
  L.push(`Breckyn · week of ${fmtShort(s.ws)} – ${fmtShort(addDays(s.ws, 6))}, ${addDays(s.ws, 6).getFullYear()}`);
  L.push('');
  L.push(`Lifts: ${s.liftCount}/${WEEK_TARGET}${s.liftCount >= WEEK_TARGET ? ' ✅' : ''}${s.lifts.length ? ' (' + s.lifts.map(x => `${x.type} ${fmtDay(x.start)}`).join(', ') + ')' : ''}`);
  const others = s.all.filter(x => !LIFT(x)); if (others.length) L.push(`Extra sessions: ${others.length} (other/cardio)`);
  L.push(`Training time: ${fmtDur(s.totalMs)} across ${pl(s.all.length, 'session')}`);
  L.push(`4/4 streak: ${pl(streak, 'week')}`);
  L.push(`Rest-day credit: ${s.restCredits.toFixed(1)} / ${s.restMax.toFixed(1)}`);
  L.push(`Avg steps: ${s.avgSteps == null ? 'no data' : fmtNum(s.avgSteps) + '/day'} (${pl(s.stepDays, 'day')} synced; goal 10,000, min 8,000)`);
  L.push(`Avg calories: ${s.avgCal == null ? 'not logged' : fmtNum(s.avgCal)} (target 2,250–2,450; ${pl(s.foodDays, 'day')} logged)`);
  L.push(`Avg protein: ${s.avgPro == null ? 'not logged' : fmtNum(s.avgPro) + ' g'} (target 160–185 g)`);
  if (s.skills.length) L.push(`Skills: ${s.skills.map(k => `${k.name} ${k.count}${k.target ? '/' + k.target : ''}`).join(' · ')}`);
  L.push(`Check-in photos: ${s.photos.length}`);
  const notes = s.all.filter(x => x.note).map(x => `- ${x.type}: ${x.note}`); if (notes.length) { L.push(''); L.push('Notes:'); L.push(...notes); }
  L.push(''); L.push('Photo check-in only. No location tracking.');
  return L.join('\n');
}
async function summaryImage(ws) {
  const s = weekSummary(ws), streak = workoutStreak();
  try { await document.fonts.load('800 60px "Barlow Condensed"'); await document.fonts.load('700 30px "Barlow Condensed"'); await document.fonts.load('600 24px "Barlow Condensed"'); } catch (e) {}
  const F = (w, z) => `${w} ${z}px "Barlow Condensed","Arial Narrow",sans-serif`;
  const W = 1080, c = document.createElement('canvas'); let x = c.getContext('2d');
  // measure skill rows first so the canvas is tall enough for skills + photos + footer
  x.font = F(700, 30); let rows = 1, mx = 60;
  s.skills.forEach(k => { const w = x.measureText(`${k.name.toUpperCase()} ${k.count}${k.target ? '/' + k.target : ''}`).width + 32; if (mx + w > W - 60) { rows++; mx = 60; } mx += w + 12; });
  const H = 1250 + (s.skills.length ? 52 + (rows - 1) * 54 + 34 : 0) + (s.photos.length ? 150 + 30 : 0) + 160;
  c.width = W; c.height = H; x = c.getContext('2d');
  x.fillStyle = '#0B0B12'; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, 520); g.addColorStop(0, '#5B2A86'); g.addColorStop(1, '#2A1340');
  x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 380); x.lineTo(0, 560); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,.07)';
  for (let yy = 0; yy < 560; yy += 14) for (let xx = (yy / 14 % 2) * 7; xx < W; xx += 14) { x.beginPath(); x.arc(xx, yy, 2, 0, 7); x.fill(); }
  x.strokeStyle = '#7CFF3A'; x.lineWidth = 10; x.beginPath(); x.moveTo(0, 584); x.lineTo(W, 404); x.stroke();
  x.fillStyle = '#1E90FF';
  for (let i = 0; i < 4; i++) { const ox = 760 + i * 70; x.beginPath(); x.moveTo(ox, 60); x.lineTo(ox + 30, 60); x.lineTo(ox + 70, 120); x.lineTo(ox + 30, 180); x.lineTo(ox, 180); x.lineTo(ox + 40, 120); x.closePath(); x.globalAlpha = .35 + i * .2; x.fill(); }
  x.globalAlpha = 1;
  x.fillStyle = '#F3EEFA'; x.font = F(800, 120); x.fillText('WEEKLY', 60, 170); x.fillText('CHECK-IN', 60, 290);
  x.fillStyle = '#7CFF3A'; x.font = F(800, 44);
  x.fillText(`BRECKYN · ${fmtShort(s.ws).toUpperCase()} – ${fmtShort(addDays(s.ws, 6)).toUpperCase()}, ${addDays(s.ws, 6).getFullYear()}`, 60, 360);
  const cx = 230, cy = 650, r = 140;
  x.lineWidth = 34; x.strokeStyle = '#2a2240'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  if (s.liftCount) { x.strokeStyle = '#1E90FF'; x.shadowColor = '#1E90FF'; x.shadowBlur = 30; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, s.liftCount / 4)); x.stroke(); x.shadowBlur = 0; }
  x.fillStyle = '#F3EEFA'; x.textAlign = 'center'; x.font = F(800, 120); x.fillText(`${s.liftCount}/4`, cx, cy + 40);
  x.font = F(700, 30); x.fillStyle = '#6CB8FF'; x.fillText('LIFTS', cx, cy + 82); x.textAlign = 'left';
  x.fillStyle = '#F3EEFA'; x.font = F(800, 80); x.fillText(s.liftCount >= 4 ? 'WEEK LOCKED.' : `${4 - s.liftCount} TO GO.`, 430, 620);
  x.fillStyle = '#7CFF3A'; x.font = F(800, 46); x.fillText(`${streak} WEEK 4/4 STREAK`, 430, 680);
  x.fillStyle = '#a79bbd'; x.font = F(700, 34); x.fillText(s.lifts.map(l => ABBR[l.type]).join(' · ') || 'NO LIFTS YET', 430, 730);
  const tiles = [
    ['TRAINING', fmtDur(s.totalMs), `${s.all.length} sessions`, '#1E90FF'],
    ['REST CREDIT', `${s.restCredits.toFixed(1)} / ${s.restMax.toFixed(1)}`, 'bonus meter', '#7CFF3A'],
    ['AVG STEPS', s.avgSteps == null ? '—' : fmtNum(s.avgSteps), `${s.stepDays} days synced`, '#1E90FF'],
    ['AVG CALORIES', s.avgCal == null ? '—' : fmtNum(s.avgCal), 'target 2,250–2,450', '#8A4FC4'],
    ['AVG PROTEIN', s.avgPro == null ? '—' : fmtNum(s.avgPro) + ' g', 'target 160–185 g', '#8A4FC4'],
    ['PHOTOS', String(s.photos.length), 'check-in proof', '#7CFF3A']
  ];
  tiles.forEach((t, i) => {
    const tx = 60 + (i % 3) * 330, ty = 840 + Math.floor(i / 3) * 190;
    x.fillStyle = '#14111f'; x.fillRect(tx, ty, 300, 165); x.fillStyle = t[3]; x.fillRect(tx, ty, 8, 165);
    x.fillStyle = '#a79bbd'; x.font = F(700, 28); x.fillText(t[0], tx + 28, ty + 44);
    x.fillStyle = '#F3EEFA'; x.font = F(800, 62); x.fillText(t[1], tx + 28, ty + 108);
    x.fillStyle = '#a79bbd'; x.font = F(600, 24); x.fillText(t[2], tx + 28, ty + 145);
  });
  let y = 1250;
  if (s.skills.length) {
    x.fillStyle = '#7CFF3A'; x.font = F(800, 34); x.fillText('SKILLS THIS WEEK', 60, y); y += 52;
    x.font = F(700, 30); let sx = 60;
    s.skills.forEach(k => {
      const label = `${k.name.toUpperCase()} ${k.count}${k.target ? '/' + k.target : ''}`, w = x.measureText(label).width + 32;
      if (sx + w > W - 60) { sx = 60; y += 54; }
      const hit = k.target && k.count >= k.target;
      x.fillStyle = hit ? '#7CFF3A' : '#2A1340'; x.fillRect(sx, y - 33, w, 44);
      x.fillStyle = hit ? '#0B0B12' : '#F3EEFA'; x.fillText(label, sx + 16, y); sx += w + 12;
    });
    y += 34;
  }
  const ph = s.photos.slice(0, 6), tw = 150;
  for (let i = 0; i < ph.length; i++) {
    try {
      const b = await idb.get(ph[i] + '_t'); if (!b) continue;
      const img = await loadImage(b), tx = 60 + i * (tw + 16), ty = y;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      x.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, tx, ty, tw, tw);
      x.strokeStyle = i % 2 ? '#1E90FF' : '#7CFF3A'; x.lineWidth = 6; x.strokeRect(tx, ty, tw, tw);
    } catch (e) {}
  }
  x.fillStyle = '#5B2A86'; x.beginPath(); x.moveTo(0, H - 90); x.lineTo(W, H - 130); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
  x.fillStyle = '#F3EEFA'; x.font = F(800, 34); x.fillText('CHAOS & CONTROL', 60, H - 34);
  x.textAlign = 'right'; x.fillStyle = '#7CFF3A'; x.font = F(700, 26); x.fillText('PHOTO CHECK-IN ONLY · NO LOCATION TRACKING', W - 60, H - 36);
  return new Promise(res => c.toBlob(res, 'image/png'));
}
async function shareImage(ws) {
  toast('Building your card…');
  const blob = await summaryImage(ws), name = `chaos-control-week-${dateKey(ws)}.png`;
  const file = new File([blob], name, { type: 'image/png' }), url = URL.createObjectURL(blob);
  hideToast();
  openSheet(`<h2>WEEK <span style="color:var(--green)">CARD</span></h2><p class="sub">Send it to Axel. On iPhone you can also long-press the image to save it.</p>
    <img class="preview" id="sumImg" src="${url}" alt="Weekly summary image">
    <div class="row"><button class="btn g" data-act="doShareFile">SHARE</button><a class="btn b" href="${url}" download="${name}" id="dlSum">DOWNLOAD</a></div>`);
  shareImage._file = file;
}
async function shareText(ws) {
  const text = summaryText(ws);
  if (navigator.share) { try { await navigator.share({ title: 'Weekly check-in', text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Summary copied. Paste it to your coach'); }
  catch (e) { openSheet(`<h2>WEEK TEXT</h2><p class="sub">Select all and copy.</p><textarea class="txt" rows="14" readonly id="sumText">${esc(text)}</textarea>`); }
}

// ---------------------------------------------------------------- STEPS
function parseSteps(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Math.round(parseFloat(String(raw).replace(/,/g, '').replace(/[^\d.]/g, '')));
  return Number.isFinite(n) && n >= 0 && n <= 200000 ? n : null;
}
function normDate(raw) {
  if (!raw) return null; raw = String(raw).trim();
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : dateKey(d); }
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return dateKey(new Date(y, +m[1] - 1, +m[2])); }
  const d = new Date(raw); return isNaN(d) ? null : dateKey(d);
}
function saveSteps(n, k, src) { S.steps[k] = { n, t: Date.now(), src }; save(); }
function ingestStepsFromURL() {
  const sp = new URLSearchParams(location.search), hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  const raw = sp.has('steps') ? sp.get('steps') : hp.get('steps');
  if (raw == null) return false;
  const n = parseSteps(raw), k = normDate(sp.get('date') || hp.get('date')) || todayKey();
  history.replaceState(null, '', location.pathname); // clean the URL either way
  if (n == null) { toast('Steps link had no valid number'); return false; }
  saveSteps(n, k, 'shortcut');
  ui.stepsDay = k; ui.tab = 'steps';
  buzz(30);
  setTimeout(() => toast(`${fmtNum(n)} steps synced · ${fmtDay(keyToDate(k))}`), 50);
  return true;
}
async function pasteSteps() {
  try {
    const t = await navigator.clipboard.readText();
    const n = parseSteps((t.match(/steps\D{0,3}([\d.,]+)/i) || [])[1] ?? (t.match(/\d[\d.,]*/) || [])[0]);
    const k = normDate((t.match(/\d{4}-\d{2}-\d{2}/) || [])[0]) || todayKey();
    if (n == null) { toast('No step count on the clipboard'); return; }
    saveSteps(n, k, 'clipboard'); ui.stepsDay = k; toast(`${fmtNum(n)} steps saved · ${fmtDay(keyToDate(k))}`); renderAll();
  } catch (e) { toast('Clipboard blocked. Allow paste and try again'); }
}
function renderSteps() {
  const v = $('#view-steps'), k = ui.stepsDay, n = stepsOn(k), rec = S.steps[k];
  const days = [...Array(7)].map((_, i) => dateKey(addDays(new Date(), i - 6)));
  const vals = days.map(stepsOn), max = Math.max(12000, ...vals) * 1.05;
  const have = days.filter(d => S.steps[d]);
  const avg7 = have.length ? have.reduce((a, d) => a + stepsOn(d), 0) / have.length : null;
  const sum = weekSummary(new Date());
  const badge = n >= STEP_GOAL ? '<span class="badge goal">GOAL HIT ✓</span>' : n >= STEP_MIN ? '<span class="badge min">MINIMUM HIT ✓</span>' : `<span class="badge">${fmtNum(STEP_MIN - n)} TO MINIMUM</span>`;
  const last = Object.values(S.steps).reduce((m, r) => Math.max(m, r.t || 0), 0);
  const srcName = { shortcut: 'synced by Shortcut', clipboard: 'pasted from Shortcut', manual: 'fixed by hand' };
  v.innerHTML = `
    <h2 class="section-title"><svg width="26" height="26" class="chev"><use href="#s-chev"/></svg>STEPS</h2>
    <p class="sub">Goal ${fmtNum(STEP_GOAL)} · minimum ${fmtNum(STEP_MIN)} (green tick). Synced from your iPhone Shortcut.</p>
    <div class="steps-hero">${ring(n, STEP_GOAL, { size: 250, stroke: 22, marker: STEP_MIN })}
      <div class="center"><div class="mini">${k === todayKey() ? 'TODAY' : fmtDay(keyToDate(k)).toUpperCase()}</div><div class="num" id="stepsNum">${fmtNum(n)}</div><div class="of">/ ${fmtNum(STEP_GOAL)}</div>${badge}</div></div>
    <div class="label">LAST 7 DAYS <span class="blue">TAP A BAR</span></div>
    <div class="bars">
      <div class="ln goal" style="bottom:${STEP_GOAL / max * 100}%"><span>10K</span></div>
      <div class="ln min" style="bottom:${STEP_MIN / max * 100}%"><span>8K</span></div>
      ${days.map((d, i) => { const x = vals[i]; const cls = !S.steps[d] ? '' : x >= STEP_GOAL ? 'goal' : x >= STEP_MIN ? 'min' : 'has';
        return `<button class="bcol ${d === k ? 'sel' : ''}" data-act="stepsDay" data-day="${d}"><span class="v">${S.steps[d] ? (x / 1000).toFixed(1) + 'k' : ''}</span><span class="b ${cls}" style="height:${Math.max(2, x / max * 100)}%"></span><small>${'SMTWTFS'[keyToDate(d).getDay()]}</small></button>`; }).join('')}
    </div>
    <div class="kv">
      <div class="tile"><div class="mini">7-day average</div><div id="avg7" style="font-family:var(--cond);font-weight:800;font-size:32px;color:var(--blue)">${avg7 == null ? '—' : fmtNum(avg7)}</div><div class="mini">${have.length} of 7 days synced</div></div>
      <div class="tile"><div class="mini">This week avg</div><div style="font-family:var(--cond);font-weight:800;font-size:32px;color:var(--blue)">${sum.avgSteps == null ? '—' : fmtNum(sum.avgSteps)}</div><div class="mini">rest credit ${sum.restCredits.toFixed(1)}</div></div>
    </div>
    <p class="sub" style="margin-top:10px">${rec ? `This day: ${srcName[rec.src] || 'saved'} ${fmtTime(rec.t)}, ${fmtShort(rec.t)}.` : 'No steps saved for this day yet.'} ${last ? `Last sync ${ago(last)}.` : ''}</p>
    <button class="btn b full" data-act="pasteSteps">⇩ PASTE STEPS FROM SHORTCUT</button>
    <details class="fold"><summary>How auto-sync works</summary>
      <p>A web app can't read Apple Health, so a Shortcut does it: <b>Find Health Samples</b> (Steps, today, summed), then <b>Open URL</b> to this app with <code>?steps=8432&amp;date=2026-10-05</code>. The app saves it, shows a toast, and cleans the link. A Personal Automation runs it every night around 9 PM. Full setup is in <code>STEPS-SHORTCUT.md</code>.</p>
      <p>Your link: <code>${esc(location.origin + location.pathname)}?steps=[Sum]&amp;date=[yyyy-MM-dd]</code></p>
    </details>`;
}

// ---------------------------------------------------------------- FUEL
function meterHTML(val, [lo, hi], cls, unit, label) {
  const max = hi * 1.25, st = val < lo ? `${fmtNum(lo - val)}${unit} to target` : val <= hi ? 'In the zone ✓' : `${fmtNum(val - hi)}${unit} over`;
  return `<div class="meter"><div class="top"><b>${fmtNum(val)}<small>${unit} ${label}</small></b><span>TARGET ${fmtNum(lo)}–${fmtNum(hi)}${unit}</span></div>
    <div class="mbar"><div class="fill ${val > hi && cls === 'cal' ? 'over' : cls}" style="width:${Math.min(100, val / max * 100)}%"></div><div class="zone" style="left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%"></div></div>
    <div class="status ${val >= lo && val <= hi ? 'ok' : val > hi && cls === 'cal' ? 'hi' : ''}">${st}</div></div>`;
}
function renderFuel() {
  const v = $('#view-fuel'), k = ui.foodDay, list = S.food[k] || [], t = foodTotals(k);
  const sum = weekSummary(keyToDate(k)), isToday = k === todayKey();
  v.innerHTML = `
    <h2 class="section-title"><svg width="26" height="26" style="color:var(--green)"><use href="#s-diamond"/></svg>FUEL</h2>
    <div class="daynav"><button data-act="foodPrev" aria-label="Previous day">‹</button><b>${isToday ? 'TODAY' : fmtDay(keyToDate(k)).toUpperCase()}</b><button data-act="foodNext" aria-label="Next day" ${isToday ? 'disabled style="opacity:.3"' : ''}>›</button></div>
    ${meterHTML(t.cal, CAL, 'cal', '', 'CAL')}
    ${meterHTML(t.pro, PRO, 'pro', 'g', 'PROTEIN')}
    <div class="label">FAVORITES · ONE TAP <button data-act="favEdit" style="color:var(--blue);font-family:var(--cond);font-weight:800;letter-spacing:.1em">${ui.favEdit ? 'DONE' : 'EDIT'}</button></div>
    <div class="favs">${S.favorites.map(f => `<button class="fav" data-act="${ui.favEdit ? 'favDel' : 'favAdd'}" data-id="${f.id}"><b>${esc(f.name)}</b><small>${f.cal} cal · ${f.protein}g</small>${ui.favEdit ? '<span class="x">×</span>' : ''}</button>`).join('') || '<div class="empty">No favorites yet. Tick "save as favorite" below.</div>'}</div>
    <div class="label">QUICK ADD</div>
    <form id="qadd" autocomplete="off">
      <div class="qadd"><input class="txt" name="name" placeholder="Food" required maxlength="40"><input class="txt" name="cal" type="number" inputmode="numeric" placeholder="Cal" min="0" max="5000" required><input class="txt" name="pro" type="number" inputmode="decimal" placeholder="Prot g" min="0" max="400" step="any"></div>
      <label class="chk"><input type="checkbox" name="fav"> Save as favorite</label>
      <button class="btn g full" type="submit">+ ADD TO ${isToday ? 'TODAY' : fmtShort(keyToDate(k)).toUpperCase()}</button>
    </form>
    <div class="label">LOGGED <span>${list.length} item${list.length === 1 ? '' : 's'}</span></div>
    <div class="list">${list.slice().reverse().map(e => `<div class="li"><div class="grow"><b>${esc(e.name)}</b><small>${fmtTime(e.t)} · ${e.cal} cal · ${e.protein}g protein</small></div><button class="del" data-act="foodDel" data-id="${e.id}" aria-label="Remove">×</button></div>`).join('') || '<div class="empty">Nothing logged yet.</div>'}</div>
    <div class="label">WEEK AVERAGE <span class="blue">${fmtShort(sum.ws).toUpperCase()} – ${fmtShort(addDays(sum.ws, 6)).toUpperCase()}</span></div>
    <div class="kv">
      <div class="tile"><div class="mini">Avg calories</div><div id="avgCal" style="font-family:var(--cond);font-weight:800;font-size:32px;color:var(--purple-hi)">${sum.avgCal == null ? '—' : fmtNum(sum.avgCal)}</div><div class="mini">${sum.foodDays} day${sum.foodDays === 1 ? '' : 's'} logged</div></div>
      <div class="tile"><div class="mini">Avg protein</div><div id="avgPro" style="font-family:var(--cond);font-weight:800;font-size:32px;color:var(--blue)">${sum.avgPro == null ? '—' : fmtNum(sum.avgPro) + 'g'}</div><div class="mini">target ${PRO[0]}–${PRO[1]}g</div></div>
    </div>`;
  $('#qadd').addEventListener('submit', e => {
    e.preventDefault(); const f = new FormData(e.target);
    const name = String(f.get('name')).trim(), cal = Math.round(+f.get('cal') || 0), protein = Math.round((+f.get('pro') || 0) * 10) / 10;
    if (!name) return;
    addFood(name, cal, protein);
    if (f.get('fav') && !S.favorites.some(x => x.name.toLowerCase() === name.toLowerCase())) { S.favorites.push({ id: uid(), name, cal, protein }); save(); }
    renderFuel();
  });
}
function addFood(name, cal, protein) {
  const k = ui.foodDay, e = { id: uid(), name, cal, protein, t: k === todayKey() ? Date.now() : keyToDate(k).setHours(12) };
  (S.food[k] = S.food[k] || []).push(e); save(); buzz(15);
  toast(`+ ${name} · ${cal} cal`, 'UNDO', () => { S.food[k] = (S.food[k] || []).filter(x => x.id !== e.id); save(); renderFuel(); });
}

// ---------------------------------------------------------------- SKILLS
function renderSkills() {
  const v = $('#view-skills'), ws = weekStart(new Date());
  v.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
      <div><h2 class="section-title"><svg width="26" height="26" style="color:var(--purple-hi)"><use href="#s-wild"/></svg>SKILLS</h2>
      <p class="sub" style="margin:0">Small reps outside the gym. Tap + LOG when you do one.</p></div>
      <button class="btn p" data-act="newSkill" id="newSkillBtn" style="font-size:15px;padding:10px 14px">+ NEW</button></div>
    <div class="sk-grid" style="margin-top:14px">${S.skills.map((sk, i) => {
      const n = skillWeekCount(sk.id, ws), t = sk.target, st = skillStreak(sk), last = skillLast(sk.id);
      return `<article class="skcard c-${SKILL_COLORS[i % 3]}" id="sk-${sk.id}">
        <div class="sk-top"><span class="sk-emoji">${esc(sk.emoji || '◆')}</span><button class="sk-more" data-act="skillMenu" data-id="${sk.id}" aria-label="Options for ${esc(sk.name)}">⋯</button></div>
        <div class="sk-name">${esc(sk.name)}</div>
        <div class="sk-count"><b>${n}</b>${t ? ` / ${t}` : ''} THIS WEEK</div>
        <div class="pips">${t ? [...Array(t)].map((_, j) => `<i class="${j < n ? 'on' : ''}"></i>`).join('') : ''}</div>
        <div class="sk-meta"><span>🔥 ${st} wk streak${t ? '' : ' (1+/wk)'}</span><span>Last: ${ago(last)}</span></div>
        <button class="sk-log" data-act="logSkill" data-id="${sk.id}">+ LOG</button>
      </article>`; }).join('') || '<div class="empty">No skills yet. Add one with + NEW.</div>'}</div>`;
}
function logSkill(id) {
  const sk = S.skills.find(s => s.id === id); if (!sk) return;
  const log = { id: uid(), skillId: id, t: Date.now(), min: null, note: '' };
  S.skillLogs.push(log); save(); buzz(25); renderSkills();
  const card = $('#sk-' + id); if (card) { card.classList.remove('popped'); void card.offsetWidth; card.classList.add('popped'); }
  toast(`${sk.emoji || ''} ${sk.name} logged`, 'ADD DETAILS', () => openSheet(`<h2>${esc(sk.emoji || '')} ${esc(sk.name)}</h2><p class="sub">Optional details for ${fmtTime(log.t)}</p>
    <label class="field"><span>Minutes</span><input class="txt" type="number" inputmode="numeric" id="lgMin" min="0" max="600" placeholder="e.g. 20"></label>
    <label class="field"><span>Short note</span><input class="txt" id="lgNote" maxlength="80" placeholder="What did you do?"></label>
    <button class="btn g full" data-act="saveLogDetail" data-id="${log.id}">SAVE</button>`));
}
function skillSheet(sk) {
  const isNew = !sk; sk = sk || { name: '', emoji: '', target: 3 };
  const logs = isNew ? [] : S.skillLogs.filter(l => l.skillId === sk.id).sort((a, b) => b.t - a.t).slice(0, 8);
  openSheet(`<h2>${isNew ? 'NEW SKILL' : 'EDIT SKILL'}</h2>
    <label class="field"><span>Name</span><input class="txt" id="skName" maxlength="28" value="${esc(sk.name)}" placeholder="e.g. Guitar"></label>
    <div class="field"><span>Emoji / icon (optional)</span><input class="txt" id="skEmoji" maxlength="4" value="${esc(sk.emoji)}" placeholder="Tap or type" style="width:140px">
      <div class="emoji-picks">${EMOJI_PICKS.map(e => `<button data-act="pickEmoji" data-e="${e}" class="${e === sk.emoji ? 'sel' : ''}">${e}</button>`).join('')}</div></div>
    <div class="field"><span>Weekly target (optional)</span><div class="seg" id="skTarget">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<button data-act="pickTarget" data-n="${n}" class="${(sk.target || 0) === n ? 'sel' : ''}">${n ? n + 'x' : 'NONE'}</button>`).join('')}</div></div>
    <button class="btn g full" data-act="saveSkill" data-id="${isNew ? '' : sk.id}" id="saveSkillBtn" style="margin-top:8px">${isNew ? 'ADD SKILL' : 'SAVE'}</button>
    ${isNew ? '' : `<div class="label">RECENT LOGS</div><div class="list">${logs.map(l => `<div class="li"><div class="grow"><b>${fmtDay(l.t)} · ${fmtTime(l.t)}</b><small>${l.min ? l.min + ' min' : ''}${l.min && l.note ? ' · ' : ''}${esc(l.note || '')}${!l.min && !l.note ? 'Quick log' : ''}</small></div><button class="del" data-act="delSkillLog" data-id="${l.id}" data-sk="${sk.id}">×</button></div>`).join('') || '<div class="empty">No logs yet.</div>'}</div>
      <button class="btn o full" data-act="delSkill" data-id="${sk.id}" style="margin-top:14px;color:var(--danger)">DELETE SKILL</button>`}`);
  skillSheet._target = sk.target || 0;
}

// ---------------------------------------------------------------- LOG (history + stats)
function renderLog() {
  const v = $('#view-log'), ws = addDays(weekStart(new Date()), ui.weekOff * 7);
  const totalMs = S.sessions.reduce((a, s) => a + (s.end - s.start), 0);
  const list = S.sessions.slice().sort((a, b) => b.start - a.start);
  const cur = weekSummary(new Date());
  v.innerHTML = `
    <h2 class="section-title"><svg width="26" height="26" class="chev"><use href="#s-chev"/></svg>THE LOG</h2>
    <div class="statgrid" style="margin-top:10px">
      <div class="tile ring-tile">${ring(cur.liftCount, WEEK_TARGET, { size: 70, stroke: 9 })}<div><div class="big">${cur.liftCount}/4</div><div class="mini">this week</div></div></div>
      <div class="tile streak-tile"><div class="big" id="streakNum">${workoutStreak()}<span> WK</span></div><div class="mini">4/4 streak</div></div>
      <div class="tile"><div class="mini">Total trained</div><div id="totalHrs" style="font-family:var(--cond);font-weight:800;font-size:34px;color:var(--blue)">${(totalMs / 36e5).toFixed(1)}<small style="font-size:18px"> HRS</small></div></div>
      <div class="tile"><div class="mini">Sessions logged</div><div style="font-family:var(--cond);font-weight:800;font-size:34px;color:var(--green)">${S.sessions.length}</div></div>
    </div>
    ${summaryHTML(ws, true)}
    <div class="label">HISTORY <span>${list.length} sessions</span></div>
    <div class="hist">${list.map(s => `<button class="hrow ${LIFT(s) ? '' : 'other'}" data-act="sessDetail" data-id="${s.id}">
      <div class="ths"><img data-photo="${s.photoIn}_t" alt="">${s.photoOut ? `<img data-photo="${s.photoOut}_t" alt="">` : ''}</div>
      <div class="grow"><b>${esc(s.type)}</b><small>${fmtDay(s.start)} · ${fmtTime(s.start)}–${fmtTime(s.end)}</small><small>${esc(s.gym)}</small></div>
      <div class="dur">${fmtDur(s.end - s.start)}</div></button>`).join('') || '<div class="empty">No sessions yet. Clock in to start the log.</div>'}</div>
    <div class="label">EXPORT</div>
    <div class="export">
      <button class="btn b" data-act="exportCSV" id="csvBtn">⇩ SESSIONS CSV</button>
      <button class="btn p" data-act="exportJSON" id="jsonBtn">⇩ FULL JSON</button>
    </div>
    <label class="chk"><input type="checkbox" id="expPhotos"> Include photos in JSON backup (bigger file)</label>`;
  hydrate(v);
}
function sessDetail(id) {
  const s = S.sessions.find(x => x.id === id); if (!s) return;
  openSheet(`<h2>${esc(s.type)}</h2><p class="sub">${fmtDay(s.start)} · ${fmtTime(s.start)}–${fmtTime(s.end)} · <b style="color:var(--blue-hi)">${fmtDur(s.end - s.start)}</b><br>${esc(s.gym)}</p>
    ${s.note ? `<p style="font-size:14px">“${esc(s.note)}”</p>` : ''}
    <img class="preview" data-photo="${s.photoIn}" alt="Check-in photo">${s.photoOut ? `<img class="preview" data-photo="${s.photoOut}" alt="Finish photo">` : ''}
    <button class="btn o full" data-act="delSess" data-id="${s.id}" style="color:var(--danger);margin-top:6px">DELETE SESSION</button>`);
  hydrate($('#sheetBody'));
}
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['id', 'date', 'weekday', 'session_type', 'counts_toward_4', 'gym', 'start_local', 'end_local', 'start_iso', 'end_iso', 'duration_min', 'photo_in', 'photo_out', 'note']];
  const loc = t => new Date(t).toLocaleString('en-US');
  S.sessions.slice().sort((a, b) => a.start - b.start).forEach(s => rows.push([s.id, dateKey(s.start), new Date(s.start).toLocaleDateString('en-US', { weekday: 'short' }), s.type, LIFT(s) ? 'yes' : 'no', s.gym,
    loc(s.start), loc(s.end), new Date(s.start).toISOString(), new Date(s.end).toISOString(), Math.round((s.end - s.start) / 60000), s.photoIn ? 'yes' : 'no', s.photoOut ? 'yes' : 'no', s.note || '']));
  download(`chaos-control-sessions-${todayKey()}.csv`, rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
  toast('Sessions CSV downloaded');
}
async function exportJSON() {
  const withPhotos = $('#expPhotos') && $('#expPhotos').checked;
  const out = { app: 'chaos-control-checkin', version: 1, exported: new Date().toISOString(), note: 'Photo check-in only. No location data is collected.', ...S,
    skillSummary: S.skills.map(sk => ({ name: sk.name, emoji: sk.emoji, target: sk.target, thisWeek: skillWeekCount(sk.id, weekStart(new Date())), streakWeeks: skillStreak(sk), totalLogs: S.skillLogs.filter(l => l.skillId === sk.id).length, lastPracticed: skillLast(sk.id) ? new Date(skillLast(sk.id)).toISOString() : null })) };
  if (withPhotos) {
    toast('Packing photos…'); out.photos = {};
    for (const id of await idb.keys()) { const b = await idb.get(id); out.photos[id] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
  }
  download(`chaos-control-backup-${todayKey()}.json`, JSON.stringify(out, null, 1), 'application/json');
  toast('Backup downloaded');
}
async function importJSON(file) {
  try {
    const d = JSON.parse(await file.text()); if (d.app !== 'chaos-control-checkin') throw new Error('not a backup');
    if (!confirm('Replace everything on this phone with this backup?')) return;
    if (d.photos) for (const [id, url] of Object.entries(d.photos)) { const b = await (await fetch(url)).blob(); await idb.put(id, b); }
    const f = freshState(); ['sessions', 'active', 'steps', 'food', 'rest', 'favorites', 'skills', 'skillLogs', 'settings'].forEach(k => { if (k in d) f[k] = d[k]; });
    S = f; save(); urlCache.clear(); renderAll(); toast('Backup restored');
  } catch (e) { toast('That file is not a C&C backup'); }
}

// ---------------------------------------------------------------- MORE
function renderMore() {
  const v = $('#view-more');
  v.innerHTML = `
    <h2 class="section-title"><svg width="26" height="26" style="color:var(--green)"><use href="#s-club"/></svg>MORE</h2>
    ${isStandalone() ? `<div class="tile" style="border-color:var(--green)"><b class="cond" style="font-size:20px;color:var(--green)">INSTALLED ✓</b><div class="sub" style="margin:2px 0 0">Running from your home screen.</div></div>`
      : `<button class="btn g full" data-act="install" id="installBig" style="font-size:22px;padding:16px">⇩ ADD TO HOME SCREEN</button>`}
    <div class="label">SETTINGS</div>
    <details class="fold" id="fixFold"><summary>Fix steps (manual override)</summary>
      <p class="sub">Only if the Shortcut missed a day.</p>
      <div class="qadd" style="grid-template-columns:1fr 1fr"><input class="txt" type="date" id="fixDate" value="${todayKey()}" max="${todayKey()}"><input class="txt" type="number" inputmode="numeric" id="fixSteps" placeholder="Steps" min="0" max="200000"></div>
      <button class="btn b full" data-act="fixSteps" style="margin-top:8px">SAVE STEPS</button>
    </details>
    <details class="fold"><summary>Restore a backup</summary><p class="sub">Load a JSON backup exported from the LOG tab.</p><input type="file" accept="application/json,.json" id="importFile"></details>
    <details class="fold"><summary>Danger zone</summary><p class="sub">Wipes every session, photo, step, food and skill on this phone.</p><button class="btn o full" data-act="wipe" style="color:var(--danger)">ERASE ALL DATA</button></details>
    <div class="label">ABOUT</div>
    <div class="about">
      <div class="nogeo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7CFF3A" stroke-width="2.4"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z"/><path d="M3 3l18 18"/></svg>No location tracking. Photo check-in only.</div>
      <p><b class="cond" style="font-size:18px">CHAOS &amp; CONTROL</b> is Breckyn's check-in for the 4-day upper/lower cut: <b>Mon Upper A · Tue Lower A · Thu Upper B · Fri Lower B</b>. Wed, Sat and Sun are rest days.</p>
      <p>Clock in with a photo of the rack or equipment. The photo gets stamped with the date, time and session, then saved on this phone. Lifts count toward the weekly 4/4, and Other/Cardio counts as a bonus. Rest days with ${fmtNum(STEP_MIN)}+ steps or a walk earn ½ credit on the bonus meter.</p>
      <p><b>Your data lives only on this phone</b> (localStorage + IndexedDB). There's no server and no account. Export a backup from the LOG tab every so often.</p>
      <p class="sub" id="storageInfo">Checking storage…</p>
      <p class="sub">Font: Barlow Condensed (SIL Open Font License). All graphics are original. v1.0</p>
    </div>`;
  $('#importFile').addEventListener('change', e => e.target.files[0] && importJSON(e.target.files[0]));
  (async () => {
    try {
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const per = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      $('#storageInfo').textContent = `Storage: ${est ? (est.usage / 1048576).toFixed(1) + ' MB used' : 'n/a'} · ${per ? 'persistent ✓' : 'best-effort (install to home screen to protect it)'} · ${S.sessions.length} sessions`;
    } catch (e) { const si = $('#storageInfo'); if (si) si.textContent = ''; }
  })();
}

// ---------------------------------------------------------------- install (Add to Home Screen)
let deferredPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; updateInstallUI(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('Installed. Find C&C on your home screen'); updateInstallUI(); });
try { matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallUI); } catch (e) {}
function updateInstallUI() {
  const sa = isStandalone();
  $('#installBtn').hidden = sa;
  document.documentElement.classList.toggle('standalone', sa);
  if (ui.tab === 'more' && $('#view-more').innerHTML) renderMore();
}
async function onInstall() {
  if (deferredPrompt) {
    const p = deferredPrompt; deferredPrompt = null;
    try { await p.prompt(); const c = await p.userChoice; if (c && c.outcome === 'accepted') toast('Installing…'); } catch (e) { console.warn(e); }
    return;
  }
  const shareIcon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E90FF" stroke-width="2"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 10H5v11h14V10h-2"/></svg>';
  const plusIcon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7CFF3A" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  if (isIOS()) {
    openSheet(`<h2>ADD TO <span style="color:var(--green)">HOME SCREEN</span></h2>
      <p class="sub">iPhone doesn't have an install button for web apps, so it takes three taps in Safari:</p>
      <ol class="steps-ios" id="iosSteps">
        <li>${shareIcon}<span>Tap the <b>Share</b> button in Safari's toolbar (the square with the arrow).</span></li>
        <li>${plusIcon}<span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
        <li><svg width="28" height="28" viewBox="0 0 64 64"><rect x="10" y="8" width="44" height="48" rx="8" fill="#5B2A86" stroke="#7CFF3A" stroke-width="4"/><path d="M28 22h7l9 10-9 10h-7l9-10Z" fill="#1E90FF"/></svg><span>Keep <b>Open as Web App</b> on, then tap <b>Add</b>. Launch C&amp;C from the new icon.</span></li>
      </ol>
      <p class="sub" style="font-size:12px">On iPhone the home-screen app keeps its own storage, separate from Safari. Install first, then clock in from the icon.</p>
      <div class="arrow-hint">SHARE BUTTON IS DOWN THERE <svg width="16" height="16" viewBox="0 0 24 24" fill="#1E90FF"><path d="M12 22 3 11h6V2h6v9h6z"/></svg></div>
      <button class="btn o full" data-act="closeSheet" style="margin-top:12px">GOT IT</button>`);
  } else {
    openSheet(`<h2>ADD TO <span style="color:var(--green)">HOME SCREEN</span></h2>
      <p class="sub">This browser didn't offer a one-tap install here. You can add it by hand:</p>
      <ol class="steps-ios" id="genericSteps"><li><span>Open the browser menu (<b>⋮</b> in Chrome, or the share button).</span></li><li>${plusIcon}<span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li><li><span>Open C&amp;C from your home screen.</span></li></ol>
      <button class="btn o full" data-act="closeSheet">GOT IT</button>`);
  }
}

// ---------------------------------------------------------------- sheet / toast
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open'); }
let toastT;
function toast(msg, action, fn) {
  const t = $('#toast'), b = $('#toastBtn');
  $('#toastMsg').textContent = msg;
  b.hidden = !action; b.textContent = action || ''; b.onclick = () => { hideToast(); fn && fn(); };
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(hideToast, action ? 5000 : 2800);
}
function hideToast() { $('#toast').classList.remove('show'); }

// ---------------------------------------------------------------- routing / actions
const RENDER = { clock: renderClock, steps: renderSteps, fuel: renderFuel, skills: renderSkills, log: renderLog, more: renderMore };
function showTab(tab) {
  ui.tab = tab;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  RENDER[tab](); window.scrollTo(0, 0);
  $('#liveDot').hidden = !S.active;
}
function renderAll() { RENDER[ui.tab](); $('#liveDot').hidden = !S.active; }

const ACT = {
  tab: el => showTab(el.dataset.tab),
  pickType: el => { ui.type = el.dataset.type; buzz(10); renderClock(); },
  pickGym: el => { S.settings.gym = el.dataset.gym; save(); renderClock(); if (S.settings.gym === 'Other') $('#gymOther').focus(); },
  clockIn: () => {
    if (S.settings.gym === 'Other' && !S.settings.gymOther.trim()) { toast('Type the gym name first'); const g = $('#gymOther'); if (g) g.focus(); return; }
    choosePhoto('in');
  },
  retakeIn: () => choosePhoto('in'),
  confirmIn: confirmClockIn,
  clockOut: () => openClockOut(false),
  photoOut: () => choosePhoto('out'),
  confirmOut: confirmClockOut,
  discard: discardActive,
  closeSheet,
  closeReveal: () => { $('#reveal').classList.remove('show', 'flipped'); renderAll(); },
  restLog: openRestSheet, saveRest,
  weekPrev: () => { ui.weekOff--; renderLog(); },
  weekNext: () => { ui.weekOff = Math.min(0, ui.weekOff + 1); renderLog(); },
  shareImage: el => shareImage(new Date(+el.dataset.ws)),
  shareText: el => shareText(new Date(+el.dataset.ws)),
  doShareFile: async () => {
    const f = shareImage._file;
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Weekly check-in', text: 'My week: Chaos & Control' }); } catch (e) {} }
    else $('#dlSum').click();
  },
  stepsDay: el => { ui.stepsDay = el.dataset.day; renderSteps(); },
  pasteSteps,
  fixSteps: () => {
    const k = normDate($('#fixDate').value), n = parseSteps($('#fixSteps').value);
    if (!k || n == null) { toast('Enter a date and a step count'); return; }
    saveSteps(n, k, 'manual'); toast(`Steps fixed: ${fmtNum(n)} on ${fmtShort(keyToDate(k))}`);
  },
  foodPrev: () => { ui.foodDay = dateKey(addDays(keyToDate(ui.foodDay), -1)); renderFuel(); },
  foodNext: () => { if (ui.foodDay < todayKey()) { ui.foodDay = dateKey(addDays(keyToDate(ui.foodDay), 1)); renderFuel(); } },
  favAdd: el => { const f = S.favorites.find(x => x.id === el.dataset.id); if (f) { addFood(f.name, f.cal, f.protein); renderFuel(); } },
  favDel: el => { S.favorites = S.favorites.filter(x => x.id !== el.dataset.id); save(); renderFuel(); },
  favEdit: () => { ui.favEdit = !ui.favEdit; renderFuel(); },
  foodDel: el => { S.food[ui.foodDay] = (S.food[ui.foodDay] || []).filter(x => x.id !== el.dataset.id); save(); renderFuel(); },
  newSkill: () => skillSheet(null),
  skillMenu: el => skillSheet(S.skills.find(s => s.id === el.dataset.id)),
  logSkill: el => logSkill(el.dataset.id),
  pickEmoji: el => { $('#skEmoji').value = el.dataset.e; $$('.emoji-picks button').forEach(b => b.classList.toggle('sel', b === el)); },
  pickTarget: el => { skillSheet._target = +el.dataset.n; $$('#skTarget button').forEach(b => b.classList.toggle('sel', b === el)); },
  saveSkill: el => {
    const name = $('#skName').value.trim(); if (!name) { toast('Give the skill a name'); return; }
    const emoji = $('#skEmoji').value.trim(), target = skillSheet._target || null;
    if (el.dataset.id) Object.assign(S.skills.find(s => s.id === el.dataset.id), { name, emoji, target });
    else S.skills.push({ id: uid(), name, emoji, target, created: Date.now() });
    save(); closeSheet(); renderSkills(); toast(el.dataset.id ? 'Skill updated' : `${name} added`);
  },
  delSkill: el => {
    const sk = S.skills.find(s => s.id === el.dataset.id); if (!sk || !confirm(`Delete ${sk.name} and its logs?`)) return;
    S.skills = S.skills.filter(s => s.id !== sk.id); S.skillLogs = S.skillLogs.filter(l => l.skillId !== sk.id); save(); closeSheet(); renderSkills();
  },
  delSkillLog: el => { S.skillLogs = S.skillLogs.filter(l => l.id !== el.dataset.id); save(); skillSheet(S.skills.find(s => s.id === el.dataset.sk)); renderSkills(); },
  saveLogDetail: el => {
    const l = S.skillLogs.find(x => x.id === el.dataset.id);
    if (l) { l.min = parseInt($('#lgMin').value, 10) || null; l.note = $('#lgNote').value.trim(); save(); }
    closeSheet(); renderSkills(); toast('Details saved');
  },
  sessDetail: el => sessDetail(el.dataset.id),
  delSess: async el => {
    const s = S.sessions.find(x => x.id === el.dataset.id); if (!s || !confirm('Delete this session and its photos?')) return;
    await deletePhotos(s.photoIn, s.photoOut); S.sessions = S.sessions.filter(x => x.id !== s.id); save(); closeSheet(); renderAll();
  },
  exportCSV, exportJSON,
  install: onInstall,
  wipe: async () => {
    if (!confirm('Erase ALL data on this phone? This cannot be undone.') || !confirm('Really erase everything?')) return;
    try { for (const k of await idb.keys()) await idb.del(k); } catch (e) {}
    localStorage.removeItem(LS_KEY); S = freshState(); save(); urlCache.clear(); showTab('clock'); toast('Fresh start');
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName !== 'A') e.preventDefault();
  fn(el, e);
});
document.addEventListener('input', e => { if (e.target.id === 'gymOther') { S.settings.gymOther = e.target.value; save(); } });
document.addEventListener('visibilitychange', () => {
  // coming back to the app (e.g. after the camera or another app): re-read storage and redraw
  if (!document.hidden && !$('#sheet').classList.contains('open')) { S = load(); renderAll(); }
});
// Shortcut link opened while the app is already showing (same page, only the #hash changes)
window.addEventListener('hashchange', () => { if (ingestStepsFromURL()) showTab('steps'); });
window.addEventListener('storage', e => { if (e.key === LS_KEY) { S = load(); renderAll(); } });

// ---------------------------------------------------------------- boot
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW failed', e)));
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
ingestStepsFromURL();
updateInstallUI();
showTab(ui.tab);

// small hook for local QA (headless tests read state through this)
window.CC = {
  get state() { return S; }, idb, weekSummary, workoutStreak, skillStreak, scheduledType, summaryText, restCredit, isStandalone, isIOS,
  reload() { S = load(); renderAll(); }
};
})();
