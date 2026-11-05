// Progress store kept in ONE first-party cookie. No server ever reads it.
//
// Hardening:
//  - `__Host-` prefix (when served over HTTPS): the browser only accepts it if it is Secure,
//    Path=/ and has no Domain, so a sibling subdomain can't plant or overwrite it ("cookie tossing").
//  - SameSite=Strict: never sent on cross-site requests (no CSRF surface, not that we have a server).
//  - Strict allow-list parser: lesson ids must exist, numbers are range-clamped, the whole value
//    must match a fixed character grammar and length; anything else is discarded, never evaluated.
//  - Values are never rendered as HTML and never used to build URLs; ids only select known lessons.
//  - No personal data: only lesson positions, quiz scores, review boxes and a theme letter.
// JavaScript-set cookies cannot be HttpOnly. That's fine because nothing secret is stored; tampering
// can only change the tamperer's own progress.
import { useSyncExternalStore } from 'react';
import { SCENARIOS, byId } from '../data/scenarios/index.js';

const SECURE_CTX = typeof location !== 'undefined' && location.protocol === 'https:';
const NAME = SECURE_CTX ? '__Host-osi' : 'osi';
const MAX_AGE = 60 * 60 * 24 * 365;
const MAX_LEN = 3900;
const GRAMMAR = /^v1\|[a-z0-9]{0,24}\|[a-z0-9:~]*\|[a-z0-9.:~]*\|[0-9:]*\|[ld]?$/;
export const INTERVALS = [0, 1, 3, 7, 21]; // Leitner boxes → days until due

export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
export const timelineLength = (L) => L.steps.reduce((a, s) => a + 1 + s.packets.length, 0);
const clamp = (n, lo, hi) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : lo);

const empty = () => ({ last: '', lessons: {}, reviews: {}, streak: { day: 0, n: 0 }, theme: '' });

function parse(raw) {
  const s = empty();
  if (!raw || raw.length > MAX_LEN || !GRAMMAR.test(raw)) return s;
  const [, last, ls, rv, st, th] = raw.split('|');
  if (byId[last]) s.last = last;
  for (const item of ls.split('~')) {
    const [id, c, d, q, t] = item.split(':');
    const L = byId[id];
    if (!L) continue;
    s.lessons[id] = {
      cursor: clamp(+c, 0, timelineLength(L)) - 1,
      done: d === '1',
      quiz: clamp(+q, 0, L.quiz.length + 1) - 1,
      seen: clamp(+t, 0, 99999),
    };
  }
  for (const item of rv.split('~')) {
    const [key, b, due] = item.split(':');
    const [id, qi] = (key || '').split('.');
    const L = byId[id];
    if (!L || !(+qi >= 0 && +qi < L.quiz.length)) continue;
    s.reviews[`${id}.${+qi}`] = { box: clamp(+b, 0, INTERVALS.length - 1), due: clamp(+due, 0, 99999) };
  }
  const [sd, sn] = st.split(':');
  s.streak = { day: clamp(+sd, 0, 99999), n: clamp(+sn, 0, 9999) };
  s.theme = th === 'l' || th === 'd' ? th : '';
  return s;
}

function serialize(s) {
  // cursor and quiz are stored +1 so "not started"/"not taken" (-1) never needs a minus sign
  const ls = Object.entries(s.lessons).map(([id, v]) => `${id}:${v.cursor + 1}:${v.done ? 1 : 0}:${v.quiz + 1}:${v.seen}`);
  const rv = Object.entries(s.reviews).map(([k, v]) => `${k}:${v.box}:${v.due}`);
  return `v1|${s.last}|${ls.join('~')}|${rv.join('~')}|${s.streak.day}:${s.streak.n}|${s.theme}`;
}

function readCookie() {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(NAME + '='));
    return hit ? hit.slice(NAME.length + 1) : '';
  } catch { return ''; }
}

function writeCookie(value) {
  try {
    if (value.length > MAX_LEN || !GRAMMAR.test(value)) return;
    document.cookie = `${NAME}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict${SECURE_CTX ? '; Secure' : ''}`;
  } catch { /* cookies blocked: progress just won't persist */ }
}

/* ---------------- store ---------------- */
let state = typeof document !== 'undefined' ? parse(readCookie()) : empty();
const listeners = new Set();
let timer;

function commit(next) {
  state = next;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => writeCookie(serialize(state)), 250);
}

function touchStreak(s) {
  const d = today();
  if (s.streak.day === d) return s.streak;
  return { day: d, n: s.streak.day === d - 1 ? s.streak.n + 1 : 1 };
}

export const store = {
  get: () => state,
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

  setCursor(id, cursor, total) {
    if (!byId[id]) return;
    const prev = state.lessons[id] || { cursor: -1, done: false, quiz: -1, seen: 0 };
    const done = prev.done || cursor >= total - 1;
    if (prev.cursor === cursor && prev.done === done && state.last === id && prev.seen === today()) return;
    commit({ ...state, last: id, streak: touchStreak(state), lessons: { ...state.lessons, [id]: { ...prev, cursor: Math.max(-1, cursor), done, seen: today() } } });
  },

  // record a quiz attempt; every question becomes (or updates) a review card
  quiz(id, answers) {
    const L = byId[id];
    if (!L) return;
    const score = answers.filter((a, i) => a === L.quiz[i].answer).length;
    const prev = state.lessons[id] || { cursor: -1, done: false, quiz: -1, seen: today() };
    const reviews = { ...state.reviews };
    L.quiz.forEach((q, i) => {
      const box = answers[i] === q.answer ? 1 : 0;
      reviews[`${id}.${i}`] = { box, due: today() + INTERVALS[box] };
    });
    commit({ ...state, streak: touchStreak(state), reviews, lessons: { ...state.lessons, [id]: { ...prev, quiz: Math.max(prev.quiz, score) } } });
  },

  review(key, correct) {
    const r = state.reviews[key];
    if (!r) return;
    const box = correct ? Math.min(INTERVALS.length - 1, r.box + 1) : 0;
    commit({ ...state, streak: touchStreak(state), reviews: { ...state.reviews, [key]: { box, due: today() + Math.max(1, INTERVALS[box]) } } });
  },

  setTheme(t) { commit({ ...state, theme: t === 'l' || t === 'd' ? t : '' }); },

  reset() {
    commit(empty());
    clearTimeout(timer);
    try { document.cookie = `${NAME}=; Path=/; Max-Age=0; SameSite=Strict${SECURE_CTX ? '; Secure' : ''}`; } catch { /* ignore */ }
  },
};

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ---------------- derived helpers ---------------- */
// which step a timeline cursor falls in (each step = 1 intro entry + its packets)
export function stepAt(L, cursor) {
  let c = -1;
  for (let i = 0; i < L.steps.length; i++) {
    c += 1 + L.steps[i].packets.length;
    if (cursor <= c) return i;
  }
  return L.steps.length - 1;
}
export function lessonStatus(s, L) {
  const p = s.lessons[L.id];
  if (!p || p.cursor < 0) return { state: 'new', pct: 0, p };
  if (p.done) return { state: 'done', pct: 1, p };
  return { state: 'going', pct: (p.cursor + 1) / timelineLength(L), p };
}

export function dueCards(s) {
  const d = today();
  return Object.entries(s.reviews).filter(([, v]) => v.due <= d).map(([k]) => k);
}

export const COOKIE_NAME = NAME;
export const allLessonIds = SCENARIOS.map((x) => x.id);
// exported for tests in the browser console
export const _internal = { parse, serialize, GRAMMAR };
