// The game speaks English by default and German on request. Every text in the game is
// written as a pair, L('Deutsch', 'English'), and the language is settled once, before
// anything else is loaded; switching reloads the page.

export type Lang = 'en' | 'de';
const KEY = 'tempo6.lang';

function stored(): Lang {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'de' ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

export const lang: Lang = stored();

/** The text in the language the game is in. */
export function L(de: string, en: string): string {
  return lang === 'de' ? de : en;
}

/** Numbers with the language's decimal mark. */
export function num(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return lang === 'de' ? s.replace('.', ',') : s;
}

/** Switch language and start over in it. */
export function switchLanguage(to: Lang): void {
  try {
    globalThis.localStorage?.setItem(KEY, to);
  } catch {
    // no storage: it stays as it is
  }
  location.reload();
}

/** The page's own markup is in English; elements with `data-de` swap to their German text. */
export function translatePage(): void {
  if (lang !== 'de' || typeof document === 'undefined') return;
  document.documentElement.lang = 'de';
  document.querySelectorAll<HTMLElement>('[data-de]').forEach((e) => (e.innerHTML = e.dataset.de ?? ''));
}

/** 1st, 2nd, 3rd … for places. */
export function ordinal(n: number): string {
  const tens = n % 100, ones = n % 10;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
