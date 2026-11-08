// Лёгкая замена cheerio для приложения: тот же API, но разбор HTML делает встроенный
// в WebView разборщик (DOMParser) — он быстрее и не тянет ~400 КБ кода библиотеки.
// Реализованы только функции, которые использует kaznu-test/univer.mjs.
const parser = new DOMParser();

// Селектор внутри элемента (как в jQuery .find): каждая часть списка ищется от :scope.
const scoped = (sel) => sel.split(',').map((p) => `:scope ${p.trim()}`).join(', ');
const matches = (el, sel) => el.nodeType === 1 && el.matches(sel);
const uniq = (arr) => [...new Set(arr)];

class Q {
  constructor(nodes) {
    this.n = nodes.filter(Boolean);
    this.length = this.n.length;
    this.n.forEach((x, i) => { this[i] = x; });
  }
  find(sel) { return new Q(uniq(this.n.flatMap((e) => (e.querySelectorAll ? [...e.querySelectorAll(scoped(sel))] : [])))); }
  children(sel) { return new Q(this.n.flatMap((e) => [...(e.children || [])]).filter((c) => !sel || matches(c, sel))); }
  parent() { return new Q(uniq(this.n.map((e) => e.parentElement))); }
  parents(sel) { const out = []; for (const e of this.n) for (let p = e.parentElement; p; p = p.parentElement) if (!sel || matches(p, sel)) out.push(p); return new Q(uniq(out)); }
  closest(sel) { return new Q(uniq(this.n.map((e) => (e.closest ? e.closest(sel) : null)))); }
  next(sel) { return new Q(this.n.map((e) => e.nextElementSibling).filter((x) => x && (!sel || matches(x, sel)))); }
  prev(sel) { return new Q(this.n.map((e) => e.previousElementSibling).filter((x) => x && (!sel || matches(x, sel)))); }
  filter(f) { return new Q(typeof f === 'string' ? this.n.filter((e) => matches(e, f)) : this.n.filter((e, i) => f.call(e, i, e))); }
  not(f) { return new Q(typeof f === 'string' ? this.n.filter((e) => !matches(e, f)) : this.n.filter((e, i) => !f.call(e, i, e))); }
  is(sel) { return this.n.some((e) => matches(e, sel)); }
  first() { return new Q(this.n.slice(0, 1)); }
  last() { return new Q(this.n.slice(-1)); }
  eq(i) { return new Q([this.n[i < 0 ? this.n.length + i : i]]); }
  slice(a, b) { return new Q(this.n.slice(a, b)); }
  each(fn) { for (let i = 0; i < this.n.length; i++) if (fn.call(this.n[i], i, this.n[i]) === false) break; return this; }
  map(fn) { return new Q(this.n.flatMap((e, i) => { const v = fn.call(e, i, e); return v == null ? [] : v; })); }
  toArray() { return [...this.n]; }
  get(i) { return i === undefined ? [...this.n] : this.n[i < 0 ? this.n.length + i : i]; }
  text() { return this.n.map((e) => e.textContent ?? '').join(''); }
  html() { return this.n[0] ? this.n[0].innerHTML : null; }
  attr(name) { const e = this.n[0]; if (!e || !e.getAttribute) return undefined; const v = e.getAttribute(name); return v === null ? undefined : v; }
  prop(name) { const e = this.n[0]; return e ? e[name] : undefined; }
  val() { const e = this.n[0]; return e ? (e.value ?? e.getAttribute?.('value') ?? undefined) : undefined; }
  hasClass(c) { return this.n.some((e) => e.classList?.contains(c)); }
}

export function load(html) {
  const doc = parser.parseFromString(String(html ?? ''), 'text/html');
  const $ = (x) => {
    if (x instanceof Q) return x;
    if (typeof x === 'string') return new Q([...doc.querySelectorAll(x)]);
    if (Array.isArray(x)) return new Q(x);
    return new Q(x ? [x] : []);
  };
  $.root = () => new Q([doc.documentElement]);
  return $;
}
export default { load };
