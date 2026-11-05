import { useState } from 'react';
import { SCENARIOS, byLayer } from '../data/scenarios/index.js';
import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { useStore, store, COOKIE_NAME, today } from '../lib/progress.js';
import { href } from '../lib/router.js';

function Stamp({ L, p, color }) {
  const done = p?.done;
  const id = `ring-${L.id}`;
  const date = done && p.seen ? new Date(p.seen * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const rot = ((L.id.charCodeAt(0) * 7 + L.id.length * 13) % 15) - 7;
  return (
    <a href={href.lesson(L.id)} className={`stamp ${done ? 'got' : ''}`} style={{ '--lc': color, '--rot': `${rot}deg` }}
      aria-label={done ? `${L.name}: stamped ${date}` : `${L.name}: not stamped yet`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs><path id={id} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
        <circle cx="60" cy="60" r="56" className="stamp-ring" />
        <circle cx="60" cy="60" r="34" className="stamp-ring inner" />
        <text className="stamp-arc"><textPath href={`#${id}`} startOffset="25%" textAnchor="middle">{L.name.toUpperCase()} · LAYER {L.layer}</textPath></text>
        {done ? (
          <>
            <text x="60" y="57" textAnchor="middle" className="stamp-big">✓</text>
            <text x="60" y="76" textAnchor="middle" className="stamp-date">{date}</text>
          </>
        ) : <text x="60" y="66" textAnchor="middle" className="stamp-empty">not yet</text>}
      </svg>
    </a>
  );
}

export default function Passport() {
  const s = useStore();
  const [confirm, setConfirm] = useState(false);
  const done = SCENARIOS.filter((L) => s.lessons[L.id]?.done).length;
  const quizzes = SCENARIOS.filter((L) => s.lessons[L.id]?.quiz >= 0).length;
  const mastered = Object.values(s.reviews).filter((r) => r.box === 4).length;
  const layersDone = LAYER_ORDER.filter((n) => byLayer(n).every((L) => s.lessons[L.id]?.done)).length;
  const streakLive = s.streak.day >= today() - 1 ? s.streak.n : 0;

  return (
    <main className="page">
      <h1 className="h-page">Your passport</h1>
      <p className="lede measure">Every lesson you finish gets a postmark. Collect all of a layer's stamps to complete that layer.</p>

      <dl className="stats">
        <div><dt>Lessons finished</dt><dd>{done}<small> of {SCENARIOS.length}</small></dd></div>
        <div><dt>Layers complete</dt><dd>{layersDone}<small> of 7</small></dd></div>
        <div><dt>Quizzes taken</dt><dd>{quizzes}</dd></div>
        <div><dt>Cards mastered</dt><dd>{mastered}</dd></div>
        <div><dt>Day streak</dt><dd>{streakLive}</dd></div>
      </dl>

      {LAYER_ORDER.map((n) => {
        const Ly = LAYERS[n];
        const list = byLayer(n);
        const got = list.filter((L) => s.lessons[L.id]?.done).length;
        return (
          <section key={n} className="stamp-page" style={{ '--lc': Ly.color }} aria-labelledby={`sp-${n}`}>
            <header>
              <h2 id={`sp-${n}`} className="h-sub"><span className="route-n">{n}</span>{Ly.name}</h2>
              <p className="muted">{got === list.length ? 'Layer complete' : `${got} of ${list.length} stamps`}</p>
            </header>
            <div className="stamps">{list.map((L) => <Stamp key={L.id} L={L} p={s.lessons[L.id]} color={Ly.color} />)}</div>
          </section>
        );
      })}

      <section className="privacy" aria-labelledby="priv-h">
        <h2 id="priv-h" className="h-section">What's stored, and where</h2>
        <p className="measure">Your progress lives in a single cookie in this browser, named <code>{COOKIE_NAME}</code>. This site has no accounts and no server that reads it, so clearing your cookies or switching devices starts you fresh.</p>
        <ul className="measure">
          <li>Where you stopped in each lesson, whether you finished it, and your best quiz score.</li>
          <li>Your review cards: which box each is in and the day it's next due.</li>
          <li>Your day streak and theme choice.</li>
          <li>No name, email, IP address or anything that identifies you.</li>
        </ul>
        <p className="measure muted small">The cookie is first-party only, never sent to other sites (SameSite=Strict), locked to this exact host when served over HTTPS (the <code>__Host-</code> prefix), and checked against a strict format every time it's read. Anything that doesn't match is thrown away rather than used.</p>
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}>Reset all progress</button>
        ) : (
          <div className="confirm" role="alert">
            <p>This deletes every stamp, quiz score and review card in this browser. It can't be undone.</p>
            <div className="row">
              <button className="btn danger" onClick={() => { store.reset(); setConfirm(false); }}>Delete my progress</button>
              <button className="btn" onClick={() => setConfirm(false)}>Keep it</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
