import { journey, wordsMs } from '../lib/util.js';

// How long the lesson takes on autoplay at 1×, rounded to minutes
const cache = {};
export function minutes(L) {
  if (cache[L.id]) return cache[L.id];
  let ms = 0;
  for (const st of L.steps) {
    ms += wordsMs(st.text);
    for (const p of st.packets) ms += journey(L, p).total + 3500;
  }
  return (cache[L.id] = Math.max(2, Math.round(ms / 60000)));
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Status ring: empty (not started), arc (in progress), postmark (done)
export function StatusMark({ state, pct = 0, color = 'var(--blue)', size = 26, label }) {
  const r = 10, c = 2 * Math.PI * r;
  const text = label || (state === 'done' ? 'Finished' : state === 'going' ? `${Math.round(pct * 100)}% through` : 'Not started');
  return (
    <svg className={`mark-status ${state}`} width={size} height={size} viewBox="0 0 26 26" role="img" aria-label={text}>
      <title>{text}</title>
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--rule-2)" strokeWidth="2" strokeDasharray={state === 'new' ? '2.5 3' : undefined} />
      {state === 'going' && <circle cx="13" cy="13" r={r} fill="none" stroke={color} strokeWidth="2.6" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 13 13)" strokeLinecap="round" />}
      {state === 'done' && (
        <>
          <circle cx="13" cy="13" r={r} fill={color} />
          <path d="M8.2 13.4 l3.2 3.1 l6.4 -7" fill="none" stroke="var(--on-lc)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
