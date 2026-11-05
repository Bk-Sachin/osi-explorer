import { useEffect, useState } from 'react';
import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { SCENARIOS } from '../data/scenarios/index.js';
import { KIND } from '../lib/util.js';
import { fmtSize } from '../lib/packet.js';

const Facts = ({ rows }) => (
  <table className="facts"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
);

export function SidePanel({ scn, stepIdx, sent, mode, setMode, onJumpStep, onInspect, finished, quizScore, onQuizDone, onNext }) {
  const L = LAYERS[scn.layer];
  if (mode === 'quiz') return <Quiz scn={scn} onBack={() => setMode('auto')} onDone={onQuizDone} best={quizScore} onNext={onNext} />;

  if (stepIdx < 0 || mode === 'overview') {
    return (
      <>
        <div className="side-head">
          <h3>Overview</h3>
          {stepIdx >= 0 && <button className="btn sm" onClick={() => setMode('auto')}>Step ›</button>}
        </div>
        <div className="side-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{scn.name}</h2>
            <span className="badge" style={{ '--lc': L.color }}>Layer {scn.layer}</span>
          </div>
          <p className="lead">{scn.full}</p>
          <p className="text">{scn.summary}</p>
          <div className="layer-box" style={{ '--lc': L.color }}>
            <h5>Layer {L.n} · {L.name} · PDU: {L.pdu}</h5>
            <p>{L.job}</p>
            <p>Think of it as: {L.analogy}</p>
          </div>
          {scn.keyIdeas && (
            <div className="panel-box" style={{ marginTop: 0, marginBottom: 12 }}>
              <h5>Key ideas you'll learn</h5>
              <ul className="ideas">{scn.keyIdeas.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </div>
          )}
          <Facts rows={scn.facts} />
          <div className="kicker">Steps</div>
          <ul className="steps-list">
            {scn.steps.map((s, i) => (
              <li key={i}>
                <button onClick={() => onJumpStep(i)}>
                  <span className="num">{i + 1}</span>
                  <span><b>{s.title}</b><small>{s.sub}</small></span>
                </button>
              </li>
            ))}
          </ul>
          {quizScore != null && <p style={{ color: 'var(--muted)', fontSize: 11 }}>Best quiz score: {quizScore}/{scn.quiz.length}</p>}
        </div>
      </>
    );
  }

  const step = scn.steps[stepIdx];
  const stepPk = sent.filter((p) => p.step === stepIdx);
  return (
    <>
      <div className="side-head">
        <h3>Step details</h3>
        <button className="btn sm" onClick={() => setMode('overview')}>‹ Overview</button>
      </div>
      <div className="side-body">
        <div className="kicker" style={{ color: 'var(--accent)' }}>Step {stepIdx + 1} of {scn.steps.length}</div>
        <h2>{step.title}</h2>
        <p className="lead">{step.sub}</p>
        <p className="text">{step.text}</p>
        {step.deep && (
          <details className="deep" key={`${scn.id}-${stepIdx}`}>
            <summary>Deep dive</summary>
            <div>{[].concat(step.deep).map((d, i) => <p key={i}>{d}</p>)}</div>
          </details>
        )}
        {stepPk.map((p) => (
          <button key={p.no} className="callout" style={{ '--kc': KIND[p.kind] }} onClick={() => onInspect(p.no)}>
            <div className="top"><span className="tag">{p.label}</span>{scn.nodes[p.from].label} → {[].concat(p.to).map((t) => scn.nodes[t].label).join(', ')}</div>
            <div className="msg">{p.note}</div>
            <small>Packet {p.no} of {scn.packets.length} · {p.proto} · {fmtSize(p.frame.size)} {p.lost ? '· LOST' : ''} · inspect ›</small>
          </button>
        ))}
        <Facts rows={step.facts} />
        {step.macTable && (
          <>
            <div className="kicker">Switch MAC table</div>
            <table className="mini" style={{ marginTop: 6 }}>
              <thead><tr><th>MAC address</th><th>Port</th></tr></thead>
              <tbody>{step.macTable.map(([m, pt]) => <tr key={m} className="flash"><td>{m}</td><td>{pt}</td></tr>)}</tbody>
            </table>
          </>
        )}
        {finished && (
          <button className="btn primary cta" onClick={() => setMode('quiz')}>✓ Check your understanding</button>
        )}
      </div>
    </>
  );
}

function Quiz({ scn, onBack, onDone, best, onNext }) {
  const [ans, setAns] = useState({});
  const done = Object.keys(ans).length === scn.quiz.length;
  const score = scn.quiz.filter((q, i) => ans[i] === q.answer).length;
  const pick = (i, o) => setAns((prev) => (prev[i] != null ? prev : { ...prev, [i]: o }));
  useEffect(() => { if (done) onDone(score); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="side-head">
        <h3>Quiz</h3>
        <button className="btn sm" onClick={onBack}>‹ Back</button>
      </div>
      <div className="side-body">
        <div className="kicker">Check your understanding · {scn.name}</div>
        {done && <div className="score">{score === scn.quiz.length ? '🎉 ' : ''}{score} / {scn.quiz.length} correct</div>}
        {scn.quiz.map((q, i) => (
          <div key={i} className="quiz-q">
            <p>{i + 1}. {q.q}</p>
            {q.options.map((o, j) => {
              const cls = ans[i] == null ? '' : j === q.answer ? 'right' : ans[i] === j ? 'wrong' : '';
              return <button key={j} className={cls} disabled={ans[i] != null} onClick={() => pick(i, j)}>{o}</button>;
            })}
            {ans[i] != null && <div className="why">{ans[i] === q.answer ? '✓ ' : '✗ '}{q.why}</div>}
          </div>
        ))}
        {done && (
          <div className="row">
            <button className="btn" onClick={() => setAns({})}>Retry</button>
            {onNext && <button className="btn primary" onClick={onNext}>Next lesson ›</button>}
          </div>
        )}
        {best != null && !done && <p style={{ color: 'var(--muted)', fontSize: 11 }}>Previous best: {best}/{scn.quiz.length}</p>}
      </div>
    </>
  );
}

export function PacketTable({ scn, sent, onInspect, srcOf, dstOf }) {
  const latest = sent.length ? sent[sent.length - 1].no : -1;
  if (!sent.length) return <div className="empty">No packets on the wire yet. Press STEP to send the first one.</div>;
  return (
    <table className="pk">
      <thead><tr><th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Info</th><th>Size</th></tr></thead>
      <tbody>
        {sent.map((p) => (
          <tr key={p.no} className={`${p.no === latest ? 'latest' : ''} ${p.lost ? 'lost' : ''}`} onClick={() => onInspect(p.no)} style={{ '--kc': KIND[p.kind] }}>
            <td><span className="no">{p.no}</span></td>
            <td>{p.t.toFixed(3)}s</td>
            <td>{srcOf(p)}</td>
            <td>{dstOf(p)}</td>
            <td>{p.proto}</td>
            <td className="info">{p.info}</td>
            <td>{fmtSize(p.frame.size)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Drawer({ current, progress, onPick, onPickStep, onClose }) {
  const [filter, setFilter] = useState('all');
  const layers = filter === 'all' ? LAYER_ORDER : [filter];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Lessons">
        <div className="drawer-head">
          <h3>OSI LESSONS</h3>
          <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-filter">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All {SCENARIOS.length}</button>
          {LAYER_ORDER.map((n) => (
            <button key={n} className={filter === n ? 'on' : ''} onClick={() => setFilter(n)} style={{ color: filter === n ? undefined : LAYERS[n].color }}>L{n}</button>
          ))}
        </div>
        <div className="drawer-body">
          {layers.map((n) => {
            const L = LAYERS[n];
            return (
              <div key={n} style={{ '--lc': L.color }}>
                <div className="drawer-layer"><b>{n} · {L.name}</b><small>{L.examples}</small></div>
                {SCENARIOS.filter((s) => s.layer === n).map((s) => (
                  <div key={s.id}>
                    <button className={`proto-item ${s.id === current ? 'on' : ''}`} onClick={() => onPick(s.id)}>
                      <span><b>{s.name}</b><small>{s.tag}</small></span>
                      <span className="st">{progress.done[s.id] ? '✓ done' : ''}{progress.quiz[s.id] != null ? ` · ${progress.quiz[s.id]}/${s.quiz.length}` : ''}</span>
                    </button>
                    {s.id === current && (
                      <div className="drawer-steps">
                        {s.steps.map((st, i) => <button key={i} onClick={() => onPickStep(i)}>{i + 1}. {st.title}</button>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
