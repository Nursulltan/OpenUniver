// ================= Дизайн: стили, иконки, фон, палитра =================
// Внешний вид собирается из «стиля» (готового набора) и личных правок поверх него. Всё превращается
// в CSS-переменные на <html> и несколько data-атрибутов — экраны перерисовывать не нужно, меняется сразу.

// ---------- стили (готовые наборы) ----------
// light/dark — базовые цвета; остальное — значения по умолчанию для каждой настройки (их можно переопределить).
const PRESETS = {
  classic: {
    light: { bg: '#f3f5fa', card: '#ffffff', ink: '#151a26', mute: '#6c7489', line: '#e4e8f1' },
    dark: { bg: '#0f1218', card: '#1a1f2a', ink: '#e9edf5', mute: '#8f98ac', line: '#2a3140' },
    card: 'solid', radius: 16, nav: 'floating', navind: 'pill', icons: 'duo', iconcolor: 'acc', hero: 'gradient', font: 'system', head: 'normal', shadow: 'none', btn: 10, bg: 'color',
  },
  material: { // Android «Material You»: тональные поверхности из основного цвета, капсула под иконкой меню
    light: { bg: 'color-mix(in srgb, var(--acc) 5%, #fefbff)', card: 'color-mix(in srgb, var(--acc) 10%, #fefbff)', ink: '#1c1b1f', mute: '#49454f', line: 'color-mix(in srgb, var(--acc) 18%, #fefbff)' },
    dark: { bg: 'color-mix(in srgb, var(--acc) 6%, #141218)', card: 'color-mix(in srgb, var(--acc) 12%, #1d1b20)', ink: '#e6e1e5', mute: '#cac4d0', line: 'color-mix(in srgb, var(--acc) 20%, #1d1b20)' },
    card: 'solid', radius: 24, nav: 'docked', navind: 'capsule', icons: 'line', iconcolor: 'mono', hero: 'tonal', font: 'system', head: 'large', shadow: 'none', btn: 99, bg: 'color',
  },
  glass: { // «жидкое стекло»: полупрозрачные размытые карточки над ярким фоном
    light: { bg: '#e9eefb', card: '#ffffff', ink: '#0f1422', mute: '#4a5368', line: 'rgba(255,255,255,.55)' },
    dark: { bg: '#05070d', card: '#1b2233', ink: '#f2f5fb', mute: '#a6b0c4', line: 'rgba(255,255,255,.12)' },
    card: 'glass', alpha: 45, blur: 22, radius: 26, nav: 'floating', navind: 'pill', icons: 'duo', iconcolor: 'acc', hero: 'glass', font: 'system', head: 'large', shadow: 'soft', btn: 14, bg: 'mesh',
  },
  ios: { // как системные приложения iPhone: сгруппированные списки, крупные заголовки
    light: { bg: '#f2f2f7', card: '#ffffff', ink: '#000000', mute: '#8a8a8e', line: '#e5e5ea' },
    dark: { bg: '#000000', card: '#1c1c1e', ink: '#ffffff', mute: '#8d8d93', line: '#38383a' },
    card: 'solid', radius: 12, nav: 'docked', navind: 'none', icons: 'fill', iconcolor: 'multi', hero: 'gradient', font: 'system', head: 'large', shadow: 'none', btn: 10, bg: 'color',
  },
  neumorph: { // «мягкий» объём: карточки выдавлены из фона светом и тенью
    light: { bg: '#e4e8ef', card: '#e4e8ef', ink: '#2d3340', mute: '#7b8394', line: '#d3d8e1' },
    dark: { bg: '#262a31', card: '#262a31', ink: '#e3e7ee', mute: '#8d95a5', line: '#323740' },
    card: 'soft', radius: 20, nav: 'floating', navind: 'pill', icons: 'line', iconcolor: 'acc', hero: 'tonal', font: 'system', head: 'normal', shadow: 'none', btn: 14, bg: 'color',
  },
  minimal: { // строго: белый, тонкие линии, ничего лишнего
    light: { bg: '#ffffff', card: '#ffffff', ink: '#111111', mute: '#6b6b6b', line: '#e8e8e8' },
    dark: { bg: '#111214', card: '#111214', ink: '#ededed', mute: '#8a8a8a', line: '#2a2b2e' },
    card: 'outline', radius: 10, nav: 'minimal', navind: 'dot', icons: 'line', iconcolor: 'mono', iconw: 1.5, hero: 'outline', font: 'system', head: 'normal', shadow: 'none', btn: 8, bg: 'color',
  },
  amoled: { // чистый чёрный: экран почти не светится, бережёт батарею
    dark: { bg: '#000000', card: '#0b0b0c', ink: '#f5f5f5', mute: '#8a8a8a', line: '#1e1e20' }, forceDark: true,
    card: 'outline', radius: 18, nav: 'docked', navind: 'line', icons: 'line', iconcolor: 'acc', hero: 'outline', font: 'system', head: 'large', shadow: 'none', btn: 12, bg: 'color',
  },
  paper: { // тёплая бумага и заголовки с засечками
    light: { bg: '#f4efe6', card: '#fffaf1', ink: '#2b2620', mute: '#8a7f70', line: '#e7dfd1' },
    dark: { bg: '#1d1a16', card: '#27231d', ink: '#efe7da', mute: '#a39784', line: '#3a342b' },
    card: 'elevated', radius: 8, nav: 'docked', navind: 'line', icons: 'line', iconcolor: 'acc', hero: 'solid', font: 'serif', head: 'large', shadow: 'soft', btn: 6, bg: 'color',
  },
  neon: { // ночной неон: тёмный фон, светящиеся рамки
    dark: { bg: '#07040f', card: '#160e2c', ink: '#f4f0ff', mute: '#a99cc9', line: '#2a1f4a' }, forceDark: true,
    card: 'neon', alpha: 70, blur: 12, radius: 18, nav: 'floating', navind: 'pill', icons: 'duo', iconcolor: 'multi', hero: 'mesh', font: 'system', head: 'large', shadow: 'none', btn: 12, bg: 'mesh',
  },
  brutal: { // необрутализм: жирные чёрные рамки и сдвинутые тени
    light: { bg: 'color-mix(in srgb, var(--acc) 14%, #fffdf5)', card: '#ffffff', ink: '#0a0a0a', mute: '#3d3d3d', line: '#0a0a0a' },
    dark: { bg: '#141414', card: '#1f1f1f', ink: '#fafafa', mute: '#bdbdbd', line: '#fafafa' },
    card: 'brutal', radius: 6, nav: 'floating', navind: 'pill', icons: 'fill', iconcolor: 'multi', hero: 'solid', font: 'condensed', head: 'large', shadow: 'none', btn: 6, bg: 'color',
  },
  candy: { // пастель: мягкие градиенты, большие скругления, цветные плитки
    light: { bg: '#fbf4ff', card: '#ffffff', ink: '#2a2140', mute: '#857aa0', line: '#efe6f7' },
    dark: { bg: '#17131f', card: '#221c2e', ink: '#f3eefc', mute: '#a69cbd', line: '#33294a' },
    card: 'elevated', radius: 28, nav: 'floating', navind: 'capsule', icons: 'tiles', iconcolor: 'multi', hero: 'mesh', font: 'system', head: 'large', shadow: 'soft', btn: 99, bg: 'pastel',
  },
};
const PRESET_ORDER = ['classic', 'material', 'glass', 'ios', 'neumorph', 'minimal', 'amoled', 'paper', 'neon', 'brutal', 'candy'];

// личные правки поверх стиля (undefined — «как в стиле»)
const DESIGN_KEYS = ['card', 'alpha', 'blur', 'radius', 'shadow', 'nav', 'navind', 'navlabels', 'icons', 'iconcolor', 'iconw', 'hero', 'font', 'head', 'density', 'btn',
  'bg', 'bgColor', 'bgC1', 'bgC2', 'bgAngle', 'phZoom', 'phX', 'phY', 'phBlur', 'phBright', 'phSat', 'phTint', 'phTintA'];
const designOf = () => (settings.design ??= { preset: 'classic' });
// итоговое значение настройки: правка пользователя → стиль → общее значение по умолчанию
const DEF = { alpha: 100, blur: 18, navlabels: 'on', iconw: 1.8, density: 'normal', bgColor: '#e9eefb', bgC1: '#a18cd1', bgC2: '#fbc2eb', bgAngle: 160,
  phZoom: 100, phX: 50, phY: 50, phBlur: 0, phBright: 100, phSat: 100, phTint: 'none', phTintA: 30 };
function dv(key) {
  const d = designOf(), p = PRESETS[d.preset] || PRESETS.classic;
  return d[key] ?? p[key] ?? DEF[key];
}

const SHADOWS = { none: '', soft: '0 2px 12px rgba(0,0,0,.06)', strong: '0 10px 28px rgba(0,0,0,.16)' };
const FONTS = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  condensed: '"Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif',
  serif: 'Georgia, "Noto Serif", "Times New Roman", serif',
  mono: 'ui-monospace, "Roboto Mono", "Cascadia Mono", Menlo, monospace',
  casual: '"Comic Neue", casual, "Comic Sans MS", cursive',
};
let photoURL = null, photoSize = null; // обработанное фото фона (размытие/яркость уже «вшиты» в картинку)

// карточки: фон, рамка, тень, размытие
function cardVars(style, dark) {
  const a = dv('alpha'), blur = dv('blur'), sh = SHADOWS[dv('shadow')] || '';
  const solidBg = a >= 100 ? 'var(--card)' : `color-mix(in srgb, var(--card) ${a}%, transparent)`;
  const join = (...xs) => xs.filter(Boolean).join(', ') || 'none';
  switch (style) {
    case 'glass': return { bg: `color-mix(in srgb, var(--card) ${Math.min(a, 70)}%, transparent)`, border: `1px solid ${dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.6)'}`,
      shadow: join(sh, `inset 0 1px 0 rgba(255,255,255,${dark ? 0.08 : 0.7})`), filter: `blur(${blur}px) saturate(1.7)` };
    case 'outline': return { bg: solidBg, border: '1px solid var(--line)', shadow: join(sh), filter: 'none' };
    case 'elevated': return { bg: solidBg, border: '0', shadow: join(sh || SHADOWS.soft, dark ? '' : '0 1px 2px rgba(0,0,0,.04)'), filter: 'none' };
    case 'soft': return { bg: 'var(--bg)', border: '0', filter: 'none',
      shadow: dark ? '6px 6px 14px rgba(0,0,0,.5), -5px -5px 12px rgba(255,255,255,.045)' : '7px 7px 16px rgba(163,173,191,.55), -7px -7px 16px rgba(255,255,255,.95)' };
    case 'brutal': return { bg: 'var(--card)', border: '2px solid var(--ink)', shadow: '4px 4px 0 var(--ink)', filter: 'none' };
    case 'neon': return { bg: `color-mix(in srgb, var(--card) ${a}%, transparent)`, border: '1px solid color-mix(in srgb, var(--acc) 50%, transparent)',
      shadow: '0 0 18px color-mix(in srgb, var(--acc) 22%, transparent), inset 0 0 12px color-mix(in srgb, var(--acc) 8%, transparent)', filter: `blur(${blur}px)` };
    default: return { bg: solidBg, border: '0', shadow: join(sh), filter: a < 100 ? `blur(${blur}px)` : 'none' };
  }
}
// фон экранов
function pageBg(kind, dark) {
  const acc = 'var(--acc)';
  switch (kind) {
    case 'mesh': return dark
      ? `radial-gradient(at 12% 8%, color-mix(in srgb, ${acc} 55%, transparent) 0, transparent 50%), radial-gradient(at 92% 35%, color-mix(in srgb, #ff3d9a 40%, transparent) 0, transparent 45%), radial-gradient(at 25% 95%, color-mix(in srgb, #1fd1ff 35%, transparent) 0, transparent 50%), var(--bg)`
      : `radial-gradient(at 12% 8%, color-mix(in srgb, ${acc} 50%, #fff) 0, transparent 52%), radial-gradient(at 92% 32%, #ffc2e2 0, transparent 46%), radial-gradient(at 25% 95%, #a8ecff 0, transparent 52%), var(--bg)`;
    case 'pastel': return dark ? 'linear-gradient(160deg, #2a1830, #1d1a33 45%, #12233a)' : 'linear-gradient(160deg, #ffe4f1, #efe7ff 45%, #e2f3ff)';
    case 'gradient': return `linear-gradient(${dv('bgAngle')}deg, ${dv('bgC1')}, ${dv('bgC2')})`;
    case 'solid': return dv('bgColor');
    case 'photo': {
      if (!photoURL) return 'var(--bg)';
      const t = dv('phTint'), ta = dv('phTintA') / 100;
      const tint = t === 'dark' ? `rgba(0,0,0,${ta})` : t === 'light' ? `rgba(255,255,255,${ta})` : t === 'accent' ? `color-mix(in srgb, ${acc} ${Math.round(ta * 100)}%, transparent)` : '';
      return (tint ? `linear-gradient(${tint}, ${tint}), ` : '') + `url("${photoURL}")`;
    }
    default: return 'var(--bg)';
  }
}
// размер фото с учётом «масштаба»: как cover, умноженное на zoom
function photoBgSize() {
  const pg = document.querySelector('.pages') || document.getElementById('app');
  if (!photoSize || !pg) return 'cover';
  const W = pg.offsetWidth || 400, H = pg.offsetHeight || 800;
  const k = Math.max(W / photoSize.w, H / photoSize.h) * (dv('phZoom') / 100);
  return `${Math.round(photoSize.w * k)}px ${Math.round(photoSize.h * k)}px`;
}

// главная карточка: [фон, цвет текста, фон плашек]
function heroVars(name) {
  return ({
    gradient: ['linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 55%, #000))', '#fff', 'rgba(255,255,255,.17)'],
    solid: ['var(--acc)', '#fff', 'rgba(255,255,255,.18)'],
    mesh: ['radial-gradient(at 0% 0%, color-mix(in srgb, var(--acc) 60%, #fff) 0, transparent 55%), radial-gradient(at 100% 20%, color-mix(in srgb, var(--acc) 40%, #ff4fa3) 0, transparent 55%), radial-gradient(at 40% 110%, color-mix(in srgb, var(--acc) 50%, #20d0ff) 0, transparent 60%), color-mix(in srgb, var(--acc) 80%, #000)', '#fff', 'rgba(255,255,255,.18)'],
    glass: ['color-mix(in srgb, var(--acc) 58%, transparent)', '#fff', 'rgba(255,255,255,.2)'],
    tonal: ['color-mix(in srgb, var(--acc) 18%, var(--card))', 'var(--ink)', 'color-mix(in srgb, var(--acc) 14%, transparent)'],
    outline: ['var(--card-bg)', 'var(--ink)', 'var(--acc-soft)'],
  })[name] || [];
}
// применить дизайн: dark — тёмная ли сейчас тема (из настройки «Тема»)
function applyDesign(darkWanted) {
  const d = designOf(), p = PRESETS[d.preset] || PRESETS.classic;
  const dark = p.forceDark || (darkWanted && !!p.dark) || !p.light;
  const c = (dark ? p.dark : p.light) || p.dark || p.light;
  const root = document.documentElement, st = root.style;
  root.dataset.theme = dark ? 'dark' : 'light';
  const set = (k, v) => st.setProperty(k, v);
  set('--bg', c.bg); set('--card', c.card); set('--ink', c.ink); set('--mute', c.mute); set('--line', c.line);
  const cs = dv('card'), cv = cardVars(cs, dark);
  set('--card-bg', cv.bg); set('--card-border', cv.border); set('--card-shadow', cv.shadow); set('--card-filter', cv.filter);
  set('--radius', dv('radius') + 'px'); set('--btn-radius', dv('btn') + 'px');
  set('--font', FONTS[dv('font')] || FONTS.system);
  set('--font-head', dv('font') === 'serif' || d.preset === 'paper' && !d.font ? FONTS.serif : 'inherit');
  set('--icw', String(dv('iconw')));
  // фон
  const bgk = dv('bg');
  set('--page-bg', pageBg(bgk, dark));
  set('--page-bg-size', bgk === 'photo' ? photoBgSize() : 'cover');
  set('--page-bg-pos', bgk === 'photo' ? `${dv('phX')}% ${dv('phY')}%` : 'center');
  // нижнее меню: «кожа» под стиль карточек
  const skin = ['soft', 'brutal', 'neon'].includes(cs) ? cs : 'glass';
  const nav = {
    glass: { bg: dv('nav') === 'docked' ? 'color-mix(in srgb, var(--card) 82%, transparent)' : 'color-mix(in srgb, var(--card) 30%, transparent)',
      border: dark ? '1px solid rgba(255,255,255,.09)' : '1px solid rgba(255,255,255,.35)', filter: 'blur(26px) saturate(1.8) brightness(1.05)',
      shadow: dark ? '0 8px 30px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)' : '0 8px 30px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.35)' },
    soft: { bg: 'var(--bg)', border: '0', filter: 'none', shadow: cv.shadow },
    brutal: { bg: 'var(--card)', border: '2px solid var(--ink)', filter: 'none', shadow: '4px 4px 0 var(--ink)' },
    neon: { bg: 'color-mix(in srgb, var(--card) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--acc) 55%, transparent)', filter: 'blur(20px)', shadow: '0 0 22px color-mix(in srgb, var(--acc) 30%, transparent)' },
  }[skin];
  set('--nav-bg', nav.bg); set('--nav-border', nav.border); set('--nav-filter', nav.filter); set('--nav-shadow', nav.shadow);
  // главная карточка
  const hero = dv('hero');
  const HERO = heroVars(hero);
  set('--hero-bg', HERO[0]); set('--hero-ink', HERO[1]); set('--hero-stat', HERO[2]);
  // режимы, которые проще описать в CSS
  Object.assign(root.dataset, { preset: d.preset, card: cs, nav: dv('nav'), navind: dv('navind'), navlabels: dv('navlabels'), icons: dv('icons'),
    iconcolor: dv('iconcolor'), hero, head: dv('head'), density: dv('density'), bgkind: bgk });
}
function setDesign(key, value) {
  const d = designOf();
  if (value === undefined || value === null) delete d[key]; else d[key] = value;
  applySettings();
}
function setPreset(name) {
  // новый стиль: личные правки сбрасываются, кроме своего фона-фото (его жалко терять)
  const keepPhoto = designOf().bg === 'photo';
  settings.design = { preset: name };
  if (keepPhoto) Object.assign(settings.design, { bg: 'photo' });
  applySettings();
}
addEventListener('resize', () => { if (dv('bg') === 'photo') document.documentElement.style.setProperty('--page-bg-size', photoBgSize()); });

// ---------- фото на фон ----------
// Оригинал (уменьшенный до 1440px) хранится на устройстве; размытие, яркость и насыщенность «вшиваются»
// в отдельную копию — телефону не приходится размывать фон на лету при каждом движении экрана.
const PHOTO_KEY = 'design:photo0', PHOTO_DONE = 'design:photo';
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
async function setPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    const k = Math.min(1, 1440 / Math.max(im.width, im.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    localStorage.setItem(PHOTO_KEY, cv.toDataURL('image/jpeg', 0.86));
    const d = designOf(); delete d.phZoom; delete d.phX; delete d.phY; // новое фото — с центра
  } finally { URL.revokeObjectURL(url); }
  await processPhoto();
}
let photoJob = 0;
async function processPhoto() {
  const src = localStorage.getItem(PHOTO_KEY);
  if (!src) { photoURL = null; photoSize = null; return; }
  const job = ++photoJob;
  const im = await loadImage(src);
  if (job !== photoJob) return;
  const b = dv('phBlur'), br = dv('phBright'), sat = dv('phSat');
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
  const x = cv.getContext('2d');
  x.filter = `blur(${b}px) brightness(${br}%) saturate(${sat}%)`;
  const m = b * 2; // края при размытии не должны просвечивать
  x.drawImage(im, -m, -m, cv.width + m * 2, cv.height + m * 2);
  photoURL = cv.toDataURL('image/jpeg', 0.85);
  photoSize = { w: im.width, h: im.height };
  try { localStorage.setItem(PHOTO_DONE, JSON.stringify({ url: photoURL, w: im.width, h: im.height, key: `${b}|${br}|${sat}` })); } catch { /* места мало — обработаем при запуске */ }
  if (dv('bg') === 'photo') applySettings();
}
// при запуске — готовая обработанная копия
(function restorePhoto() {
  try { const p = JSON.parse(localStorage.getItem(PHOTO_DONE) || 'null'); if (p?.url) { photoURL = p.url; photoSize = { w: p.w, h: p.h }; } } catch { /* нет фото */ }
})();
// основной цвет с фото: средний из насыщенных пикселей
async function accentFromPhoto() {
  const src = localStorage.getItem(PHOTO_KEY); if (!src) return null;
  const im = await loadImage(src);
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
  const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 40, 40);
  const px = x.getImageData(0, 0, 40, 40).data;
  let r = 0, g = 0, bl = 0, w = 0;
  for (let i = 0; i < px.length; i += 4) {
    const [R, G, B] = [px[i], px[i + 1], px[i + 2]];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), s = mx ? (mx - mn) / mx : 0;
    const wt = s * s * (mx > 40 && mx < 245 ? 1 : 0.1);
    r += R * wt; g += G * wt; bl += B * wt; w += wt;
  }
  if (!w) return null;
  const [h, s] = rgbToHsv(r / w, g / w, bl / w);
  return hsvToHex(h, Math.max(0.55, s), 0.78); // достаточно насыщенный и тёмный, чтобы белый текст читался
}

// ---------- редактор фона-фото ----------
// Во весь экран: фото ровно в том размере, в каком оно будет стоять за приложением. Одним пальцем — двигать,
// двумя — приблизить/отдалить (колесо мыши в браузере), двойное нажатие — вернуть как было. Поверх можно показать
// «призрак» интерфейса, чтобы сразу видеть, как читаются карточки. Эффекты видны сразу, а «вшиваются» по «Готово».
const PH_KEYS = ['phZoom', 'phX', 'phY', 'phBlur', 'phBright', 'phSat', 'phTint', 'phTintA'];
async function photoEditor(onDone) {
  const src = localStorage.getItem(PHOTO_KEY); if (!src) return;
  const im = await loadImage(src);
  const app = document.getElementById('app'), pg = app.querySelector('.pages') || app;
  const before = Object.fromEntries(PH_KEYS.map((k) => [k, designOf()[k]]));
  const v = Object.fromEntries(PH_KEYS.map((k) => [k, dv(k)]));
  let tabNow = 'pos', ghost = true;
  const ed = document.createElement('div');
  ed.className = 'phed';
  ed.innerHTML = `<div class="phed-stage" style="top:${pg.offsetTop}px;height:${pg.offsetHeight}px">
      <div class="phed-img"></div><div class="phed-tint"></div>
      <div class="phed-ghost">${ghostUi()}</div>
    </div>
    <div class="phed-top">
      <button class="phed-b" data-ph="cancel">${t('cancel')}</button>
      <button class="phed-b icon" data-ph="ghost" title="${t('ph_ghost')}">${eyeIcon(true)}</button>
      <button class="phed-b" data-ph="fit">${t('ph_reset')}</button>
      <button class="phed-b acc" data-ph="done">${t('cp_done')}</button>
    </div>
    <div class="phed-hint">${t('ph_hint')}</div>
    <div class="phed-panel">
      <div class="phed-tabs"><button data-pt="pos" class="on">${t('ph_pos')}</button><button data-pt="fx">${t('ph_fx')}</button><button data-pt="tone">${t('d_tint')}</button></div>
      <div class="phed-body"></div>
    </div>`;
  app.appendChild(ed);
  const stage = ed.querySelector('.phed-stage'), img = ed.querySelector('.phed-img'), tint = ed.querySelector('.phed-tint'), body = ed.querySelector('.phed-body');
  img.style.backgroundImage = `url("${src}")`;
  const W = () => stage.offsetWidth, H = () => stage.offsetHeight;
  // размер картинки на экране: «заполнить экран» × масштаб — та же формула, что у фона приложения
  const dims = () => { const k = Math.max(W() / im.width, H() / im.height) * v.phZoom / 100; return [im.width * k, im.height * k]; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function paint() {
    const [iw, ih] = dims();
    img.style.backgroundSize = `${iw}px ${ih}px`;
    img.style.backgroundPosition = `${v.phX}% ${v.phY}%`;
    img.style.filter = `blur(${v.phBlur}px) brightness(${v.phBright}%) saturate(${v.phSat}%)`;
    img.style.inset = `-${v.phBlur * 2}px`; // размытые края не просвечивают (как при «вшивании»)
    const ta = v.phTintA / 100;
    tint.style.background = v.phTint === 'dark' ? `rgba(0,0,0,${ta})` : v.phTint === 'light' ? `rgba(255,255,255,${ta})`
      : v.phTint === 'accent' ? `color-mix(in srgb, var(--acc) ${v.phTintA}%, transparent)` : 'none';
  }
  // inset у размытой картинки больше экрана — позиция считается от неё, поэтому сдвигаем относительно сцены
  function fixInsetPos() { const m = v.phBlur * 2; if (!m) return; const [iw, ih] = dims(); img.style.backgroundPosition = `${(W() - iw) * v.phX / 100 + m}px ${(H() - ih) * v.phY / 100 + m}px`; }
  // левый верхний угол картинки в пикселях сцены <-> проценты позиции
  const offs = () => { const [iw, ih] = dims(); return [(W() - iw) * v.phX / 100, (H() - ih) * v.phY / 100, iw, ih]; };
  function setOffs(ox, oy, iw, ih) {
    v.phX = iw > W() + 0.5 ? clamp(ox / (W() - iw) * 100, 0, 100) : 50;
    v.phY = ih > H() + 0.5 ? clamp(oy / (H() - ih) * 100, 0, 100) : 50;
  }
  // приблизить вокруг точки (fx, fy): точка фото под пальцами остаётся под пальцами
  function zoomAt(z, fx, fy) {
    const [ox, oy, iw, ih] = offs();
    const u = (fx - ox) / iw, w = (fy - oy) / ih;
    v.phZoom = clamp(z, 100, 400);
    const [iw2, ih2] = dims();
    setOffs(fx - u * iw2, fy - w * ih2, iw2, ih2);
  }
  const draw2 = () => { paint(); fixInsetPos(); };
  // ---- жесты на фото ----
  const pts = new Map(); let g0 = null, lastTap = 0;
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function startGesture() {
    const p = [...pts.values()], [ox, oy] = offs();
    g0 = p.length >= 2
      ? { two: true, d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) || 1, z: v.phZoom, cx: (p[0][0] + p[1][0]) / 2, cy: (p[0][1] + p[1][1]) / 2, ox, oy, X: v.phX, Y: v.phY }
      : { two: false, x: p[0][0], y: p[0][1], ox, oy };
  }
  stage.onpointerdown = (e) => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); startGesture();
    ed.classList.add('moving');
    if (pts.size === 1) { const now = Date.now(); if (now - lastTap < 300) { v.phZoom = 100; v.phX = 50; v.phY = 50; draw2(); haptic('toggle'); } lastTap = now; }
  };
  stage.onpointermove = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    const p = [...pts.values()];
    if (g0.two && p.length >= 2) {
      const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), cx = (p[0][0] + p[1][0]) / 2, cy = (p[0][1] + p[1][1]) / 2;
      // масштаб вокруг начальной середины + сдвиг вслед за серединой пальцев
      v.phX = g0.X; v.phY = g0.Y; v.phZoom = g0.z;
      zoomAt(g0.z * d / g0.d, g0.cx, g0.cy);
      const [ox, oy, iw, ih] = offs(); setOffs(ox + cx - g0.cx, oy + cy - g0.cy, iw, ih);
    } else if (!g0.two) {
      const [, , iw, ih] = offs(); setOffs(g0.ox + p[0][0] - g0.x, g0.oy + p[0][1] - g0.y, iw, ih);
    }
    draw2();
  };
  stage.onpointerup = stage.onpointercancel = (e) => {
    pts.delete(e.pointerId);
    if (pts.size) startGesture(); else { g0 = null; ed.classList.remove('moving'); syncBody(); }
  };
  stage.onwheel = (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(v.phZoom * Math.exp(-e.deltaY / 400), x, y); draw2(); syncBody(); };
  // ---- панель ----
  const rng = (k, min, max, step, unit) => `<label class="phed-r"><span>${t({ phZoom: 'd_zoom', phBlur: 'd_blur', phBright: 'd_bright', phSat: 'd_sat', phTintA: 'd_tint_a', phX: 'd_posx', phY: 'd_posy' }[k])}</span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${v[k]}" data-pk="${k}"><b>${Math.round(v[k])}${unit}</b></label>`;
  function renderBody() {
    body.innerHTML = tabNow === 'pos' ? rng('phZoom', 100, 400, 1, '%') + rng('phX', 0, 100, 1, '%') + rng('phY', 0, 100, 1, '%')
      : tabNow === 'fx' ? rng('phBlur', 0, 40, 1, 'px') + rng('phBright', 30, 140, 1, '%') + rng('phSat', 0, 200, 1, '%')
      : `<div class="phed-seg">${[['none', t('d_none')], ['dark', t('d_dark')], ['light', t('d_light')], ['accent', t('d_acc')]].map(([k, l]) => `<button data-tint="${k}" class="${v.phTint === k ? 'on' : ''}">${l}</button>`).join('')}</div>`
        + (v.phTint !== 'none' ? rng('phTintA', 0, 90, 1, '%') : '');
  }
  function syncBody() { body.querySelectorAll('[data-pk]').forEach((r) => { r.value = v[r.dataset.pk]; r.nextElementSibling.textContent = Math.round(v[r.dataset.pk]) + r.nextElementSibling.textContent.replace(/^[-\d.]+/, ''); }); }
  body.oninput = (e) => {
    const r = e.target.closest('[data-pk]'); if (!r) return;
    const k = r.dataset.pk;
    if (k === 'phZoom') zoomAt(Number(r.value), W() / 2, H() / 2); else v[k] = Number(r.value);
    r.nextElementSibling.textContent = Math.round(v[k]) + r.nextElementSibling.textContent.replace(/^[-\d.]+/, '');
    draw2();
  };
  ed.onclick = async (e) => {
    const tb = e.target.closest('[data-pt]');
    if (tb) { tabNow = tb.dataset.pt; ed.querySelectorAll('[data-pt]').forEach((x) => x.classList.toggle('on', x === tb)); renderBody(); haptic('select'); return; }
    const tn = e.target.closest('[data-tint]');
    if (tn) { v.phTint = tn.dataset.tint; if (v.phTint !== 'none' && !v.phTintA) v.phTintA = 30; renderBody(); draw2(); haptic('toggle'); return; }
    const b = e.target.closest('[data-ph]'); if (!b) return;
    const a = b.dataset.ph;
    if (a === 'ghost') { ghost = !ghost; ed.classList.toggle('noghost', !ghost); b.innerHTML = eyeIcon(ghost); haptic('toggle'); }
    if (a === 'fit') { v.phZoom = 100; v.phX = 50; v.phY = 50; draw2(); syncBody(); haptic('toggle'); }
    if (a === 'cancel') close(false);
    if (a === 'done') close(true);
  };
  async function close(save) {
    if (save) {
      const d = designOf();
      PH_KEYS.forEach((k) => { d[k] = typeof v[k] === 'number' ? Math.round(v[k] * 10) / 10 : v[k]; });
      d.bg = 'photo';
      haptic('success');
      await processPhoto(); // размытие/яркость «вшиваются» один раз, дальше фон просто рисуется
      applySettings();
    } else {
      const d = designOf(); PH_KEYS.forEach((k) => { if (before[k] === undefined) delete d[k]; else d[k] = before[k]; });
    }
    ed.classList.add('closing');
    setTimeout(() => ed.remove(), 180 * (typeof MOTION !== 'undefined' ? (MOTION[settings.motion] ?? 1) : 1));
    window.removeEventListener('resize', draw2);
    photoEditor.close = null;
    onDone?.(save);
  }
  photoEditor.close = () => close(false); // кнопка «Назад» на телефоне = отмена
  window.addEventListener('resize', draw2);
  renderBody(); draw2();
}
function eyeIcon(on) {
  return `<svg class="ic" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>${on ? '' : '<path d="M4 4l16 16"/>'}</svg>`;
}
// упрощённый главный экран поверх фото: те же стили карточек, что в приложении
function ghostUi() {
  const card = (h, extra = '') => `<div class="card" style="height:${h}px;${extra}"></div>`;
  return `<div class="hero" style="height:150px;margin-bottom:12px"></div>
    <div class="quick" style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px">${'<button style="height:74px"></button>'.repeat(6)}</div>
    ${card(64)}${card(64)}${card(92)}`;
}

// ---------- цвет: преобразования ----------
function hexToRgb(hex) { const m = String(hex).replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return [47, 107, 255]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
function hsvToRgb(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
const hsvToHex = (h, s, v) => rgbToHex(...hsvToRgb(h, s, v));

// ---------- круглая палитра ----------
// Круг: по кругу — оттенок, от центра к краю — насыщенность; ниже ползунки (яркость, H/S/V и R/G/B),
// поле HEX, недавние цвета и прежняя сетка готовых цветов. Цвет применяется сразу, пока двигаешь палец.
function colorPicker(initial, onChange, title = t('custom_color')) {
  let [h, s, v] = rgbToHsv(...hexToRgb(initial));
  const recent = JSON.parse(localStorage.getItem('recentColors') || '[]');
  const grid = (() => {
    const hex = (hh, ss, ll) => { ss /= 100; ll /= 100; const f = (n) => { const k = (n + hh / 30) % 12; const c = ll - ss * Math.min(ll, 1 - ll) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
    const rows = [25, 35, 45, 55, 65, 75].map((l) => Array.from({ length: 12 }, (_, i) => hex(i * 30, 80, l)));
    rows.push(Array.from({ length: 12 }, (_, i) => hex(0, 0, 8 + i * 7)));
    return rows.flat();
  })();
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet cp"><div class="grab"></div>
    <div class="row" style="margin-bottom:10px"><h2 style="margin:0;font-size:19px">${esc(title)}</h2><span class="cp-prev"></span></div>
    <div class="cp-wheel" data-nodrag><canvas width="260" height="260"></canvas><i class="cp-dot"></i></div>
    <div class="cp-sl" data-nodrag>
      ${[['v', t('c_bright'), 100], ['h', 'H', 360], ['s', 'S', 100], ['r', 'R', 255], ['g', 'G', 255], ['b', 'B', 255]].map(([k, l, mx]) => `<label class="cp-row"><span>${l}</span><input type="range" min="0" max="${mx}" data-c="${k}"><b data-cv="${k}"></b></label>`).join('')}
    </div>
    <div class="row" style="gap:8px;margin:6px 0 12px"><span class="mute">HEX</span><input class="field cp-hex" maxlength="7" spellcheck="false" autocapitalize="off" style="margin:0;flex:1;font-family:ui-monospace,monospace"></div>
    ${recent.length ? `<div class="mute" style="margin:0 2px 6px">${t('c_recent')}</div><div class="palette">${recent.map((c) => `<button data-pick="${c}" style="background:${c}"></button>`).join('')}</div>` : ''}
    <div class="mute" style="margin:8px 2px 6px">${t('c_quick')}</div>
    <div class="palette">${grid.map((c) => `<button data-pick="${c}" style="background:${c}"></button>`).join('')}</div>
    <button class="btn wide" data-done style="margin-top:8px">${t('cp_done')}</button></div>`;
  app.appendChild(bg);
  const sh = bg.firstChild, cvs = sh.querySelector('canvas'), dot = sh.querySelector('.cp-dot'), hexIn = sh.querySelector('.cp-hex');
  const R = 130;
  const paintWheel = () => {
    const x = cvs.getContext('2d'), img = x.createImageData(260, 260), D = img.data;
    for (let yy = 0; yy < 260; yy++) for (let xx = 0; xx < 260; xx++) {
      const dx = xx - R, dy = yy - R, r = Math.hypot(dx, dy), i = (yy * 260 + xx) * 4;
      if (r > R) { D[i + 3] = 0; continue; }
      const [cr, cg, cb] = hsvToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / R, v);
      D[i] = cr; D[i + 1] = cg; D[i + 2] = cb; D[i + 3] = r > R - 1 ? (R - r) * 255 : 255;
    }
    x.putImageData(img, 0, 0);
  };
  let lastV = -1;
  const hex = () => hsvToHex(h, s, v);
  const sync = (from) => {
    if (v !== lastV) { paintWheel(); lastV = v; }
    const a = h * Math.PI / 180, rr = s * R;
    dot.style.transform = `translate(${R + Math.cos(a) * rr}px, ${R + Math.sin(a) * rr}px)`;
    const c = hex(), [cr, cg, cb] = hexToRgb(c);
    dot.style.background = c; sh.querySelector('.cp-prev').style.background = c;
    const vals = { v: Math.round(v * 100), h: Math.round(h), s: Math.round(s * 100), r: cr, g: cg, b: cb };
    for (const [k, val] of Object.entries(vals)) {
      const inp = sh.querySelector(`[data-c="${k}"]`); if (from !== k) inp.value = val;
      sh.querySelector(`[data-cv="${k}"]`).textContent = val;
    }
    // полоски ползунков раскрашены в то, что получится
    const g = (k) => sh.querySelector(`[data-c="${k}"]`).style;
    g('v').background = `linear-gradient(90deg, #000, ${hsvToHex(h, s, 1)})`;
    g('h').background = 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';
    g('s').background = `linear-gradient(90deg, ${hsvToHex(h, 0, v)}, ${hsvToHex(h, 1, v)})`;
    g('r').background = `linear-gradient(90deg, ${rgbToHex(0, cg, cb)}, ${rgbToHex(255, cg, cb)})`;
    g('g').background = `linear-gradient(90deg, ${rgbToHex(cr, 0, cb)}, ${rgbToHex(cr, 255, cb)})`;
    g('b').background = `linear-gradient(90deg, ${rgbToHex(cr, cg, 0)}, ${rgbToHex(cr, cg, 255)})`;
    if (from !== 'hex') hexIn.value = c;
    onChange(c);
  };
  // палец по кругу
  const pick = (e) => {
    const r = cvs.getBoundingClientRect(), k = 260 / r.width;
    const dx = (e.clientX - r.left) * k - R, dy = (e.clientY - r.top) * k - R;
    h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; s = Math.min(1, Math.hypot(dx, dy) / R);
    if (v < 0.15) v = 1; // на чёрном круг не видно — сразу поднимаем яркость
    sync();
  };
  const wheel = sh.querySelector('.cp-wheel');
  wheel.addEventListener('pointerdown', (e) => { wheel.setPointerCapture(e.pointerId); pick(e); e.preventDefault(); });
  wheel.addEventListener('pointermove', (e) => { if (wheel.hasPointerCapture(e.pointerId)) pick(e); });
  wheel.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  sh.querySelectorAll('[data-c]').forEach((inp) => (inp.oninput = () => {
    const k = inp.dataset.c, n = Number(inp.value);
    if (k === 'v') v = n / 100; else if (k === 'h') h = n; else if (k === 's') s = n / 100;
    else { const rgb = hexToRgb(hex()); rgb['rgb'.indexOf(k)] = n; [h, s, v] = rgbToHsv(...rgb); }
    sync(k);
  }));
  hexIn.oninput = () => { const m = hexIn.value.trim().match(/^#?([0-9a-f]{6})$/i); if (m) { [h, s, v] = rgbToHsv(...hexToRgb(m[1])); sync('hex'); } };
  const done = () => {
    const c = hex(), list = [c, ...recent.filter((x) => x !== c)].slice(0, 12);
    localStorage.setItem('recentColors', JSON.stringify(list));
    closeSheet(bg);
  };
  bg.onclick = (e) => {
    if (e.target === bg) return done();
    const b = e.target.closest('[data-pick]'); if (b) { [h, s, v] = rgbToHsv(...hexToRgb(b.dataset.pick)); haptic('select'); sync(); }
    if (e.target.closest('[data-done]')) done();
  };
  sheetDrag(bg);
  sync();
}

// ---------- иконки ----------
// Свой набор: 24×24, скруглённые линии. Части с классом d — «заливка» (видна в стилях «Дуотон»/«Заливка»/«Плитки»),
// in — детали поверх заливки (в стиле «Заливка» рисуются цветом фона, чтобы не пропадали).
const ICONS = {
  home: '<path class="d" d="M5.5 10.2V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-8.8L12 4.6z"/><path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10.2V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-8.8"/><path class="in" d="M10 20.5v-5a2 2 0 0 1 4 0v5"/>',
  schedule: '<rect class="d" x="3.5" y="5" width="17" height="15.5" rx="3.2"/><rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4"/><path class="in" d="M3.5 9.8h17M7.5 13.5h1.5M11.25 13.5h1.5M15 13.5h1.5M7.5 17h1.5M11.25 17h1.5"/>',
  grades: '<rect class="d" x="3.8" y="12" width="4.2" height="8.5" rx="1.4"/><rect class="d" x="9.9" y="7.5" width="4.2" height="13" rx="1.4"/><rect class="d" x="16" y="3.5" width="4.2" height="17" rx="1.4"/><rect x="3.8" y="12" width="4.2" height="8.5" rx="1.4"/><rect x="9.9" y="7.5" width="4.2" height="13" rx="1.4"/><rect x="16" y="3.5" width="4.2" height="17" rx="1.4"/>',
  umkd: '<path class="d" d="M3.5 9h17v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 18V6.5a2 2 0 0 1 2-2h3.8a2 2 0 0 1 1.5.7l1.4 1.8h7.3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path class="in" d="M3.5 10h17"/>',
  more: '<rect class="d" x="3.8" y="3.8" width="7" height="7" rx="2.2"/><rect x="3.8" y="3.8" width="7" height="7" rx="2.2"/><rect x="13.2" y="3.8" width="7" height="7" rx="2.2"/><rect x="3.8" y="13.2" width="7" height="7" rx="2.2"/><rect class="d" x="13.2" y="13.2" width="7" height="7" rx="2.2"/><rect x="13.2" y="13.2" width="7" height="7" rx="2.2"/>',
  exams: '<rect class="d" x="5" y="4.8" width="14" height="16.2" rx="2.6"/><rect x="5" y="4.8" width="14" height="16.2" rx="2.6"/><rect x="9" y="3" width="6" height="3.6" rx="1.4"/><path class="in" d="m8.8 13.8 2.2 2.2 4.3-4.6"/>',
  calendar: '<rect class="d" x="3.5" y="5" width="17" height="15.5" rx="3.2"/><rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4"/><path class="in" d="M3.5 9.8h17"/><path class="in" d="m12 12.6.9 1.8 2 .3-1.45 1.4.34 2-1.79-.95-1.79.95.34-2-1.45-1.4 2-.3z"/>',
  calc: '<rect class="d" x="5" y="3" width="14" height="18" rx="3"/><rect x="5" y="3" width="14" height="18" rx="3"/><rect class="in" x="8" y="6" width="8" height="3.6" rx="1"/><path class="in" style="stroke-width:2.4" d="M8.6 13.2h.01M12 13.2h.01M15.4 13.2h.01M8.6 17h.01M12 17h.01M15.4 17h.01"/>',
  teachers: '<rect class="d" x="9" y="3.5" width="12" height="9" rx="1.8"/><rect x="9" y="3.5" width="12" height="9" rx="1.8"/><circle cx="6.2" cy="10" r="2.4"/><path d="M2.2 20.5c.3-3 1.8-5 4-5s3.7 2 4 5"/><path class="in" d="M12.2 7.2h5.6"/><path d="m8.6 15.2 4.4-2.7"/>',
  distance: '<rect class="d" x="4.5" y="4.8" width="15" height="10.8" rx="1.8"/><rect x="4.5" y="4.8" width="15" height="10.8" rx="1.8"/><path d="M2.5 19.2h19"/><path class="in" d="M10.6 8.2v4.4l3.6-2.2z"/>',
  eservices: '<path class="d" d="M6.2 3.5H14l4.5 4.5v11a1.6 1.6 0 0 1-1.6 1.6H6.2A1.6 1.6 0 0 1 4.6 19V5.1a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M6.2 3.5H14l4.5 4.5v11a1.6 1.6 0 0 1-1.6 1.6H6.2A1.6 1.6 0 0 1 4.6 19V5.1a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M14 3.5V8h4.5"/><path class="in" d="M8 12.2h8M8 15.8h5"/>',
  debts: '<path class="d" d="M3.5 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 7V6.2a2 2 0 0 1 2-2H15a1.5 1.5 0 0 1 1.5 1.5v1.8"/><path d="M3.5 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path class="in" d="M16.2 12.2h4.3v3.6h-4.3a1.8 1.8 0 0 1 0-3.6z"/>',
  downloads: '<path class="d" d="M3.8 14.5h4.4l1.4 2.4h4.8l1.4-2.4h4.4V18a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 18z"/><path d="M12 3.5v9.8M8 9.6l4 4 4-4"/><path d="M3.8 14.5h4.4l1.4 2.4h4.8l1.4-2.4h4.4V18a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 18z"/>',
  card: '<rect class="d" x="2.8" y="5" width="18.4" height="14" rx="2.6"/><rect x="2.8" y="5" width="18.4" height="14" rx="2.6"/><circle class="in" cx="8.4" cy="10.8" r="2"/><path class="in" d="M5.4 15.8c.5-1.4 1.6-2.2 3-2.2s2.5.8 3 2.2M14 10h4.2M14 13.6h3"/>',
  surveys: '<rect class="d" x="5" y="4.8" width="14" height="16.2" rx="2.6"/><rect x="5" y="4.8" width="14" height="16.2" rx="2.6"/><rect x="9" y="3" width="6" height="3.6" rx="1.4"/><path class="in" style="stroke-width:2.3" d="M8.7 11.6h.01M8.7 15.8h.01"/><path class="in" d="M11.3 11.6h4.2M11.3 15.8h4.2"/>',
  fx: '<circle class="d" cx="12" cy="12" r="8.5"/><path d="M5 10.2A7.2 7.2 0 0 1 17.9 8M19 13.8A7.2 7.2 0 0 1 6.1 16"/><path d="M18.3 4.6 18 8.1l-3.5-.3M5.7 19.4 6 15.9l3.5.3"/>',
  settings: '<path class="d" d="m12 2.8 2.1 1.4 2.5-.3 1.1 2.3 2.3 1.1-.3 2.5 1.4 2.1-1.4 2.1.3 2.5-2.3 1.1-1.1 2.3-2.5-.3L12 21.2l-2.1-1.4-2.5.3-1.1-2.3L4 16.7l.3-2.5L2.8 12l1.4-2.1L4 7.4l2.3-1.1 1.1-2.3 2.5.3z"/><path d="m12 2.8 2.1 1.4 2.5-.3 1.1 2.3 2.3 1.1-.3 2.5 1.4 2.1-1.4 2.1.3 2.5-2.3 1.1-1.1 2.3-2.5-.3L12 21.2l-2.1-1.4-2.5.3-1.1-2.3L4 16.7l.3-2.5L2.8 12l1.4-2.1L4 7.4l2.3-1.1 1.1-2.3 2.5.3z"/><circle class="in" cx="12" cy="12" r="3.2"/>',
  book: '<path class="d" d="M5 5.5a2 2 0 0 1 2-2h11.5v14H7a2 2 0 0 0-2 2z"/><path d="M5 19.5v-14a2 2 0 0 1 2-2h11.5v14H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h11.5"/><path class="in" d="M9 8h6"/>',
  user: '<circle class="d" cx="12" cy="8" r="3.8"/><circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.2c.9-3.4 3.6-5.2 7.2-5.2s6.3 1.8 7.2 5.2"/>',
  palette: '<path class="d" d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5h2.3a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.8-7.3-8.5-7.3z"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5h2.3a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.8-7.3-8.5-7.3z"/><path class="in" style="stroke-width:2.6" d="M7.6 11.2h.01M9.6 7.6h.01M14 7h.01M16.8 10h.01"/>',
  week: '<rect class="d" x="3.5" y="5" width="17" height="15.5" rx="3.2"/><rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M8 3v4M16 3v4"/><path class="in" d="M3.5 9.8h17M8 15h8"/>',
  laptop: '<rect class="d" x="4.5" y="4.8" width="15" height="10.8" rx="1.8"/><rect x="4.5" y="4.8" width="15" height="10.8" rx="1.8"/><path d="M2.5 19.2h19"/>',
  folder: '<path class="d" d="M3.5 9h17v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 18V6.5a2 2 0 0 1 2-2h3.8a2 2 0 0 1 1.5.7l1.4 1.8h7.3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
};
// цвета плиток / «цветных» иконок
const ICOLOR = { home: '#3b82f6', schedule: '#f97316', grades: '#10b981', umkd: '#f59e0b', more: '#8b5cf6', exams: '#ef4444', calendar: '#ec4899', calc: '#14b8a6',
  teachers: '#6366f1', distance: '#0ea5e9', eservices: '#64748b', debts: '#e11d48', downloads: '#22c55e', card: '#3b82f6', surveys: '#a855f7', fx: '#f43f5e',
  settings: '#6b7280', book: '#f59e0b', user: '#3b82f6', palette: '#ec4899', week: '#f97316', laptop: '#0ea5e9', folder: '#f59e0b' };
const EMOJI = { home: '🏠', schedule: '📅', grades: '📊', umkd: '📁', more: '☰', exams: '📝', calendar: '🗓️', calc: '🧮', teachers: '👩‍🏫', distance: '💻', eservices: '🧾',
  debts: '💸', downloads: '⬇️', card: '🪪', surveys: '📋', fx: '🔁', settings: '⚙️', book: '📚', user: '👤', palette: '🎨', week: '📅', laptop: '💻', folder: '📁' };
// иконка: svg (для всех стилей, кроме «Эмодзи») + эмодзи (только для «Эмодзи»); tile — обёртка-плитка
function ic(name, tile = false) {
  const svg = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg><span class="emo">${EMOJI[name] || ''}</span>`;
  return tile ? `<span class="ict" style="--tc:${ICOLOR[name] || 'var(--acc)'}">${svg}</span>` : svg;
}

// ---------- экран «Дизайн» ----------
// Наверху — живые мини-превью всех стилей; ниже — каждая настройка отдельно. Всё применяется сразу.
function miniPreview(name) {
  const p = PRESETS[name], dark = p.forceDark || document.documentElement.dataset.theme === 'dark' && p.dark;
  const c = (dark ? p.dark : p.light) || p.dark;
  const bgk = p.bg, pb = bgk === 'mesh' || bgk === 'pastel' ? pageBg(bgk, !!dark) : c.bg;
  const cv = (() => { const save = settings.design; settings.design = { preset: name }; const r = cardVars(p.card, !!dark); settings.design = save; return r; })();
  const heroBg = { gradient: 'linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 55%, #000))', solid: 'var(--acc)', glass: 'color-mix(in srgb, var(--acc) 58%, transparent)',
    tonal: 'color-mix(in srgb, var(--acc) 18%, ' + c.card + ')', outline: c.card, mesh: 'radial-gradient(at 0 0, color-mix(in srgb, var(--acc) 60%, #fff), transparent 60%), color-mix(in srgb, var(--acc) 80%, #000)' }[p.hero];
  const r = Math.max(3, p.radius / 3);
  const card = `background:${cv.bg};border:${cv.border === '0' ? '0' : cv.border.replace(/^2px/, '1px')};box-shadow:${cv.shadow === 'none' ? 'none' : cv.shadow.replace(/(\d+)px/g, (m, n) => Math.ceil(n / 3) + 'px')};-webkit-backdrop-filter:${cv.filter};backdrop-filter:${cv.filter};border-radius:${r}px`;
  return `<button class="mini ${designOf().preset === name ? 'on' : ''}" data-preset="${name}">
    <span class="mini-ph" style="background:${pb};--bg:${c.bg};--card:${c.card};font-family:${p.font === 'serif' ? FONTS.serif : 'inherit'}">
      <span class="mini-hero" style="background:${heroBg};border-radius:${r + 2}px;${p.hero === 'outline' ? 'border:1px solid var(--acc)' : ''}"></span>
      <span class="mini-row"><span style="${card}"></span><span style="${card}"></span><span style="${card}"></span></span>
      <span class="mini-card" style="${card}"><i style="background:${c.ink}"></i><i style="background:${c.mute}"></i></span>
      <span class="mini-card" style="${card}"><i style="background:${c.ink}"></i><i style="background:${c.mute}"></i></span>
      <span class="mini-nav" style="${p.nav === 'docked' || p.nav === 'minimal' ? `left:0;right:0;bottom:0;border-radius:0;background:${c.card}` : card + ';border-radius:99px'}"><i style="background:var(--acc)"></i><i style="background:${c.mute}"></i><i style="background:${c.mute}"></i></span>
    </span><span class="mini-name">${t('st_' + name)}</span></button>`;
}
// ---------- экран «Дизайн» ----------
// Сверху — живой предпросмотр главного экрана (меняется сразу), под ним — разделы вкладками.
// Каждый выбор — плитка с примером того, что получится; ползунки подписаны по краям.
const DZ_TABS = [
  ['style', '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-2l-.3-.8c-.4-1.1.4-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z"/><circle class="d" cx="7.5" cy="11" r="1.4"/><circle class="d" cx="10.5" cy="7" r="1.4"/><circle class="d" cx="15.5" cy="7.5" r="1.4"/>'],
  ['colors', '<circle cx="12" cy="12" r="8.5"/><path class="d" d="M12 3.5a8.5 8.5 0 0 1 0 17Z"/>'],
  ['bg', '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5"/><circle class="d" cx="15.5" cy="9" r="1.6"/>'],
  ['cards', '<rect x="3.5" y="4" width="17" height="7" rx="2.5"/><rect class="d" x="3.5" y="13" width="17" height="7" rx="2.5"/><rect x="3.5" y="13" width="17" height="7" rx="2.5"/>'],
  ['home', '<rect x="3.5" y="4" width="17" height="7.5" rx="2.5"/><path class="d" d="M3.5 6.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5v5h-17Z"/><rect x="3.5" y="14" width="4.5" height="5.5" rx="1.5"/><rect x="9.75" y="14" width="4.5" height="5.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="5.5" rx="1.5"/>'],
  ['nav', '<rect x="3" y="14.5" width="18" height="6" rx="3"/><path class="d" d="M6 17.5h3"/><circle cx="12" cy="17.5" r=".6"/><circle cx="16.5" cy="17.5" r=".6"/><path d="M6 5h12M6 9h8"/>'],
  ['icons', '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect class="d" x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><circle cx="16.75" cy="16.75" r="3.25"/>'],
  ['text', '<path d="M4.5 19 9.5 5h1l5 14M6.3 14h7.4"/><path class="d" d="M17 19v-4.2a1.9 1.9 0 0 1 3.8 0V19"/><path d="M17 16.5h3.8"/>'],
];
const dzIcon = (p) => `<svg class="ic" viewBox="0 0 24 24">${p}</svg>`;

// живой предпросмотр: уменьшенная копия главного экрана с настоящими стилями приложения
function dzLive() {
  const pg = document.querySelector('.pages'), PW = pg?.offsetWidth || 390;
  const W = 118, k = (W - 6) / PW, H = Math.round((216 - 6) / k); // 6 — рамка «телефона»
  const hero = settings.homeHide.includes('hero') ? '' : `<div class="hero"><span class="hbtn">${ic('card')} ${t('profile_btn')}</span>
      <div class="sub">${t('morning')},</div><div class="name">${esc((cache.profile ?? stored('profile'))?.name?.split(' ').slice(0, 2).join(' ') || t('dz_name'))}</div>
      <div class="stats"><div class="stat"><b>3.6</b><span>GPA</span></div><div class="stat"><b>2</b><span>${t('course')}</span></div><div class="stat"><b>4</b><span>${t('lessons_today')}</span></div></div></div>`;
  return `<div class="dz-live" style="width:${W}px;height:216px"><div class="dz-rep" style="width:${PW}px;height:${H}px;transform:scale(${k})">
      <div class="dz-sb"><b>9:41</b><span><i></i><i></i><i></i></span></div>
      <div class="dz-rep-in">${hero}
        <div class="quick">${orderedQuick().slice(0, 6).map(([q]) => `<button tabindex="-1"><span class="i">${ic(q, true)}</span>${t('t_' + q)}</button>`).join('')}</div>
        <div class="sec">${t('last_grades')}</div>
        <div class="card"><div class="file"><span class="mark ok">95</span><div class="grow"><b>${t('dz_subject')}</b><div class="mute">${t('dz_task')}</div></div></div></div>
        <div class="card"><div class="file"><span class="mark ok">88</span><div class="grow"><b>${t('dz_subject')}</b><div class="mute">${t('dz_task')}</div></div></div></div>
      </div>
      <nav class="tabs"><span class="ind"></span>${TABS.map(([q], i) => `<button tabindex="-1" class="${i ? '' : 'on'}"><span class="i">${ic(q)}</span>${t('t_' + q)}</button>`).join('')}</nav>
    </div></div>`;
}

function designView() {
  const d = designOf(), p = PRESETS[d.preset] || PRESETS.classic;
  const tab = (S.dzTab ??= 'style');
  queueMicrotask(() => { S.dzAnim = false; }); // плавное появление — только при смене раздела
  const dark = document.documentElement.dataset.theme === 'dark';
  // ---- кирпичики ----
  const field = (title, hint, ctl) => `<div class="dz-f"><div class="dz-ft"><b>${title}</b></div>${hint ? `<div class="dz-fh">${hint}</div>` : ''}${ctl}</div>`;
  const tiles = (key, opts, cols = 3, cur = dv(key), attr = 'data-dset') => `<div class="dz-tiles c${cols}">${opts.map(([v, label, ex]) =>
    `<button class="dz-tile${String(cur) === String(v) ? ' on' : ''}" ${attr}="${attr === 'data-dset' ? key : v}" data-v="${v}"><span class="dz-ex">${ex}</span><span class="dz-lb">${label}</span></button>`).join('')}</div>`;
  const slider = (key, title, hint, min, max, step, unit, lo, hi) => {
    const v = dv(key), pc = ((v - min) / (max - min)) * 100;
    return `<div class="dz-f"><div class="dz-ft"><b>${title}</b><em data-dval="${key}">${v}${unit}</em></div>${hint ? `<div class="dz-fh">${hint}</div>` : ''}
      <input type="range" class="dz-sl" style="--p:${pc}%" min="${min}" max="${max}" step="${step}" value="${v}" data-drange="${key}" data-unit="${unit}">
      <div class="dz-mm"><span>${lo}</span><span>${hi}</span></div></div>`;
  };
  const colorBtn = (key, label) => `<button class="dz-color" data-dcolor="${key}"><span style="background:${dv(key)}"></span>${label}</button>`;
  const sceneBg = pageBg('mesh', dark);
  const cardEx = (style) => { const c = cardVars(style, dark); return `<span class="ex-scene" style="background:${sceneBg}"><i class="ex-card" style="background:${c.bg};border:${c.border};box-shadow:${c.shadow};-webkit-backdrop-filter:${c.filter};backdrop-filter:${c.filter};border-radius:${Math.min(dv('radius'), 14)}px"><b></b><b></b></i></span>`; };
  const navEx = (style) => `<span class="ex-screen"><b class="ex-lines"></b><i class="ex-nav ex-nav-${style}"><u class="on"></u><u></u><u></u><u></u></i></span>`;
  const indEx = (ind) => `<span class="ex-navrow ex-ind-${ind}"><u class="on">${ic('home')}</u><u>${ic('schedule')}</u><u>${ic('grades')}</u></span>`;
  const icoEx = (st) => `<span class="ex-icons" data-exi="${st}">${['home', 'grades', 'calendar'].map((q) => ic(q, true)).join('')}</span>`;
  const icolEx = (c) => `<span class="ex-icons" data-exc="${c}">${['exams', 'calc', 'downloads'].map((q) => ic(q, true)).join('')}</span>`;
  const heroEx = (h) => { const [bg, ink, st] = heroVars(h); return `<span class="ex-scene" style="background:${dark ? '#15171c' : '#eef1f6'}"><i class="ex-hero ex-hero-${h}" style="background:${bg};color:${ink}"><b style="background:${ink}"></b><s style="background:${st}"></s><s style="background:${st}"></s><s style="background:${st}"></s></i></span>`; };
  const L = (k) => t(k);

  // ---- разделы ----
  const panes = {
    style: () => `
      <div class="dz-minis">${PRESET_ORDER.map(miniPreview).join('')}</div>
      <div class="dz-note"><b>${t('st_' + d.preset)}</b> — ${t('st_' + d.preset + '_d')}</div>
      ${field(t('d_reset'), t('dz_reset_h'), `<button class="btn ghost wide" data-dreset>${t('d_reset')}</button>`)}`,

    colors: () => `
      ${p.forceDark ? `<div class="dz-note">${t('dz_forced_dark')}</div>` : field(t('theme'), '', tiles('theme', [
        ['light', t('light'), '<span class="ex-theme ex-light"><b></b><i></i><i></i></span>'],
        ['dark', t('dark'), '<span class="ex-theme ex-dark"><b></b><i></i><i></i></span>'],
        ['system', t('dz_auto'), '<span class="ex-theme ex-auto"><b></b><i></i><i></i></span>']], 3, settings.theme, 'data-dtheme'))}
      ${field(t('dz_accent'), t('dz_accent_h'), `<div class="dz-acc">${ACCENTS.map((a) => `<button data-dacc="${a}" class="${settings.accent === a ? 'on' : ''}" style="--c:${a}"></button>`).join('')}
          <button class="dz-acc-wheel${ACCENTS.includes(settings.accent) ? '' : ' on'}" data-dacc-wheel style="--c:${settings.accent}"><span></span><em>${t('dz_custom')}</em></button></div>
        ${localStorage.getItem(PHOTO_KEY) ? `<button class="btn ghost wide" data-dphoto-acc style="margin-top:12px">${t('d_photo_acc')}</button>` : ''}`)}`,

    bg: () => {
      const bgk = dv('bg'), hasPhoto = !!localStorage.getItem(PHOTO_KEY);
      const pgEl = document.querySelector('.pages'), PW = pgEl?.offsetWidth || 390, PH = pgEl?.offsetHeight || 760, TW = 132;
      const sw = (kind) => `<span class="ex-swatch" style="background:${kind === 'photo' ? (hasPhoto && photoURL ? `center/cover url('${photoURL}')` : 'var(--line)') : kind === 'color' ? 'var(--bg)' : pageBg(kind, dark)}">${kind === 'photo' && !(hasPhoto && photoURL) ? dzIcon(DZ_TABS[2][1]) : ''}</span>`;
      return `${field(t('d_bg_kind'), t('dz_bgkind_h'), tiles('bg', [['color', t('d_bg_style'), sw('color')], ['solid', t('d_bg_solid'), sw('solid')], ['gradient', t('d_bg_grad'), sw('gradient')],
          ['mesh', t('d_bg_mesh'), sw('mesh')], ['pastel', t('d_bg_pastel'), sw('pastel')], ['photo', t('d_bg_photo'), sw('photo')]]))}
        ${bgk === 'solid' ? field(t('d_bg_solid'), '', `<div class="dz-colors">${colorBtn('bgColor', t('dz_pick_color'))}</div>`) : ''}
        ${bgk === 'gradient' ? field(t('d_bg_grad'), t('dz_grad_h'), `<div class="dz-colors">${colorBtn('bgC1', t('dz_color1'))}${colorBtn('bgC2', t('dz_color2'))}</div>`) + slider('bgAngle', t('d_angle'), '', 0, 360, 5, '°', '↑', '↻') : ''}
        ${bgk === 'photo' ? (hasPhoto ? `<div class="dz-f dz-photo">
            <button class="ph-thumb" data-dphoto-edit style="width:${TW}px;height:${Math.round(TW * PH / PW)}px">
              <span style="width:${PW}px;height:${PH}px;transform:scale(${TW / PW});background-image:${pageBg('photo', dark)};background-size:${photoBgSize()};background-position:${dv('phX')}% ${dv('phY')}%"></span>
              <span class="ph-thumb-ui"><i></i><i></i><i></i></span></button>
            <div class="dz-photo-btns"><button class="btn" data-dphoto-edit>${t('ph_edit')}</button>
              <label class="btn ghost">${t('d_photo_change')}<input type="file" accept="image/*" data-dphoto hidden></label>
              <div class="dz-fh">${t('ph_edit_sub')}</div></div></div>`
          : field(t('d_bg_photo'), t('d_photo_hint'), `<label class="btn wide">${t('d_photo_pick')}<input type="file" accept="image/*" data-dphoto hidden></label>`)) : ''}`;
    },

    cards: () => {
      const cs = dv('card');
      return `${field(t('d_card_style'), t('dz_card_h'), tiles('card', [['solid', t('d_c_solid'), cardEx('solid')], ['glass', t('d_c_glass'), cardEx('glass')], ['outline', t('d_c_outline'), cardEx('outline')],
          ['elevated', t('d_c_elev'), cardEx('elevated')], ['soft', t('d_c_soft'), cardEx('soft')], ['brutal', t('d_c_brutal'), cardEx('brutal')], ['neon', t('d_c_neon'), cardEx('neon')]], 4))}
        ${slider('alpha', t('d_alpha'), t('dz_alpha_h'), 20, 100, 5, '%', t('dz_transp'), t('dz_dense'))}
        ${['glass', 'neon'].includes(cs) || dv('alpha') < 100 ? slider('blur', t('d_blur'), t('dz_blur_h'), 0, 40, 1, 'px', t('dz_clear'), t('dz_frosted')) : ''}
        ${slider('radius', t('d_radius'), '', 0, 32, 1, 'px', t('dz_sharp'), t('dz_round'))}
        ${slider('btn', t('d_btn_radius'), '', 0, 30, 1, 'px', t('dz_sharp'), t('dz_round'))}
        ${field(t('d_shadow'), t('dz_shadow_h'), tiles('shadow', [['none', t('d_none'), '<span class="ex-shadow" style="box-shadow:none"></span>'], ['soft', t('d_soft'), `<span class="ex-shadow" style="box-shadow:${SHADOWS.soft.replace('.06', '.14')}"></span>`], ['strong', t('d_strong'), `<span class="ex-shadow" style="box-shadow:${SHADOWS.strong}"></span>`]]))}
        ${field(t('d_density'), t('dz_density_h'), tiles('density', [['compact', t('d_compact'), '<span class="ex-dens" style="--g:2px"><i></i><i></i><i></i><i></i></span>'], ['normal', t('d_normal'), '<span class="ex-dens" style="--g:5px"><i></i><i></i><i></i></span>'], ['comfy', t('d_comfy'), '<span class="ex-dens" style="--g:9px"><i></i><i></i></span>']]))}`;
    },

    home: () => `
      <div class="dz-f dz-row"><div><b>${t('hero_show')}</b><div class="dz-fh">${t('hero_show_sub')}</div></div>
        <label class="sw"><input type="checkbox" id="dz-hero" ${settings.homeHide.includes('hero') ? '' : 'checked'}><i></i></label></div>
      ${settings.homeHide.includes('hero') ? '' : field(t('d_hero_style'), t('dz_hero_h'), tiles('hero', [['gradient', t('d_h_grad'), heroEx('gradient')], ['solid', t('d_h_solid'), heroEx('solid')], ['mesh', t('d_h_mesh'), heroEx('mesh')],
        ['glass', t('d_c_glass'), heroEx('glass')], ['tonal', t('d_h_tonal'), heroEx('tonal')], ['outline', t('d_c_outline'), heroEx('outline')]]))}
      <div class="dz-tip">${dzIcon('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.5 1.5 0 0 1 2.2-2L9 15"/>')}<span>${t('dz_reorder_tip')}</span></div>`,

    nav: () => `
      ${field(t('d_nav_style'), t('dz_nav_h'), tiles('nav', [['floating', t('d_n_float'), navEx('floating')], ['docked', t('d_n_dock'), navEx('docked')], ['island', t('d_n_island'), navEx('island')], ['minimal', t('d_n_min'), navEx('minimal')]], 4))}
      ${field(t('d_nav_ind'), t('dz_ind_h'), tiles('navind', [['pill', t('d_i_pill'), indEx('pill')], ['capsule', t('d_i_caps'), indEx('capsule')], ['dot', t('d_i_dot'), indEx('dot')], ['line', t('d_i_line'), indEx('line')], ['none', t('d_none'), indEx('none')]]))}
      ${field(t('d_nav_labels'), t('dz_labels_h'), tiles('navlabels', [['on', t('d_on'), `<span class="ex-navrow ex-ind-none ex-lab">${['home', 'schedule', 'grades'].map((q) => `<u>${ic(q)}<small>${t('t_' + q).slice(0, 6)}</small></u>`).join('')}</span>`], ['off', t('d_off'), indEx('none')]], 2))}`,

    icons: () => `
      ${field(t('d_icon_style'), t('dz_icons_h'), tiles('icons', [['duo', t('d_ic_duo'), icoEx('duo')], ['line', t('d_ic_line'), icoEx('line')], ['fill', t('d_ic_fill'), icoEx('fill')], ['tiles', t('d_ic_tiles'), icoEx('tiles')], ['emoji', t('d_ic_emoji'), icoEx('emoji')]]))}
      ${dv('icons') === 'emoji' ? '' : field(t('d_icon_color'), t('dz_icolor_h'), tiles('iconcolor', [['acc', t('d_acc'), icolEx('acc')], ['multi', t('d_multi'), icolEx('multi')], ['mono', t('d_mono'), icolEx('mono')]]))}
      ${dv('icons') === 'emoji' ? '' : slider('iconw', t('d_icon_w'), '', 1, 2.6, 0.1, '', t('dz_thin'), t('dz_bold'))}`,

    text: () => `
      ${field(t('d_font'), t('dz_font_h'), tiles('font', [['system', t('d_f_sys')], ['condensed', t('d_f_cond')], ['serif', t('d_f_serif')], ['mono', t('d_f_mono')], ['casual', t('d_f_casual')]]
        .map(([v, l]) => [v, l, `<span class="ex-font" style="font-family:${FONTS[v]}">Аа<small>123</small></span>`])))}
      ${field(t('d_head'), t('dz_head_h'), tiles('head', [['large', t('d_large'), '<span class="ex-head" style="font-size:22px">Аа</span>'], ['normal', t('d_normal'), '<span class="ex-head" style="font-size:17px">Аа</span>'], ['compact', t('d_compact'), '<span class="ex-head" style="font-size:13px">Аа</span>']]))}
      ${field(t('text_size'), t('dz_size_h'), tiles('size', [['s', t('dz_small'), '<span class="ex-head" style="font-size:12px;font-weight:500">Аа</span>'], ['m', t('d_normal'), '<span class="ex-head" style="font-size:15px;font-weight:500">Аа</span>'], ['l', t('dz_big'), '<span class="ex-head" style="font-size:19px;font-weight:500">Аа</span>']], 3, settings.size, 'data-dsize'))}`,
  };
  return `<div class="dz-head">
      <div class="dz-top">${dzLive()}
        <div class="dz-info"><span class="dz-cap">${t('dz_preview')}</span><b>${t('st_' + d.preset)}</b><span class="dz-fh">${t('dz_live_h')}</span>
          ${p.forceDark ? '' : `<button class="dz-mode" data-dtheme="${dark ? 'light' : 'dark'}">${dzIcon(dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>' : '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>')}${dark ? t('light') : t('dark')}</button>`}</div></div>
      <div class="dz-tabs" data-noswipe>${DZ_TABS.map(([k, ico]) => `<button data-dztab="${k}" class="${tab === k ? 'on' : ''}">${dzIcon(ico)}<span>${t('dz_t_' + k)}</span></button>`).join('')}</div>
    </div>
    <div class="dz-pane${S.dzAnim ? ' dz-anim' : ''}"><div class="dz-lead">${t('dz_h_' + tab)}</div>${(panes[tab] || panes.style)()}</div>`;
}

function designBind(m) {
  const redraw = (top) => { const y = top ? 0 : S.page._main.scrollTop; draw(true).then(() => { S.page._main.scrollTop = y; }); };
  // выбранная вкладка раздела — видна в полосе
  const tb = m.querySelector('.dz-tabs .on'); if (tb) tb.parentElement.scrollLeft = tb.offsetLeft - (tb.parentElement.offsetWidth - tb.offsetWidth) / 2;
  // обработчики — свойствами: при перерисовке экрана они заменяются, а не копятся
  m.onclick = async (e) => {
    const b = e.target.closest('[data-preset], [data-dztab], [data-dset], [data-dtheme], [data-dacc], [data-dacc-wheel], [data-dcolor], [data-dsize], [data-dreset], [data-dphoto-acc], [data-dphoto-edit]');
    if (!b) return;
    if (b.dataset.preset) { setPreset(b.dataset.preset); haptic('page'); touched(); return redraw(); }
    if (b.dataset.dztab) { if (S.dzTab !== b.dataset.dztab) { S.dzTab = b.dataset.dztab; S.dzAnim = true; haptic('select'); redraw(true); } return; }
    const mark = (sel) => m.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.dset) {
      const k = b.dataset.dset; setDesign(k, b.dataset.v); haptic('toggle'); mark(`[data-dset="${k}"]`);
      // от этих выборов зависит, какие ещё настройки показать
      if (['bg', 'card', 'icons'].includes(k)) { touched(); redraw(); }
      if (k === 'bg' && b.dataset.v === 'photo' && !localStorage.getItem(PHOTO_KEY)) m.querySelector('[data-dphoto]')?.click();
      return;
    }
    if (b.dataset.dtheme) { settings.theme = b.dataset.dtheme; applySettings(); haptic('toggle'); touched(); return redraw(); }
    if (b.dataset.dacc) { settings.accent = b.dataset.dacc; applySettings(); haptic('toggle'); touched(); return redraw(); }
    if (b.hasAttribute('data-dacc-wheel')) { touched(); return colorPicker(settings.accent, (c) => { settings.accent = c; applySettings(); b.style.setProperty('--c', c); }); }
    if (b.dataset.dcolor) { const k = b.dataset.dcolor; return colorPicker(dv(k), (c) => { setDesign(k, c); b.querySelector('span').style.background = c; }); }
    if (b.dataset.dsize) { settings.size = b.dataset.dsize; applySettings(); haptic('toggle'); mark('[data-dsize]'); return; }
    if (b.hasAttribute('data-dreset')) { setPreset(designOf().preset); haptic('delete'); touched(); return redraw(); }
    if (b.hasAttribute('data-dphoto-edit')) return photoEditor(() => { touched(); redraw(); });
    if (b.hasAttribute('data-dphoto-acc')) { const c = await accentFromPhoto(); if (c) { settings.accent = c; applySettings(); haptic('success'); touched(); redraw(); } }
  };
  // ползунки: применяются, пока двигаешь
  m.oninput = (e) => {
    const r = e.target.closest('[data-drange]'); if (!r) return;
    const k = r.dataset.drange, val = Number(r.value);
    r.style.setProperty('--p', ((val - r.min) / (r.max - r.min)) * 100 + '%');
    m.querySelector(`[data-dval="${k}"]`).textContent = val + r.dataset.unit;
    designOf()[k] = val; applySettings();
  };
  m.onchange = async (e) => {
    if (e.target.id === 'dz-hero') {
      settings.homeHide = settings.homeHide.filter((x) => x !== 'hero').concat(e.target.checked ? [] : ['hero']);
      applySettings(); haptic('toggle'); touched(); return redraw();
    }
    if (e.target.closest('[data-drange="alpha"]')) return redraw(); // показать/спрятать «Размытие»
    const f = e.target.closest('[data-dphoto]'); if (!f?.files?.[0]) return;
    await setPhotoFile(f.files[0]); f.value = ''; setDesign('bg', 'photo'); touched(); redraw();
    photoEditor(() => { touched(); redraw(); }); // сразу настроить, как фото встанет
  };
}
