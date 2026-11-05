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

// Elapsed milliseconds since key changed (stops counting after maxMs)
export function useElapsed(key, enabled, maxMs) {
  const [ms, setMs] = useState(enabled ? 0 : maxMs);
  const raf = useRef();
  useEffect(() => {
    if (!enabled) { setMs(maxMs); return; }
    setMs(0);
    const start = performance.now();
    const tick = (now) => {
      const v = Math.min(maxMs, now - start);
      setMs(v);
      if (v < maxMs) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key, enabled, maxMs]);
  return ms;
}

/* ---------------- packet journey timing (at 1× speed) ---------------- */
export const SEG_MS = 2000;   // travel time per link
export const HOLD_MS = 1500;  // processing pause at an intermediate device
export const ARRIVE_MS = 900; // arrival pulse

export function longestPath(scn, pkt) {
  return [].concat(pkt.to).map((t) => route(scn, pkt.from, t)).sort((a, b) => b.length - a.length)[0];
}

// Journey plan in "lesson ms" (divide by speed for real time)
export function journey(scn, pkt) {
  const path = longestPath(scn, pkt);
  const hops = path.length - 1;
  const stopAt = pkt.lost ? (pkt.lostAt ?? 0.55) * hops : hops; // in segments
  const full = Math.floor(stopAt);
  const travel = stopAt * SEG_MS + Math.min(full, hops - 1) * HOLD_MS;
  return { path, hops, stopAt, total: travel + ARRIVE_MS, travel };
}

// Where is the packet at time t (lesson ms)? Returns segment fraction + phase
export function journeyState(j, t) {
  let rem = t;
  for (let i = 0; i < j.hops; i++) {
    const segLen = Math.min(1, j.stopAt - i);
    if (segLen <= 0) break;
    const segMs = segLen * SEG_MS;
    if (rem < segMs) return { phase: 'travel', seg: i, k: ease(rem / segMs) * segLen };
    rem -= segMs;
    if (segLen < 1) return { phase: 'lost', seg: i, k: segLen, after: rem };
    if (i < j.hops - 1) {
      if (rem < HOLD_MS) return { phase: 'hold', seg: i, k: 1, node: j.path[i + 1], holdK: rem / HOLD_MS };
      rem -= HOLD_MS;
    }
  }
  return { phase: 'arrived', seg: j.hops - 1, k: 1, after: rem };
}

export const HOLD_TEXT = {
  router: 'Router: reads the destination IP, looks up its routing table, lowers TTL by 1 and writes a fresh Ethernet header for the next link.',
  switch: 'Switch: reads the destination MAC, looks it up in its MAC table and forwards the frame out of the matching port only.',
  cloud: 'The internet: a chain of ISP routers forwards the packet hop by hop toward the destination network.',
  ap: 'Access point: converts between an 802.11 radio frame and a wired Ethernet frame.',
  hub: 'Hub: has no table at all. It simply repeats the electrical signal out of every other port.',
  dns: 'Forwarding…', server: 'Forwarding…', laptop: 'Forwarding…', phone: 'Forwarding…',
};

export const wordsMs = (text = '') => Math.min(16000, Math.max(6000, text.split(/\s+/).length * 230));

