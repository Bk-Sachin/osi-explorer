import { useEffect, useState } from 'react';
import { byId } from '../data/scenarios/index.js';

// Hash routes so the static build works anywhere (Vercel, file server) without rewrites.
// Every parameter is checked against an allow-list; unknown routes fall back to "notfound".
function parseHash(hash) {
  const path = (hash || '').replace(/^#\/?/, '').split('?')[0];
  const [page = '', param = ''] = path.split('/');
  switch (page) {
    case '': return { page: 'home' };
    case 'lessons': return { page: 'lessons' };
    case 'review': return { page: 'review' };
    case 'passport': return { page: 'passport' };
    case 'lesson': return byId[param] ? { page: 'lesson', id: param } : { page: 'notfound' };
    case 'study':
    case 'labs': {
      const n = /^[1-7]$/.test(param) ? +param : param === '' ? 7 : 0;
      return n ? { page, layer: n } : { page: 'notfound' };
    }
    default: return { page: 'notfound' };
  }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseHash(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = {
  home: '#/', lessons: '#/lessons', review: '#/review', passport: '#/passport',
  lesson: (id) => `#/lesson/${id}`, study: (n) => `#/study/${n}`, labs: (n) => `#/labs/${n}`,
};
export const go = (h) => { location.hash = h; };

// Per-tab UI preferences (view tab, speed). Session-only: cleared when the tab closes.
export const session = {
  get(key, fallback) { try { const v = sessionStorage.getItem('osi.' + key); return v ?? fallback; } catch { return fallback; } },
  set(key, v) { try { sessionStorage.setItem('osi.' + key, String(v)); } catch { /* unavailable */ } },
};
