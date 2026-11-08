// Защита входа: PIN из 4 или 6 цифр, пароль, графический ключ + отпечаток пальца / лицо.
// Всё хранится только на телефоне: вместо самого кода — его «отпечаток» (PBKDF2-SHA-256 с солью),
// подобрать код по нему нельзя. Забыли код — «Выйти из аккаунта»: защита снимается, вход заново
// университетским логином и паролем (данные приложения и так лишь копия с сайта).
const LOCK_KEY = 'lock:secret', LOCK_FAILS = 'lock:fails';
const LOCK_TYPES = ['none', 'pin4', 'pin6', 'password', 'pattern'];
const lockCfg = () => (settings.lock ??= { type: 'none', bio: false, delay: 60 });
const lockOn = () => lockCfg().type !== 'none' && !!localStorage.getItem(LOCK_KEY);
const bioApi = () => window.Backend?.biometric;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derive(secret, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120000 }, key, 256);
  return hex(bits);
}
async function saveSecret(type, secret) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(LOCK_KEY, JSON.stringify({ type, salt, hash: await derive(secret, salt) }));
  localStorage.removeItem(LOCK_FAILS);
}
async function checkSecret(secret) {
  const s = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); if (!s) return true;
  const h = await derive(secret, s.salt);
  // сравнение без раннего выхода
  let d = h.length ^ s.hash.length; for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ s.hash.charCodeAt(i);
  return d === 0;
}
// после 5 ошибок — пауза 30 с, потом каждая следующая ошибка удваивает паузу (до 15 мин)
const failsGet = () => { try { return JSON.parse(localStorage.getItem(LOCK_FAILS)) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } };
function failAdd() {
  const f = failsGet(); f.n++;
  if (f.n >= 5) f.until = Date.now() + Math.min(900, 30 * 2 ** (f.n - 5)) * 1000;
  localStorage.setItem(LOCK_FAILS, JSON.stringify(f)); return f;
}

const LOCK_ICONS = {
  lock: '<svg class="ic" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle class="d" cx="12" cy="15.5" r="1.6"/></svg>',
  finger: '<svg class="ic" viewBox="0 0 24 24"><path d="M7.5 5.2A8 8 0 0 1 20 12v1.5M4 9.5A8 8 0 0 0 4 12v3M12 8a4 4 0 0 1 4 4v2.5a8 8 0 0 1-1.2 4.2M8 12a4 4 0 0 1 .4-1.8M8 15v-3M12 12v3.5a8 8 0 0 1-2.3 5.5M5.5 18.5A10 10 0 0 0 8 15"/></svg>',
  face: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a3.5 3.5 0 0 0 5 0"/></svg>',
  del: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>',
  eye: '<svg class="ic" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
};

// ---------- экран ввода ----------
// mode: 'unlock' — вход в приложение; 'verify' — подтвердить текущий код (смена/отключение);
// 'create' — придумать новый (два раза). Возвращает Promise: true / введённый новый код / false (отмена).
let lockShown = null;
function lockScreen({ mode = 'unlock', type = lockCfg().type, title } = {}) {
  return new Promise((resolve) => {
    lockShown?.remove();
    const ov = document.createElement('div');
    ov.className = 'lockscr'; ov.dataset.type = type;
    const len = type === 'pin6' ? 6 : type === 'pin4' ? 4 : 0;
    const canBio = mode === 'unlock' && lockCfg().bio && !!bioApi();
    let entry = '', first = null, busy = false;
    const heading = () => title || (mode === 'create' ? (first === null ? t('lk_new_' + type) : t('lk_repeat')) : mode === 'verify' ? t('lk_current') : t('lk_enter_' + type));
    ov.innerHTML = `<div class="lk-in">
      <div class="lk-logo">${LOCK_ICONS.lock}</div>
      <h2 class="lk-title"></h2>
      <div class="lk-msg"></div>
      <div class="lk-body"></div>
      <div class="lk-foot">
        ${mode === 'unlock' ? `<button class="lk-link" data-lk="forgot">${t('lk_forgot')}</button>` : `<button class="lk-link" data-lk="cancel">${t('cancel')}</button>`}
      </div></div>`;
    document.body.appendChild(ov); lockShown = ov;
    const $ = (s) => ov.querySelector(s), body = $('.lk-body'), msg = $('.lk-msg');
    const setMsg = (text, bad) => { msg.textContent = text || ''; msg.classList.toggle('bad', !!bad); };
    $('.lk-title').textContent = heading();
    const close = (val) => {
      ov.classList.add('closing'); lockShown = null;
      setTimeout(() => ov.remove(), 200 * (MOTION[settings.motion] ?? 1));
      resolve(val);
    };
    const shake = () => { ov.querySelector('.lk-shake')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }); haptic('error'); };
    // пауза после множества ошибок
    let tick = null;
    const waitLeft = () => Math.ceil((failsGet().until - Date.now()) / 1000);
    function blocked() {
      if (mode === 'create' || waitLeft() <= 0) return false;
      ov.classList.add('wait');
      const upd = () => { const s = waitLeft(); if (s <= 0) { clearInterval(tick); tick = null; ov.classList.remove('wait'); setMsg(''); return; } setMsg(t('lk_wait').replace('{s}', s), true); };
      upd(); if (!tick) tick = setInterval(upd, 500);
      return true;
    }
    // проверка введённого
    async function submit(value) {
      if (busy) return; busy = true;
      try {
        if (mode === 'create') {
          if (type === 'pattern' && value.length < 4) { setMsg(t('lk_pattern_short'), true); shake(); return reset(true); }
          if (type === 'password' && value.length < 4) { setMsg(t('lk_pass_short'), true); shake(); return reset(true); }
          if (first === null) { first = value; $('.lk-title').textContent = heading(); setMsg(''); haptic('toggle'); return reset(); }
          if (value !== first) { first = null; $('.lk-title').textContent = heading(); setMsg(t('lk_mismatch'), true); shake(); return reset(true); }
          haptic('success'); return close(value);
        }
        if (blocked()) return reset(true);
        if (await checkSecret(value)) { localStorage.removeItem(LOCK_FAILS); haptic('success'); return close(true); }
        const f = failAdd(); shake();
        if (!blocked()) setMsg(f.n >= 3 ? t('lk_wrong_n').replace('{n}', 5 - f.n) : t('lk_wrong'), true);
        reset(true);
      } finally { busy = false; }
    }
    let reset = () => {};
    // ---- PIN ----
    if (len) {
      body.innerHTML = `<div class="lk-dots lk-shake">${'<i></i>'.repeat(len)}</div>
        <div class="lk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}<small>${['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'][n - 1]}</small></button>`).join('')}
          ${canBio ? `<button class="lk-k" data-lk="bio">${LOCK_ICONS.finger}</button>` : '<span></span>'}<button data-n="0">0</button><button class="lk-k" data-lk="del">${LOCK_ICONS.del}</button></div>`;
      const dots = [...body.querySelectorAll('.lk-dots i')];
      const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < entry.length));
      reset = (bad) => { entry = ''; const dd = body.querySelector('.lk-dots'); if (bad) dd.classList.add('bad'); setTimeout(() => { show(); dd.classList.remove('bad'); }, bad ? 450 : 180); };
      body.onclick = (e) => {
        const b = e.target.closest('[data-n]'); if (!b || busy || ov.classList.contains('wait')) return;
        if (entry.length >= len) return;
        entry += b.dataset.n; show(); haptic('select');
        b.animate([{ background: 'var(--lk-press)' }, { background: 'transparent' }], { duration: 260 });
        if (entry.length === len) setTimeout(() => submit(entry), 90);
      };
      ov.onkeydown = (e) => {
        if (/^\d$/.test(e.key)) body.querySelector(`[data-n="${e.key}"]`)?.click();
        if (e.key === 'Backspace') ov.querySelector('[data-lk="del"]')?.click();
      };
      ov.tabIndex = -1; setTimeout(() => ov.focus(), 50);
    }
    // ---- пароль ----
    if (type === 'password') {
      body.innerHTML = `<div class="lk-pass lk-shake"><input type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('lk_password')}"><button class="lk-k" data-lk="eye">${LOCK_ICONS.eye}</button></div>
        <button class="btn wide lk-go" data-lk="go">${mode === 'create' ? t('lk_next') : t('lk_unlock')}</button>
        ${canBio ? `<button class="lk-bio" data-lk="bio">${LOCK_ICONS.finger}<span>${t('lk_bio_btn')}</span></button>` : ''}`;
      const inp = body.querySelector('input');
      reset = () => { inp.value = ''; inp.focus(); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') submit(inp.value); };
      setTimeout(() => { if (!canBio) inp.focus(); }, 250);
    }
    // ---- графический ключ ----
    if (type === 'pattern') {
      body.innerHTML = `<div class="lk-pat lk-shake"><svg viewBox="0 0 300 300"><polyline class="lk-line" points=""/><line class="lk-tail" x1="0" y1="0" x2="0" y2="0"/>
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<g class="lk-pt" data-i="${i}"><circle class="halo" cx="${50 + (i % 3) * 100}" cy="${50 + Math.floor(i / 3) * 100}" r="26"/><circle class="dot" cx="${50 + (i % 3) * 100}" cy="${50 + Math.floor(i / 3) * 100}" r="9"/></g>`).join('')}
        </svg></div>
        ${canBio ? `<button class="lk-bio" data-lk="bio">${LOCK_ICONS.finger}<span>${t('lk_bio_btn')}</span></button>` : ''}`;
      const svg = body.querySelector('svg'), line = body.querySelector('.lk-line'), tail = body.querySelector('.lk-tail');
      let seq = [], drawing = false;
      const pts = [...body.querySelectorAll('.lk-pt')];
      const pos = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
      const loc = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * 300 / r.width, (e.clientY - r.top) * 300 / r.height]; };
      const paint = () => { line.setAttribute('points', seq.map((i) => pos(i).join(',')).join(' ')); pts.forEach((p, i) => p.classList.toggle('on', seq.includes(i))); };
      const add = (i) => {
        if (seq.includes(i)) return;
        // перескок через точку посередине (1→3) отмечает и её, как в Android
        const l = seq[seq.length - 1];
        if (l !== undefined) { const ca = l % 3, ra = (l / 3) | 0, cb = i % 3, rb = (i / 3) | 0; if ((ca + cb) % 2 === 0 && (ra + rb) % 2 === 0) { const m = ((ra + rb) / 2) * 3 + (ca + cb) / 2; if (!seq.includes(m)) seq.push(m); } }
        seq.push(i); haptic('select');
        pts[i].querySelector('.halo').animate([{ r: 14 }, { r: 30 }, { r: 26 }], { duration: 260, easing: 'ease-out' });
        paint();
      };
      const hit = ([x, y]) => pts.findIndex((_, i) => { const [px, py] = pos(i); return Math.hypot(px - x, py - y) < 34; });
      reset = (bad) => { const pat = body.querySelector('.lk-pat'); if (bad) pat.classList.add('bad'); setTimeout(() => { seq = []; paint(); pat.classList.remove('bad'); }, bad ? 500 : 220); };
      svg.onpointerdown = (e) => {
        if (busy || ov.classList.contains('wait')) return;
        svg.setPointerCapture(e.pointerId); drawing = true; seq = []; setMsg('');
        const i = hit(loc(e)); if (i >= 0) add(i);
      };
      svg.onpointermove = (e) => {
        if (!drawing) return;
        const p = loc(e), i = hit(p); if (i >= 0) add(i);
        const l = seq[seq.length - 1];
        if (l !== undefined) { const [x1, y1] = pos(l); tail.setAttribute('x1', x1); tail.setAttribute('y1', y1); tail.setAttribute('x2', p[0]); tail.setAttribute('y2', p[1]); }
      };
      svg.onpointerup = svg.onpointercancel = () => {
        if (!drawing) return; drawing = false;
        tail.setAttribute('x2', tail.getAttribute('x1')); tail.setAttribute('y2', tail.getAttribute('y1'));
        if (!seq.length) return;
        submit(seq.join(''));
      };
    }
    // ---- кнопки ----
    ov.onclick = async (e) => {
      const b = e.target.closest('[data-lk]'); if (!b) return;
      const a = b.dataset.lk;
      if (a === 'del') { entry = entry.slice(0, -1); body.querySelectorAll('.lk-dots i').forEach((d, i) => d.classList.toggle('on', i < entry.length)); haptic('select'); }
      if (a === 'go') submit(body.querySelector('input').value);
      if (a === 'eye') { const i = body.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; b.classList.toggle('on'); i.focus(); }
      if (a === 'bio') bio();
      if (a === 'cancel') close(false);
      if (a === 'forgot') {
        // единственный способ сбросить код: выйти из аккаунта университета
        if (!confirm(t('lk_forgot_q'))) return;
        localStorage.removeItem(LOCK_KEY); localStorage.removeItem(LOCK_FAILS);
        lockCfg().type = 'none'; lockCfg().bio = false; saveSettings();
        bioApi()?.secure(false);
        try { await api('/api/logout', { method: 'POST' }); } catch { /* без сети — всё равно выходим */ }
        clearCache(); Object.keys(localStorage).filter((k) => k.startsWith('pc:')).forEach((k) => localStorage.removeItem(k));
        close(true); loginView();
      }
    };
    async function bio() {
      if (blocked()) return;
      try {
        await bioApi().authenticate({ title: t('lk_bio_title'), subtitle: t('lk_bio_sub'), cancel: t('lk_use_code') });
        localStorage.removeItem(LOCK_FAILS); haptic('success'); close(true);
      } catch { /* отмена или «ввести код» — остаётся обычный ввод */ }
    }
    blocked();
    if (canBio && !ov.classList.contains('wait')) setTimeout(bio, 350); // сразу предложить отпечаток/лицо
  });
}

// ---------- когда запирать ----------
let lockHiddenAt = 0, lockBusy = false;
async function lockNow() {
  if (!lockOn() || lockBusy) return;
  lockBusy = true;
  try { await lockScreen({ mode: 'unlock' }); } finally { lockBusy = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!lockBusy) lockHiddenAt = Date.now(); return; }
  const d = lockCfg().delay;
  if (lockHiddenAt && d >= 0 && Date.now() - lockHiddenAt >= d * 1000) lockNow();
});
// при запуске (вызывается из index.html, когда настройки уже прочитаны)
function lockInit() { if (lockOn()) { bioApi()?.secure(true); lockNow(); } }

// ---------- раздел «Защита» в настройках ----------
function lockSettingsHtml() {
  const c = lockCfg(), on = lockOn(), type = on ? c.type : 'none';
  const tile = (k, ico) => `<button class="lk-type${type === k ? ' on' : ''}" data-lktype="${k}"><span>${ico}</span>${t('lk_t_' + k)}</button>`;
  return `<div class="sec">${t('lk_sec')}</div>
    <div class="card">
      <div class="mute" style="margin-bottom:10px">${t('lk_sub')}</div>
      <div class="lk-types">
        ${tile('none', '<svg class="ic" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5"/></svg>')}
        ${tile('pin4', '<b>••••</b>')}
        ${tile('pin6', '<b>••••••</b>')}
        ${tile('password', '<b>Aa*</b>')}
        ${tile('pattern', '<svg class="ic" viewBox="0 0 24 24"><path d="M5 5l7 7 7-7M12 12v7"/><circle class="d" cx="5" cy="5" r="2"/><circle class="d" cx="12" cy="12" r="2"/><circle class="d" cx="19" cy="5" r="2"/><circle class="d" cx="12" cy="19" r="2"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="19" cy="19" r="1"/><circle cx="12" cy="5" r="1"/></svg>')}
      </div>
      ${on ? `
      <div class="opt"><span class="prev"><span class="lic"><span class="ict" style="--tc:#16a34a">${LOCK_ICONS.finger}</span></span><span>${t('lk_bio')}<div class="mute" id="lk-bio-sub">${bioApi() ? t('lk_bio_sub2') : t('lk_bio_na')}</div></span></span>
        <label class="sw"><input type="checkbox" id="lk-bio" ${c.bio ? 'checked' : ''} ${bioApi() ? '' : 'disabled'}><i></i></label></div>
      <div class="opt col"><span>${t('lk_delay')}<div class="mute">${t('lk_delay_sub')}</div></span>
        <div class="mini-seg">${[[0, t('lk_d_now')], [30, '30 ' + t('lk_sec_s')], [60, '1 ' + t('lk_min')], [300, '5 ' + t('lk_min')], [-1, t('lk_d_start')]].map(([v, l]) => `<button data-lkdelay="${v}" class="${c.delay === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="opt"><span>${t('lk_change')}</span><button class="btn ghost" id="lk-change">${t('lk_change_btn')}</button></div>` : ''}
    </div>`;
}
function lockSettingsBind(m, rerender) {
  const c = lockCfg();
  m.querySelectorAll('[data-lktype]').forEach((b) => (b.onclick = async () => {
    const want = b.dataset.lktype, cur = lockOn() ? c.type : 'none';
    if (want === cur) return;
    haptic('toggle');
    // сначала — текущий код (если он есть), потом новый
    if (cur !== 'none' && !(await lockScreen({ mode: 'verify', type: cur }))) return;
    if (want === 'none') {
      localStorage.removeItem(LOCK_KEY); c.type = 'none'; c.bio = false; saveSettings(); bioApi()?.secure(false);
      toast(t('lk_off_done')); return rerender();
    }
    const secret = await lockScreen({ mode: 'create', type: want });
    if (!secret) return rerender();
    await saveSecret(want, secret);
    c.type = want; saveSettings(); bioApi()?.secure(true);
    toast(t('lk_on_done')); rerender();
    // сразу предложить вход по отпечатку, если телефон умеет
    if (bioApi() && !c.bio) { const a = await bioApi().available(); if (a.available) { const s = m.isConnected && m.querySelector('#lk-bio'); s?.closest('.opt')?.animate([{ background: 'var(--acc-soft)' }, { background: 'transparent' }], { duration: 1200 }); } }
  }));
  const bs = m.querySelector('#lk-bio');
  if (bs) bs.onchange = async () => {
    if (!bs.checked) { c.bio = false; saveSettings(); haptic('toggle'); return; }
    const a = await bioApi().available();
    if (!a.available) { bs.checked = false; toast(a.hardware === false ? t('lk_bio_nohw') : t('lk_bio_noenroll')); return; }
    try {
      await bioApi().authenticate({ title: t('lk_bio_title'), subtitle: t('lk_bio_confirm'), cancel: t('cancel') });
      c.bio = true; saveSettings(); haptic('success');
    } catch { bs.checked = false; }
  };
  m.querySelectorAll('[data-lkdelay]').forEach((b) => (b.onclick = () => {
    c.delay = Number(b.dataset.lkdelay); saveSettings(); haptic('toggle');
    m.querySelectorAll('[data-lkdelay]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const ch = m.querySelector('#lk-change');
  if (ch) ch.onclick = async () => {
    if (!(await lockScreen({ mode: 'verify' }))) return;
    const secret = await lockScreen({ mode: 'create', type: c.type });
    if (secret) { await saveSecret(c.type, secret); toast(t('lk_changed')); }
  };
}
