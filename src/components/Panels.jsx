import { useEffect, useState } from 'react';
import { LAYERS } from '../data/layers.js';
import { KIND, longestPath, holdText } from '../lib/util.js';
import { fmtSize } from '../lib/packet.js';

const Facts = ({ rows }) => (
  <dl className="facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
);

export function SidePanel({ scn, stepIdx, sent, mode, setMode, onJumpStep, onInspect, finished, best, onQuizDone, nextLesson }) {
  const L = LAYERS[scn.layer];
  if (mode === 'quiz') return <Quiz scn={scn} onBack={() => setMode('auto')} onDone={onQuizDone} best={best} nextLesson={nextLesson} />;

  if (stepIdx < 0 || mode === 'overview') {
    return (
      <div className="notes-body">
        <p className="notes-k">About this lesson</p>
        <h2 className="h-sub">{scn.full}</h2>
        <p>{scn.summary}</p>
        <div className="layer-note" style={{ '--lc': L.color }}>
          <p><b>Layer {L.n}, {L.name}.</b> {L.job}</p>
          <p className="muted">Think of it as {L.analogy.charAt(0).toLowerCase() + L.analogy.slice(1)}</p>
        </div>
        {scn.keyIdeas && (
          <>
            <h3 className="h-mini">You'll learn</h3>
            <ul className="ideas">{scn.keyIdeas.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </>
        )}
        <h3 className="h-mini">Quick facts</h3>
        <Facts rows={scn.facts} />
        {stepIdx < 0
          ? <button className="btn primary wide" onClick={() => onJumpStep(0)}>Start step 1</button>
          : <button className="btn wide" onClick={() => setMode('auto')}>Back to step {stepIdx + 1}</button>}
        {best >= 0 && <p className="muted small">Best quiz score: {best} of {scn.quiz.length}. <button className="link-btn" onClick={() => setMode('quiz')}>Retake the quiz</button></p>}
      </div>
    );
  }

  const step = scn.steps[stepIdx];
  const stepPk = sent.filter((p) => p.step === stepIdx);
  return (
    <div className="notes-body">
      <p className="notes-k">Step {stepIdx + 1} of {scn.steps.length}</p>
      <h2 className="h-sub">{step.title}</h2>
      <p className="notes-lead">{step.sub}</p>
      <p>{step.text}</p>
      {stepPk.map((p) => (
        <button key={p.no} className="callout" style={{ '--kc': KIND[p.kind] }} onClick={() => onInspect(p.no)}>
          <span className="callout-top"><span className="tag">{p.label}</span>{scn.nodes[p.from].label} to {[].concat(p.to).map((t) => scn.nodes[t].label).join(' and ')}</span>
          <span className="callout-msg">{p.note}</span>
          <span className="callout-meta">Packet {p.no} of {scn.packets.length}, {p.proto}, {fmtSize(p.frame.size)}{p.lost ? ', lost' : ''}. Open it</span>
        </button>
      ))}
      {stepPk.length > 0 && (() => {
        const p = stepPk[stepPk.length - 1];
        const path = longestPath(scn, p);
        return (
          <div className="journey-note">
            <h3 className="h-mini">How packet {p.no} travels</h3>
            <ol className="hop-list">
              {path.map((n, i) => (
                <li key={n + i}>
                  <b>{scn.nodes[n].label}</b>
                  {i === 0 && <span> sends it.</span>}
                  {i > 0 && i < path.length - 1 && <span>: {holdText(scn, p, n).replace(/^[^:]+:\s*/, '')}</span>}
                  {i === path.length - 1 && <span>{p.lost ? ' never receives it: it was lost on the way.' : ' receives it.'}</span>}
                </li>
              ))}
            </ol>
          </div>
        );
      })()}
      {step.deep && (
        <details className="deep" key={`${scn.id}-${stepIdx}`}>
          <summary>Go deeper</summary>
          <div>{[].concat(step.deep).map((d, i) => <p key={i}>{d}</p>)}</div>
        </details>
      )}
      <Facts rows={step.facts} />
      {step.macTable && (
        <>
          <h3 className="h-mini">Switch MAC table</h3>
          <table className="mini"><thead><tr><th>MAC address</th><th>Port</th></tr></thead>
            <tbody>{step.macTable.map(([m, pt]) => <tr key={m} className="flash"><td className="mono">{m}</td><td>{pt}</td></tr>)}</tbody></table>
        </>
      )}
      {finished && (
        <div className="finish">
          <p><b>You've reached the end of this lesson.</b> Three quick questions lock it in, and they come back later in Review.</p>
          <button className="btn primary wide" onClick={() => setMode('quiz')}>Take the quiz</button>
        </div>
      )}
    </div>
  );
}

function Quiz({ scn, onBack, onDone, best, nextLesson }) {
  const [ans, setAns] = useState({});
  const total = scn.quiz.length;
  const done = Object.keys(ans).length === total;
  const score = scn.quiz.filter((q, i) => ans[i] === q.answer).length;
  const pick = (i, o) => setAns((prev) => (prev[i] != null ? prev : { ...prev, [i]: o }));
  useEffect(() => { if (done) onDone(scn.quiz.map((_, i) => ans[i])); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="notes-body">
      <p className="notes-k">Quiz: {scn.name}</p>
      <h2 className="h-sub">Check your understanding</h2>
      {done && <p className="score">{score} of {total} correct{score === total ? '. Perfect.' : '.'}</p>}
      {scn.quiz.map((q, i) => (
        <fieldset key={i} className="quiz-q">
          <legend>{i + 1}. {q.q}</legend>
          {q.options.map((o, j) => {
            const cls = ans[i] == null ? '' : j === q.answer ? 'right' : ans[i] === j ? 'wrong' : 'dim';
            return <button key={j} className={cls} disabled={ans[i] != null} onClick={() => pick(i, j)}>{o}</button>;
          })}
          {ans[i] != null && <p className={`why ${ans[i] === q.answer ? 'good' : 'bad'}`}>{ans[i] === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}</p>}
        </fieldset>
      ))}
      {done && (
        <div className="row">
          <button className="btn" onClick={() => setAns({})}>Try again</button>
          {nextLesson && <a className="btn primary" href={`#/lesson/${nextLesson.id}`}>Next lesson: {nextLesson.name}</a>}
        </div>
      )}
      {done && <p className="muted small">These questions are now in your Review deck and will come back in a day or two.</p>}
      {!done && best >= 0 && <p className="muted small">Your best so far: {best} of {total}.</p>}
      <button className="link-btn" onClick={onBack}>Back to the lesson</button>
    </div>
  );
}

export function PacketTable({ scn, sent, onInspect, srcOf, dstOf }) {
  const latest = sent.length ? sent[sent.length - 1].no : -1;
  if (!sent.length) return <p className="empty">No packets yet. Press Next to send the first one.</p>;
  return (
    <table className="pk">
      <thead><tr><th>#</th><th>Time</th><th>From</th><th>To</th><th>Protocol</th><th>What it says</th><th>Size</th></tr></thead>
      <tbody>
        {sent.map((p) => (
          <tr key={p.no} className={`${p.no === latest ? 'latest' : ''} ${p.lost ? 'lost' : ''}`} onClick={() => onInspect(p.no)} style={{ '--kc': KIND[p.kind] }}
            tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect(p.no); } }} aria-label={`Packet ${p.no}: ${p.info}. Press Enter to inspect`}>
            <td><span className="no">{p.no}</span></td>
            <td className="mono">{p.t.toFixed(3)}s</td>
            <td className="mono">{srcOf(p)}</td>
            <td className="mono">{dstOf(p)}</td>
            <td>{p.proto}</td>
            <td className="info">{p.info}</td>
            <td className="mono">{fmtSize(p.frame.size)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
