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

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Animation clock in "lesson ms". It restarts when `key` changes, freezes while `paused`,
// runs `rate`× faster (playback speed) and stops counting at `max`.
// Changing speed or pausing never restarts the animation.
export function useElapsed(key, { enabled = true, max, paused = false, rate = 1 }) {
  const [ms, setMs] = useState(enabled ? 0 : max);
  const acc = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  useEffect(() => { acc.current = enabled ? 0 : max; setMs(acc.current); }, [key, enabled, max]);
  useEffect(() => {
    if (!enabled || paused || acc.current >= max) return;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      acc.current = Math.min(max, acc.current + (now - last) * rateRef.current);
      last = now;
      setMs(acc.current);
      if (acc.current < max) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, enabled, max, paused]);
  return ms;
}

// 0→1 progress over `duration` real ms (pausable)
export function useProgress(key, duration, enabled = true, paused = false) {
  return useElapsed(key, { enabled, max: duration, paused }) / duration;
}

/* ---------------- packet journey timing (at 1× speed) ---------------- */
export const SEG_MS = 2200;   // travel time per link
export const ARRIVE_MS = 1200; // arrival pulse
// A stop at a device lasts long enough for a beginner to read its caption:
// ~2.5 words a second, never less than 4 s. (Pause freezes it; the notes panel keeps the text.)
export const holdMs = (text = '') => Math.min(12000, Math.max(4000, text.split(/\s+/).length * 400));

export function longestPath(scn, pkt) {
  return [].concat(pkt.to).map((t) => route(scn, pkt.from, t)).sort((a, b) => b.length - a.length)[0];
}

// Journey plan in "lesson ms" (divide by speed for real time)
// The caption shown while a packet waits at an intermediate device
export function holdText(scn, pkt, node) {
  return pkt.hold?.[node] || HOLD_TEXT[scn.nodes[node]?.type] || 'Forwarding…';
}

const jcache = new WeakMap();
export function journey(scn, pkt) {
  if (jcache.has(pkt)) return jcache.get(pkt);
  const path = longestPath(scn, pkt);
  const hops = path.length - 1;
  const stopAt = pkt.lost ? (pkt.lostAt ?? 0.55) * hops : hops; // in segments
  const full = Math.floor(stopAt);
  const holds = path.slice(1, -1).map((n) => holdMs(holdText(scn, pkt, n)));
  const travel = stopAt * SEG_MS + holds.slice(0, Math.min(full, hops - 1)).reduce((a, b) => a + b, 0);
  const j = { path, hops, stopAt, holds, total: travel + ARRIVE_MS, travel };
  jcache.set(pkt, j);
  return j;
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
      const h = j.holds[i];
      if (rem < h) return { phase: 'hold', seg: i, k: 1, node: j.path[i + 1], holdK: rem / h, after: rem, left: h - rem };
      rem -= h;
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

