import { useEffect, useRef, useState } from 'react';

export const KIND = {
  dns: '#4f8dfd', tcp: '#22c55e', req: '#f5b700', res: '#a78bfa', err: '#ef4444',
  bcast: '#22d3ee', hs: '#f472b6', enc: '#fbbf24', phy: '#fb923c',
};

// Shortest path between two nodes through scenario links (BFS)
export function route(scn, from, to) {
  const adj = {};
  for (const [a, b] of scn.links) {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); }
  }
  if (!(to in prev)) return [from, to];
  const path = [];
  for (let n = to; n != null; n = prev[n]) path.unshift(n);
  return path;
}

export function pointAt(pts, t) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d); total += d;
  }
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? dist / segs[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k, seg: i };
    }
    dist -= segs[i];
  }
  return pts[pts.length - 1];
}

// Animation progress 0→1, restarting when key changes
export function useProgress(key, duration, enabled = true) {
  const [p, setP] = useState(enabled ? 0 : 1);
  const raf = useRef();
  useEffect(() => {
    if (!enabled) { setP(1); return; }
    setP(0);
    const start = performance.now();
    const tick = (now) => {
      const v = Math.min(1, (now - start) / duration);
      setP(v);
      if (v < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key, duration, enabled]);
  return p;
}

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function saveJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}
