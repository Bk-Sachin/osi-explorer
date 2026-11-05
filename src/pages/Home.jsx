import { SCENARIOS, byId, byLayer } from '../data/scenarios/index.js';
import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { useStore, lessonStatus, dueCards, stepAt } from '../lib/progress.js';
import { href } from '../lib/router.js';
import Envelope from '../components/Envelope.jsx';
import { StatusMark, minutes, plural } from '../components/Bits.jsx';

export default function Home() {
  const s = useStore();
  const last = byId[s.last];
  const lastSt = last && lessonStatus(s, last);
  const doneN = SCENARIOS.filter((L) => s.lessons[L.id]?.done).length;
  const due = dueCards(s).length;
  const next = SCENARIOS.find((L) => !s.lessons[L.id]?.done) || SCENARIOS[0];

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="h-hero">Follow one message through all seven layers of the network.</h1>
          <p className="lede">
            {SCENARIOS.length} animated lessons show what really happens when you load a page, send an email or join Wi‑Fi.
            You watch each packet hop between devices, open it up byte by byte, then try it yourself in a lab.
          </p>
          <div className="row">
            {last && lastSt.state === 'going'
              ? <a className="btn primary lg" href={href.lesson(last.id)}>Continue {last.name}</a>
              : <a className="btn primary lg" href={href.lesson(next.id)}>{doneN ? `Start ${next.name}` : 'Start the first lesson'}</a>}
            <a className="btn lg" href={href.lessons}>Browse all lessons</a>
          </div>
          <p className="hero-note">Tap a layer of the envelope to see what it adds.</p>
        </div>
        <Envelope />
      </section>

      {last && lastSt.state === 'going' && (
        <section className="ticket" aria-label="Where you left off">
          <div className="ticket-body">
            <p className="ticket-k">Where you left off</p>
            <h2 className="h-sub">{last.name}: {last.tag}</h2>
            <div className="meter" aria-hidden="true"><i style={{ width: `${lastSt.pct * 100}%`, background: LAYERS[last.layer].color }} /></div>
            <p className="muted">Step {stepAt(last, lastSt.p.cursor) + 1} of {last.steps.length}: {last.steps[stepAt(last, lastSt.p.cursor)].title}</p>
          </div>
          <a className="btn primary" href={href.lesson(last.id)}>Continue lesson</a>
        </section>
      )}

      {(doneN > 0 || due > 0) && (
        <section className="glance" aria-label="Your progress">
          <p><b>{doneN}</b> of {SCENARIOS.length} lessons finished</p>
          <p><b>{due}</b> review {due === 1 ? 'card' : 'cards'} due {due > 0 && <a href={href.review}>Review now</a>}</p>
          <p><b>{s.streak.n}</b> day streak</p>
        </section>
      )}

      <section className="route" aria-labelledby="route-h">
        <h2 id="route-h" className="h-section">Pick a layer</h2>
        <p className="muted measure">Layer 7 is what you use; layer 1 is the cable. Start anywhere: each lesson stands on its own, and they get more technical as you go down.</p>
        <ol className="route-list">
          {LAYER_ORDER.map((n) => {
            const L = LAYERS[n];
            return (
              <li key={n} className="route-row" style={{ '--lc': L.color }}>
                <a className="route-layer" href={href.study(n)} aria-label={`Layer ${n} ${L.name}: study guide`}>
                  <span className="route-n">{n}</span>
                  <span className="route-name">{L.name}</span>
                </a>
                <p className="route-job">{L.job}</p>
                <ul className="route-stops">
                  {byLayer(n).map((S) => {
                    const st = lessonStatus(s, S);
                    return (
                      <li key={S.id}>
                        <a href={href.lesson(S.id)} className="stop">
                          <StatusMark state={st.state} pct={st.pct} color={L.color} size={22} />
                          <span><b>{S.name}</b><small>{plural(S.steps.length, 'step')}, about {minutes(S)} min</small></span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
