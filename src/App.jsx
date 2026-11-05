import { useEffect } from 'react';
import { byId } from './data/scenarios/index.js';
import { useRoute, href } from './lib/router.js';
import { useStore, store, dueCards } from './lib/progress.js';
import Home from './pages/Home.jsx';
import Lessons from './pages/Lessons.jsx';
import LessonPage from './pages/LessonPage.jsx';
import Review from './pages/Review.jsx';
import Passport from './pages/Passport.jsx';
import { StudyPage, LabsPage } from './pages/Reference.jsx';

function Mark() {
  // seven nested frames: the layers wrapping a message
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={2 + i * 2} y={2 + i * 2} width={28 - i * 4} height={28 - i * 4} rx={3 - i * 0.3} fill="none" stroke={`var(--l${i + 1})`} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

const NAV = [
  ['lessons', 'Lessons', href.lessons],
  ['study', 'Study guides', href.study(7)],
  ['labs', 'Labs', href.labs(7)],
  ['review', 'Review', href.review],
  ['passport', 'Passport', href.passport],
];

export default function App() {
  const route = useRoute();
  const s = useStore();
  const due = dueCards(s).length;

  useEffect(() => {
    const t = s.theme === 'l' ? 'light' : s.theme === 'd' ? 'dark' : '';
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }, [s.theme]);

  const darkNow = s.theme === 'd' || (!s.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const active = route.page === 'lesson' ? 'lessons' : route.page;
  const lastL = byId[s.last];
  const showContinue = lastL && !s.lessons[lastL.id]?.done && !(route.page === 'lesson' && route.id === s.last);

  let page;
  if (route.page === 'home') page = <Home />;
  else if (route.page === 'lessons') page = <Lessons />;
  else if (route.page === 'lesson') page = <LessonPage key={route.id} L={byId[route.id]} />;
  else if (route.page === 'review') page = <Review />;
  else if (route.page === 'passport') page = <Passport />;
  else if (route.page === 'study') page = <StudyPage layer={route.layer} />;
  else if (route.page === 'labs') page = <LabsPage layer={route.layer} />;
  else page = (
    <main className="page narrow">
      <h1 className="h-page">That page doesn't exist</h1>
      <p className="lede">The link may be mistyped, or the lesson was renamed. Every lesson is listed on the lessons page.</p>
      <a className="btn primary" href={href.lessons}>Go to lessons</a>
    </main>
  );

  return (
    <div className={`shell ${route.page === 'lesson' ? 'is-lesson' : ''}`}>
      <button className="skip" onClick={() => document.getElementById('main')?.focus()}>Skip to content</button>
      <header className="topbar">
        <a className="brand" href={href.home} aria-label="OSI Explorer home"><Mark /><span>OSI Explorer</span></a>
        <nav className="nav" aria-label="Main">
          {NAV.map(([k, label, h]) => (
            <a key={k} href={h} className={active === k ? 'on' : ''} aria-current={active === k ? 'page' : undefined}>
              {label}{k === 'review' && due > 0 && <span className="count" aria-label={`${due} cards due`}>{due}</span>}
            </a>
          ))}
        </nav>
        <div className="top-actions">
          {showContinue && <a className="btn continue-btn" href={href.lesson(lastL.id)}>Continue {lastL.name}</a>}
          <button className="btn icon" onClick={() => store.setTheme(darkNow ? 'l' : 'd')} aria-label={darkNow ? 'Switch to light theme' : 'Switch to dark theme'}>
            {darkNow ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <div id="main" tabIndex={-1}>{page}</div>
      {route.page !== 'lesson' && (
        <footer className="foot">
          <p>Progress is kept in a cookie on this device only. Nothing is sent to a server. <a href={href.passport}>What's stored</a></p>
          <p>Learning model inspired by <a href="https://protocol-explorer-alpha.vercel.app/" target="_blank" rel="noreferrer noopener">Protocol Explorer</a>. Addresses come from documentation ranges.</p>
        </footer>
      )}
    </div>
  );
}
