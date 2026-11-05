import { LAYERS } from '../data/layers.js';
import { href, go } from '../lib/router.js';
import StudyView from '../components/StudyView.jsx';
import LabView from '../labs/index.jsx';

export function StudyPage({ layer }) {
  return (
    <main className="page ref" style={{ '--lc': LAYERS[layer].color }}>
      <h1 className="h-page">Study guides</h1>
      <p className="lede measure">A reference for each layer: what it does, the headers it adds, commands to try on your own computer, and how to troubleshoot it.</p>
      <div className="embed">
        <StudyView layer={layer} setLayer={(n) => go(href.study(n))} onPick={(id) => go(href.lesson(id))} />
      </div>
    </main>
  );
}

export function LabsPage({ layer }) {
  return (
    <main className="page ref" style={{ '--lc': LAYERS[layer].color }}>
      <h1 className="h-page">Labs</h1>
      <p className="lede measure">Hands-on sandboxes, one per layer. Change the inputs and watch what happens: nothing here can break.</p>
      <div className="embed">
        <LabView layer={layer} setLayer={(n) => go(href.labs(n))} />
      </div>
    </main>
  );
}
