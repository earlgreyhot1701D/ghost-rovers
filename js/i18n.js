// js/i18n.js: content translation. Console chrome (codes, clocks, names) stays English.
// SI-assisted code (Claude), reviewed by La Shara Cordero. See AI_DISCLOSURE.md.

export const LANGS = [
  { id: 'en', label: 'ENGLISH' },
  { id: 'ru', label: 'РУССКИЙ' },
  { id: 'es', label: 'ESPAÑOL' },
  { id: 'fr', label: 'FRANÇAIS' },
  { id: 'de', label: 'DEUTSCH' },
  { id: 'pt', label: 'PORTUGUÊS (BR)' },
  { id: 'it', label: 'ITALIANO' }
];

let dict = null;

function normalize(value) {
  const v = String(value || 'en').toLowerCase();
  const hit = LANGS.find((l) => l.id !== 'en' && v.startsWith(l.id));
  return hit ? hit.id : 'en';
}

// Order: explicit ?lang= → the language the visitor picked before → the browser's own.
export function resolveLang() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl) return normalize(fromUrl);
    const saved = window.localStorage.getItem('ghostrovers.lang');
    if (saved) return normalize(saved);
  } catch (err) {
    // private mode, blocked storage: fall through to the browser language
  }
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return normalize(nav);
}

export function setLang(id) {
  try {
    window.localStorage.setItem('ghostrovers.lang', id);
  } catch (err) {}
  const url = new URL(window.location.href);
  url.searchParams.set('lang', id);
  window.location.replace(url.toString());
}

export async function loadDict(lang) {
  if (lang === 'en') {
    dict = null;
    return null;
  }
  try {
    const res = await fetch('data/i18n-' + lang + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    dict = await res.json();
  } catch (err) {
    dict = null;
  }
  return dict;
}

export function t(key, fallback) {
  return (dict && dict.ui && dict.ui[key]) || fallback;
}

// Elements marked data-i18n get their text replaced, so static labels translate too.
// data-i18n-aria does the same for aria-label, so a translated button keeps an
// accessible name that contains its visible text (WCAG 2.5.3).
export function applyStatic() {
  if (!dict || !dict.ui) return;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = dict.ui[el.getAttribute('data-i18n')];
    if (typeof value === 'string' && value) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const value = dict.ui[el.getAttribute('data-i18n-aria')];
    if (typeof value === 'string' && value) el.setAttribute('aria-label', value);
  });
}

export function localizeWorld(world) {
  if (!dict || !dict.ghosts || !world || !Array.isArray(world.ghosts)) return world;
  const ghosts = world.ghosts.map((g) => {
    const tr = dict.ghosts[g.id];
    if (!tr) return g;
    return Object.assign({}, g, {
      job: tr.job || g.job,
      story: tr.story || g.story,
      qs: Array.isArray(tr.qs) && tr.qs.length ? tr.qs : g.qs,
      reply: tr.reply || g.reply
    });
  });
  // The closing line of the timeline is content, and the data file wins over the
  // built-in fallback, so it has to be translated here rather than in the view.
  const todayKey = world.world === 'mars' ? 'timelineTodayMars' : 'timelineTodayMoon';
  const today = (dict.ui && dict.ui[todayKey]) || world.today;
  return Object.assign({}, world, { ghosts, today });
}
