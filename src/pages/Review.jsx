import { useState } from 'react';
import { SCENARIOS, byId } from '../data/scenarios/index.js';
import { LAYERS } from '../data/layers.js';
import { useStore, store, dueCards, today, INTERVALS } from '../lib/progress.js';
import { href } from '../lib/router.js';
import { plural } from '../components/Bits.jsx';

const BOX_NAMES = ['Again today', 'Tomorrow', 'In 3 days', 'In a week', 'Mastered'];
const cardOf = (key) => {
  const [id, qi] = key.split('.');
  return { key, L: byId[id], q: byId[id].quiz[+qi] };
};

export default function Review() {
  const s = useStore();
  const all = Object.keys(s.reviews);
  const [queue, setQueue] = useState(null); // keys for this session, fixed once started
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [right, setRight] = useState(0);
  const due = dueCards(s);

  const start = (keys) => { setQueue([...keys].sort(() => Math.random() - 0.5)); setI(0); setPicked(null); setRight(0); };
  const finishedLessons = SCENARIOS.filter((L) => s.lessons[L.id]?.done);

  if (queue && i < queue.length) {
    const { key, L, q } = cardOf(queue[i]);
    const Ly = LAYERS[L.layer];
    const answer = (j) => {
      if (picked != null) return;
      setPicked(j);
      const ok = j === q.answer;
      if (ok) setRight((r) => r + 1);
      store.review(key, ok);
    };
    return (
      <main className="page narrow">
        <div className="review-top">
          <h1 className="h-page">Review</h1>
          <p className="muted">Card {i + 1} of {queue.length}</p>
        </div>
        <div className="meter" aria-hidden="true"><i style={{ width: `${(i / queue.length) * 100}%` }} /></div>
        <article className="flash-card" style={{ '--lc': Ly.color }} aria-live="polite">
          <p className="card-from">From <a href={href.lesson(L.id)}>{L.name}</a>, layer {L.layer} {Ly.name}</p>
          <h2 className="card-q">{q.q}</h2>
          <div className="quiz-q">
            {q.options.map((o, j) => {
              const cls = picked == null ? '' : j === q.answer ? 'right' : picked === j ? 'wrong' : 'dim';
              return <button key={j} className={cls} disabled={picked != null} onClick={() => answer(j)}>{o}</button>;
            })}
          </div>
          {picked != null && (
            <>
              <p className={`why ${picked === q.answer ? 'good' : 'bad'}`}>
                {picked === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}
              </p>
              <p className="muted small">
                {picked === q.answer
                  ? `This card moves to "${BOX_NAMES[Math.min(4, (s.reviews[key]?.box ?? 1))]}".`
                  : 'This card comes back tomorrow so you can try it again.'}
              </p>
              <button className="btn primary" onClick={() => { setPicked(null); setI(i + 1); }} autoFocus>
                {i + 1 < queue.length ? 'Next card' : 'See results'}
              </button>
            </>
          )}
        </article>
      </main>
    );
  }

  if (queue && i >= queue.length) {
    return (
      <main className="page narrow">
        <h1 className="h-page">Review done</h1>
        <p className="lede">You got {right} of {queue.length} right. Cards you answered correctly will wait longer before coming back; missed ones return tomorrow.</p>
        <div className="row">
          <button className="btn" onClick={() => setQueue(null)}>Back to your deck</button>
          <a className="btn primary" href={href.lessons}>Go to lessons</a>
        </div>
      </main>
    );
  }

  const boxes = INTERVALS.map((_, b) => all.filter((k) => s.reviews[k].box === b).length);
  const nextDue = all.length ? Math.min(...all.map((k) => s.reviews[k].due)) - today() : 0;

  return (
    <main className="page narrow">
      <h1 className="h-page">Review</h1>
      <p className="lede">Questions from lessons you've finished come back here, spaced out over days. Each correct answer pushes a card further away; a miss brings it back tomorrow. Short, regular reviews beat cramming.</p>

      {all.length === 0 ? (
        <div className="empty-state">
          <p>Your deck is empty. Take the quiz at the end of any lesson and its questions are added here.</p>
          <a className="btn primary" href={href.lessons}>Choose a lesson</a>
        </div>
      ) : (
        <>
          <div className="due-panel">
            {due.length > 0 ? (
              <>
                <p className="due-big"><b>{plural(due.length, 'card')}</b> due now</p>
                <button className="btn primary lg" onClick={() => start(due)}>Start review</button>
              </>
            ) : (
              <>
                <p className="due-big">Nothing due right now.</p>
                <p className="muted">Your next card is due {nextDue <= 1 ? 'tomorrow' : `in ${nextDue} days`}.</p>
                <button className="btn" onClick={() => start(all)}>Practise all {all.length} cards anyway</button>
              </>
            )}
          </div>
          <h2 className="h-section">Your deck</h2>
          <ol className="boxes" aria-label="Cards by how well you know them">
            {boxes.map((n, b) => (
              <li key={b} style={{ '--h': `${Math.max(6, (n / Math.max(1, all.length)) * 100)}%` }}>
                <span className="box-bar" aria-hidden="true" />
                <b>{n}</b>
                <span className="muted small">{BOX_NAMES[b]}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {finishedLessons.length > 0 && (
        <>
          <h2 className="h-section">Watch a finished lesson again</h2>
          <ul className="plain-list">
            {finishedLessons.map((L) => (
              <li key={L.id} style={{ '--lc': LAYERS[L.layer].color }}>
                <a href={href.lesson(L.id)}><b>{L.name}</b></a>
                <span className="muted">{L.tag}</span>
                {s.lessons[L.id].quiz >= 0 && <span className="muted small">Quiz {s.lessons[L.id].quiz} of {L.quiz.length}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
