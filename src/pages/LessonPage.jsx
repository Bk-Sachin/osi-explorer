import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS } from '../data/scenarios/index.js';
import { LAYERS } from '../data/layers.js';
import { KIND, journey, wordsMs } from '../lib/util.js';
import { useStore, store } from '../lib/progress.js';
import { href, session } from '../lib/router.js';
import NetworkView from '../components/NetworkView.jsx';
import SequenceView from '../components/SequenceView.jsx';
import StackView, { STACK_TOTAL } from '../components/StackView.jsx';
import Inspector from '../components/Inspector.jsx';
import StudyView from '../components/StudyView.jsx';
import LabView from '../labs/index.jsx';
import { SidePanel, PacketTable } from '../components/Panels.jsx';
import { minutes } from '../components/Bits.jsx';

const SPEEDS = ['0.5', '0.75', '1', '1.5', '2'];
const VIEWS = [['network', 'Network'], ['sequence', 'Timeline'], ['stack', 'Layers'], ['lab', 'Lab'], ['study', 'Study']];

function buildTimeline(L) {
  const t = [];
  let sent = 0;
  L.steps.forEach((st, si) => {
    t.push({ step: si, sent, pkt: null });
    st.packets.forEach((p) => { sent++; t.push({ step: si, sent, pkt: p }); });
  });
  return t;
}

export default function LessonPage({ L }) {
  const s = useStore();
  const saved = s.lessons[L.id];
  const timeline = useMemo(() => buildTimeline(L), [L]);
  // resume where you left off; a finished lesson opens on its overview
  const [cursor, setCursor] = useState(() => (saved && !saved.done ? Math.min(saved.cursor, timeline.length - 1) : -1));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedRaw] = useState(() => (SPEEDS.includes(session.get('speed')) ? +session.get('speed') : 1));
  const [view, setViewRaw] = useState(() => (VIEWS.some(([k]) => k === session.get('view')) ? session.get('view') : 'network'));
  const [panelMode, setPanelMode] = useState('auto');
  const [insp, setInsp] = useState(null);
  const [replay, setReplay] = useState(0);
  const [aux, setAux] = useState(L.layer); // layer shown in Lab / Study tabs
  const [frozen, setFrozen] = useState(false); // Pause freezes the animation itself
  const setSpeed = (v) => { setSpeedRaw(v); session.set('speed', v); };
  const setView = (v) => { setViewRaw(v); session.set('view', v); };

  const entry = cursor >= 0 ? timeline[cursor] : null;
  const stepIdx = entry ? entry.step : -1;
  const sent = L.packets.slice(0, entry ? entry.sent : 0);
  const latest = entry?.pkt || null;
  const lastSent = sent[sent.length - 1] || null;
  const finished = cursor === timeline.length - 1;
  const animKey = `${L.id}-${cursor}-${replay}`;
  const Ly = LAYERS[L.layer];
  const idx = SCENARIOS.indexOf(L);
  const nextLesson = SCENARIOS[idx + 1];

  useEffect(() => { if (cursor >= 0) store.setCursor(L.id, cursor, timeline.length); }, [cursor, L.id, timeline.length]);
  useEffect(() => { document.title = `${L.name}: ${L.tag} | OSI Explorer`; return () => { document.title = 'OSI Explorer'; }; }, [L]);

  const visible = useMemo(() => {
    if (stepIdx < 0) return new Set(Object.keys(L.nodes));
    const v = new Set();
    for (let i = 0; i <= stepIdx; i++) L.steps[i].show.forEach((n) => v.add(n));
    return v;
  }, [L, stepIdx]);

  const advance = useCallback(() => {
    setPanelMode((m) => (m === 'quiz' ? m : 'auto'));
    setCursor((c) => Math.min(c + 1, timeline.length - 1));
  }, [timeline.length]);
  // Any manual move un-freezes the animation; only Pause freezes it.
  const next = () => { setPlaying(false); setFrozen(false); advance(); };
  const back = () => { setPlaying(false); setFrozen(false); setPanelMode('auto'); setCursor((c) => Math.max(-1, c - 1)); };
  const restart = () => { setPlaying(false); setFrozen(false); setCursor(-1); setPanelMode('auto'); };
  const jumpStep = (i) => { setPlaying(false); setFrozen(false); setPanelMode('auto'); setCursor(timeline.findIndex((e) => e.step === i && !e.pkt)); };
  // Is a packet animation still running? (accounts for pauses and speed)
  const animLen = !latest ? 0 : view === 'stack' ? STACK_TOTAL : view === 'sequence' ? journey(L, latest).travel : journey(L, latest).total + 900;
  const [animDone, setAnimDone] = useState(true);
  const animWaited = useRef(0);
  useEffect(() => { animWaited.current = 0; setAnimDone(!latest); }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!latest || frozen || animDone) return;
    const t0 = performance.now();
    const id = setTimeout(() => setAnimDone(true), Math.max(0, animLen - animWaited.current) / speed);
    return () => { clearTimeout(id); animWaited.current += (performance.now() - t0) * speed; };
  }, [animKey, frozen, speed, animLen, latest, animDone]);
  const moving = playing || (!animDone && !frozen);

  // Pause stops whatever is moving: the packet animation and/or autoplay. Resume continues both.
  const resumeAutoplay = useRef(false);
  const pause = () => { resumeAutoplay.current = playing; setPlaying(false); setFrozen(true); };
  const resume = () => { setFrozen(false); if (resumeAutoplay.current) setPlaying(true); };
  const play = () => {
    if (finished) { setCursor(-1); setPanelMode('auto'); }
    setFrozen(false); setPlaying(true);
  };
  const togglePlay = () => (frozen ? resume() : moving ? pause() : play());
  const togglePlayRef = useRef(togglePlay); togglePlayRef.current = togglePlay;
  const nextRef = useRef(next); nextRef.current = () => { if (!finished) next(); };
  const backRef = useRef(back); backRef.current = back;

  useEffect(() => { if (finished) setPlaying(false); }, [finished]);

  // Autoplay: wait for the packet's whole journey (or long enough to read a new step),
  // remembering how much of that wait has already passed so Pause → Play resumes, not restarts.
  const waited = useRef(0);
  useEffect(() => { waited.current = 0; }, [animKey]);
  useEffect(() => {
    if (!playing || frozen) return;
    const target = cursor < 0 ? 300 : entry?.pkt ? journey(L, entry.pkt).total + 3500 : wordsMs(L.steps[entry.step].text);
    const t0 = performance.now();
    const id = setTimeout(advance, Math.max(0, target - waited.current) / speed);
    return () => { clearTimeout(id); waited.current += (performance.now() - t0) * speed; };
  }, [playing, frozen, animKey, speed, advance, entry, L, cursor]);

  useEffect(() => {
    const onKey = (e) => {
      if (insp != null || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(e.target.tagName) || e.target.closest?.('[role="tablist"]')) return;
      if (e.key === ' ') { e.preventDefault(); togglePlayRef.current(); }
      if (e.key === 'ArrowRight') nextRef.current();
      if (e.key === 'ArrowLeft') backRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [insp]);

  const firstSub = (id) => (L.nodes[id].sub || '').split('\n')[0].split(' | ')[0] || L.nodes[id].label;
  const srcOf = (p) => p.src ?? firstSub(p.from);
  const dstOf = (p) => p.dst ?? (Array.isArray(p.to) ? 'Broadcast' : firstSub(p.to));
  const pct = (cursor + 1) / timeline.length;
  const stepsDone = (i) => (finished ? true : i < stepIdx) || (saved?.done ?? false);

  return (
    <main className="lesson" style={{ '--lc': Ly.color }}>
      <header className="lesson-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href={href.lessons}>Lessons</a><span aria-hidden="true">/</span><a href={href.study(L.layer)}>Layer {L.layer}, {Ly.name}</a>
        </nav>
        <div className="lesson-title">
          <h1 className="h-lesson">{L.name}</h1>
          <p>{L.tag}. About {minutes(L)} minutes.</p>
        </div>
        <div className="lesson-progress" aria-label={`${Math.round(Math.max(0, pct) * 100)}% through this lesson`}>
          <div className="meter"><i style={{ width: `${Math.max(0, pct) * 100}%` }} /></div>
          <span className="muted small">{cursor < 0 ? (saved?.done ? 'Finished. Replay any step' : 'Not started') : `Step ${stepIdx + 1} of ${L.steps.length}`}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail" aria-label="Steps">
          <ol className="rail-steps">
            <li><button className={`rail-item ${stepIdx < 0 && panelMode !== 'quiz' ? 'cur' : ''}`} onClick={() => { setPlaying(false); setFrozen(false); setCursor(-1); setPanelMode('overview'); }}><span className="rail-n">i</span><span>Overview</span></button></li>
            {L.steps.map((st, i) => (
              <li key={i}>
                <button className={`rail-item ${i === stepIdx && panelMode !== 'quiz' && panelMode !== 'overview' ? 'cur' : ''} ${stepsDone(i) ? 'done' : ''}`} onClick={() => jumpStep(i)} aria-current={i === stepIdx ? 'step' : undefined}>
                  <span className="rail-n">{stepsDone(i) && i !== stepIdx ? '✓' : i + 1}</span>
                  <span><b>{st.title}</b><small>{st.sub}</small></span>
                </button>
              </li>
            ))}
            <li><button className={`rail-item ${panelMode === 'quiz' ? 'cur' : ''} ${saved?.quiz >= 0 ? 'done' : ''}`} onClick={() => setPanelMode('quiz')}><span className="rail-n">?</span><span><b>Quiz</b><small>{saved?.quiz >= 0 ? `Best ${saved.quiz} of ${L.quiz.length}` : `${L.quiz.length} questions`}</small></span></button></li>
          </ol>
        </aside>

        <section className="center">
          <div className="stage">
            <div className="tabs" role="tablist" aria-label="Views">
              {VIEWS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{label}</button>
              ))}
            </div>
            {(view === 'network' || view === 'stack' || view === 'sequence') && lastSent && (
              <button className="btn sm replay" onClick={() => { setFrozen(false); setReplay((r) => r + 1); }}>Replay packet</button>
            )}
            <div className={`stage-body view-${view}`}>
              {view === 'network' && <NetworkView scn={L} visible={visible} latest={latest} animKey={animKey} speed={speed} paused={frozen} onInspect={setInsp} />}
              {view === 'sequence' && <SequenceView scn={L} stepIdx={stepIdx} sent={sent} animKey={animKey} speed={speed} paused={frozen} onInspect={setInsp} freshPacket={!!latest} />}
              {view === 'stack' && <StackView scn={L} packet={lastSent} animKey={`${L.id}-${lastSent?.no}-${replay}`} speed={speed} paused={frozen} onInspect={setInsp} />}
              {view === 'lab' && <LabView layer={aux} setLayer={setAux} />}
              {view === 'study' && <StudyView layer={aux} setLayer={setAux} onPick={(id) => { location.hash = href.lesson(id); }} />}
            </div>
          </div>

          <div className="controls" role="group" aria-label="Playback">
            <button className="btn" onClick={back} disabled={cursor < 0}>Back</button>
            <button className="btn primary play" onClick={togglePlay} aria-pressed={moving}>
              {frozen ? 'Resume' : moving ? 'Pause' : finished ? 'Play again' : cursor < 0 ? 'Play lesson' : 'Play'}
            </button>
            <button className="btn next" onClick={next} disabled={finished}>
              {cursor < 0 ? 'Start' : entry && !entry.pkt && L.steps[entry.step].packets.length ? 'Send packet' : 'Next'}
            </button>
            <label className="speed">Speed
              <select value={String(speed)} onChange={(e) => setSpeed(+e.target.value)}>
                {SPEEDS.map((v) => <option key={v} value={v}>{v}×</option>)}
              </select>
            </label>
            <button className="link-btn" onClick={restart}>Restart</button>
            <span className="kbd-hint muted small">{frozen ? 'Paused. Read at your own pace, then press Resume.' : 'Space plays or pauses. Arrow keys step.'}</span>
          </div>

          <section className="pktlog" aria-label="Packets sent so far">
            <div className="pktlog-head">
              <h2 className="h-mini">Packets on the wire</h2>
              <ul className="legend">{L.legend.map((l) => <li key={l.kind}><i style={{ background: KIND[l.kind] }} />{l.label}</li>)}</ul>
            </div>
            <div className="pktlog-table"><PacketTable scn={L} sent={sent} onInspect={setInsp} srcOf={srcOf} dstOf={dstOf} /></div>
          </section>
        </section>

        <aside className="notes" aria-label="Lesson notes">
          <SidePanel scn={L} stepIdx={stepIdx} sent={sent} mode={panelMode} setMode={setPanelMode} onJumpStep={jumpStep} onInspect={setInsp}
            finished={finished || (saved?.done && stepIdx === L.steps.length - 1)} best={saved?.quiz ?? -1} nextLesson={nextLesson}
            onQuizDone={(answers) => store.quiz(L.id, answers)} />
        </aside>
      </div>

      {insp != null && <Inspector scn={L} no={insp} maxNo={sent.length || L.packets.length} onNav={setInsp} onClose={() => setInsp(null)} srcOf={srcOf} dstOf={dstOf} />}
      {stepIdx >= 0 && <span className="sr-only" aria-live="polite">Step {stepIdx + 1}: {L.steps[stepIdx].title}. {latest ? `Packet ${latest.label} sent.` : ''}</span>}
    </main>
  );
}
