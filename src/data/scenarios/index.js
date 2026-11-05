import { http, dnsRecursive } from './l7.js';
import { presentation, session } from './l6l5.js';
import { tcpReliable, udpVoice, routing } from './l4l3.js';
import { switching, physicalLayer } from './l2l1.js';

export const SCENARIOS = [http, dnsRecursive, presentation, session, tcpReliable, udpVoice, routing, switching, physicalLayer];

// Precompute global packet numbers per scenario
for (const s of SCENARIOS) {
  let n = 0;
  s.packets = [];
  s.steps.forEach((st, si) => {
    st.packets.forEach((p) => {
      p.no = ++n;
      p.step = si;
      s.packets.push(p);
    });
  });
}

export const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export const byLayer = (n) => SCENARIOS.filter((s) => s.layer === n);
