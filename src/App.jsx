import { useCallback, useEffect, useMemo, useState } from 'react';
import { SCENARIOS, byId, byLayer } from './data/scenarios/index.js';
import { LAYERS } from './data/layers.js';
import { KIND, loadJSON, saveJSON } from './lib/util.js';
import NetworkView from './components/NetworkView.jsx';
import SequenceView from './components/SequenceView.jsx';
import StackView from './components/StackView.jsx';
import Inspector from './components/Inspector.jsx';
import { SidePanel, PacketTable, Drawer } from './components/Panels.jsx';
import LabView from './labs/index.jsx';

const SPEEDS = [0.5, 1, 2];
const VIEWS = [['network', '◈ Network'], ['sequence', '⇅ Sequence'], ['stack', '☰ Encapsulation'], ['lab', '⚗ Lab']];

function buildTimeline(scn) {
  const t = [];
  let sent = 0;
  scn.steps.forEach((st, si) => {
    t.push({ step: si, sent, pkt: null });
    st.packets.forEach((p) => { sent++; t.push({ step: si, sent, pkt: p }); });
  });
  return t;
}

export default function App() {
  const [sid, setSid] = useState(() => (byId[loadJSON('osi.sid', 'http')] ? loadJSON('osi.sid', 'http') : 'http'));
  const scn = byId[sid];
  const timeline = useMemo(() => buildTimeline(scn), [scn]);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState('network');
  const [labLayer, setLabLayer] = useState(scn.layer);
  const [panelMode, setPanelMode] = useState('auto');
  const [insp, setInsp] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState(() => loadJSON('osi.theme', 'dark'));
  const [progress, setProgress] = useState(() => loadJSON('osi.progress', { done: {}, quiz: {} }));

  useEffect(() => { document.documentElement.dataset.theme = theme; saveJSON('osi.theme', theme); }, [theme]);
  useEffect(() => { saveJSON('osi.sid', sid); }, [sid]);
  useEffect(() => { saveJSON('osi.progress', progress); }, [progress]);

  const entry = cursor >= 0 ? timeline[cursor] : null;
  const stepIdx = entry ? entry.step : -1;
  const sent = scn.packets.slice(0, entry ? entry.sent : 0);
  const latest = entry?.pkt || null;
  const animKey = `${sid}-${cursor}`;
  const finished = cursor === timeline.length - 1;
  const lastSent = sent[sent.length - 1] || null;

  const visible = useMemo(() => {
    if (stepIdx < 0) return new Set(Object.keys(scn.nodes));
    const v = new Set();
    for (let i = 0; i <= stepIdx; i++) scn.steps[i].show.forEach((n) => v.add(n));
    return v;
  }, [scn, stepIdx]);

  const advance = useCallback(() => {
    setPanelMode((m) => (m === 'quiz' ? m : 'auto'));
    setCursor((c) => Math.min(c + 1, timeline.length - 1));
  }, [timeline.length]);
  const back = () => { setPlaying(false); setCursor((c) => Math.max(-1, c - 1)); };
  const reset = () => { setPlaying(false); setCursor(-1); setPanelMode('auto'); };

  useEffect(() => {
    if (finished && !progress.done[sid]) setProgress((p) => ({ ...p, done: { ...p.done, [sid]: true } }));
    if (finished) setPlaying(false);
  }, [finished, sid, progress.done]);

  useEffect(() => {
    if (!playing) return;
    const delay = (entry?.pkt ? 1700 : 2400) / speed;
    const id = setTimeout(advance, cursor < 0 ? 200 : delay);
    return () => clearTimeout(id);
  }, [playing, cursor, speed, advance, entry]);

  const pick = (id) => {
    setSid(id); setCursor(-1); setPlaying(false); setPanelMode('auto'); setDrawer(false); setInsp(null);
    setLabLayer(byId[id].layer);
  };
  const jumpStep = (i) => {
    setPlaying(false); setPanelMode('auto'); setDrawer(false);
    setCursor(timeline.findIndex((e) => e.step === i && !e.pkt));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (insp != null || drawer || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [insp, drawer, advance]);

  const firstSub = (id) => (scn.nodes[id].sub || '').split('\n')[0].split(' | ')[0] || scn.nodes[id].label;
  const srcOf = (p) => p.src ?? firstSub(p.from);
  const dstOf = (p) => p.dst ?? (Array.isArray(p.to) ? 'Broadcast' : firstSub(p.to));

  const L = LAYERS[scn.layer];
  const doneCount = SCENARIOS.filter((s) => progress.done[s.id]).length;
  const pct = Math.round(((doneCount + (progress.done[sid] ? 0 : Math.max(0, cursor + 1) / timeline.length)) / SCENARIOS.length) * 100);
  const nextScn = SCENARIOS[SCENARIOS.indexOf(scn) + 1];

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn" onClick={() => setDrawer(true)}>☰ Lessons</button>
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            {[7, 6, 5, 4, 3, 2, 1].map((n) => <span key={n} style={{ background: LAYERS[n].color }} />)}
          </div>
          <div>
            <h1>OSI <em>EXPLORER</em></h1>
            <p>Seven layers · one packet at a time</p>
          </div>
        </div>
        <button className="btn icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
      </header>

      <section className="subbar">
        <div className="now">
          <div className="kicker">Now learning</div>
          <h2>{scn.name.toUpperCase()} · {scn.tag.toUpperCase()}</h2>
          <div className="step-dots">
            {scn.steps.map((_, i) => <i key={i} className={i < stepIdx || (finished && i === stepIdx) ? 'done' : i === stepIdx ? 'on' : ''} />)}
            <b>{stepIdx < 0 ? `Overview · ${scn.steps.length} steps` : `Step ${stepIdx + 1}/${scn.steps.length} · ${scn.steps[stepIdx].title}`}</b>
          </div>
        </div>
        <div style={{ '--lc': L.color }}>
          <div className="layer-head"><span className="kicker">OSI layer</span><span className="kicker">{L.name}</span></div>
          <div className="layer-pills">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} className={`layer-pill ${n === scn.layer ? 'on' : ''}`} style={{ '--lc': LAYERS[n].color }} title={`Layer ${n}: ${LAYERS[n].name}`}
                onClick={() => pick(byLayer(n)[0].id)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="progress">
          <div className="row"><span className="kicker">Learning progress</span><span className="pct">{pct}%</span></div>
          <div className="bar">{SCENARIOS.map((s) => <i key={s.id} title={s.name} className={progress.done[s.id] ? 'done' : s.id === sid ? 'cur' : ''} />)}</div>
          <small>{doneCount} / {SCENARIOS.length} lessons complete · {Object.keys(progress.quiz).length} quizzes taken</small>
        </div>
      </section>

      <main className={`main ${view === 'lab' ? 'lab-mode' : ''}`}>
        <div className="card stage">
          <div className="tabs" role="tablist">
            {VIEWS.map(([k, label]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{label}</button>)}
          </div>
          <div className="stage-body">
            {view === 'network' && <NetworkView scn={scn} visible={visible} latest={latest} animKey={animKey} speed={speed} onInspect={setInsp} />}
            {view === 'sequence' && <SequenceView scn={scn} stepIdx={stepIdx} sent={sent} animKey={animKey} speed={speed} onInspect={setInsp} />}
            {view === 'stack' && <StackView scn={scn} packet={lastSent} animKey={`${sid}-${lastSent?.no}`} speed={speed} onInspect={setInsp} />}
            {view === 'lab' && <LabView layer={labLayer} setLayer={setLabLayer} />}
          </div>
          {view === 'network' && <div className="stage-hint">Click a moving packet to inspect it · Space = play · → = step</div>}
        </div>

        <aside className="card side">
          <SidePanel scn={scn} stepIdx={stepIdx} sent={sent} mode={panelMode} setMode={setPanelMode} onJumpStep={jumpStep} onInspect={setInsp}
            finished={finished} quizScore={progress.quiz[sid]} onNext={nextScn ? () => pick(nextScn.id) : null}
            onQuizDone={(score) => setProgress((p) => ({ ...p, quiz: { ...p.quiz, [sid]: Math.max(score, p.quiz[sid] ?? 0) } }))} />
        </aside>

        <section className="card flow">
          <div className="flow-head">
            <h3>PACKET FLOW</h3>
            <div className="legend">{scn.legend.map((l) => <span key={l.kind}><i style={{ background: KIND[l.kind] }} />{l.label}</span>)}</div>
            <div className="controls">
              <button className="btn sm" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} title="Playback speed">{speed}×</button>
              <button className="btn sm" onClick={back} disabled={cursor < 0} aria-label="Step back">‹</button>
              <button className="btn sm primary" onClick={() => (finished ? (reset(), setPlaying(true)) : setPlaying(!playing))}>{playing ? '❚❚ Pause' : finished ? '↻ Replay' : '▶ Play'}</button>
              <button className="btn sm" onClick={() => { setPlaying(false); advance(); }} disabled={finished}>Step ›</button>
              <button className="btn sm" onClick={reset} aria-label="Reset">↺</button>
            </div>
          </div>
          <div className="flow-table">
            <PacketTable scn={scn} sent={sent} onInspect={setInsp} srcOf={srcOf} dstOf={dstOf} />
          </div>
        </section>
      </main>
      <footer className="credit">Learning model inspired by <a href="https://protocol-explorer-alpha.vercel.app/" target="_blank" rel="noreferrer">Protocol Explorer</a> · addresses use documentation ranges</footer>

      {drawer && <Drawer current={sid} progress={progress} onPick={pick} onPickStep={jumpStep} onClose={() => setDrawer(false)} />}
      {insp != null && <Inspector scn={scn} no={insp} maxNo={sent.length || scn.packets.length} onNav={setInsp} onClose={() => setInsp(null)} srcOf={srcOf} dstOf={dstOf} />}
    </div>
  );
}
