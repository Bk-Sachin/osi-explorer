import { useState } from 'react';
import { SCENARIOS, byLayer } from '../data/scenarios/index.js';
import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { useStore, lessonStatus } from '../lib/progress.js';
import { href, session } from '../lib/router.js';
import { StatusMark, minutes, plural } from '../components/Bits.jsx';

const FILTERS = [['all', 'All'], ['new', 'Not started'], ['going', 'In progress'], ['done', 'Finished']];
const ACTION = { new: 'Start', going: 'Continue', done: 'Replay' };

export default function Lessons() {
  const s = useStore();
  const [filter, setFilterRaw] = useState(() => (FILTERS.some(([k]) => k === session.get('filter')) ? session.get('filter') : 'all'));
  const setFilter = (f) => { setFilterRaw(f); session.set('filter', f); };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, SCENARIOS.filter((L) => k === 'all' || lessonStatus(s, L).state === k).length]));

  return (
    <main className="page">
      <h1 className="h-page">Lessons</h1>
      <p className="lede measure">Each lesson is a short story told with real packets. Press play and watch, or step through at your own pace. Your place is saved as you go.</p>

      <div className="filters" role="group" aria-label="Show lessons">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} <span className="chip-n">{counts[k]}</span>
          </button>
        ))}
      </div>

      {counts[filter] === 0 && (
        <div className="empty-state">
          <p>{filter === 'done' ? 'You haven\'t finished a lesson yet. Finish one and it will be listed here.' : filter === 'going' ? 'Nothing in progress. Start any lesson and you can pick it up here later.' : 'Every lesson has been started.'}</p>
          <button className="btn" onClick={() => setFilter('all')}>Show all lessons</button>
        </div>
      )}

      {LAYER_ORDER.map((n) => {
        const list = byLayer(n).filter((L) => filter === 'all' || lessonStatus(s, L).state === filter);
        if (!list.length) return null;
        const Ly = LAYERS[n];
        return (
          <section key={n} className="layer-group" style={{ '--lc': Ly.color }} aria-labelledby={`lg-${n}`}>
            <header className="layer-group-head">
              <span className="route-n">{n}</span>
              <div>
                <h2 id={`lg-${n}`} className="h-sub">{Ly.name}</h2>
                <p className="muted">{Ly.job}</p>
              </div>
              <a className="link-quiet" href={href.study(n)}>Study guide</a>
            </header>
            <ul className="lesson-rows">
              {list.map((L) => {
                const st = lessonStatus(s, L);
                return (
                  <li key={L.id} className="lesson-row">
                    <StatusMark state={st.state} pct={st.pct} color={Ly.color} />
                    <div className="lesson-row-main">
                      <h3><a href={href.lesson(L.id)}>{L.name}</a></h3>
                      <p>{L.tag}</p>
                      <p className="muted small">
                        {plural(L.steps.length, 'step')}, {plural(L.packets.length, 'packet')}, about {minutes(L)} minutes
                        {st.p?.quiz >= 0 && `. Best quiz score ${st.p.quiz} of ${L.quiz.length}`}
                      </p>
                    </div>
                    <a className={`btn ${st.state === 'going' ? 'primary' : ''}`} href={href.lesson(L.id)} aria-label={`${ACTION[st.state]} ${L.name}`}>{ACTION[st.state]}</a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
