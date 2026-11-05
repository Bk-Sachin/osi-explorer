import { http, dnsRecursive } from './l7.js';
import { dhcpLesson, smtpLesson } from './l7more.js';
import { presentation, session } from './l6l5.js';
import { certificates, websocket } from './l6l5more.js';
import { tcpReliable, udpVoice, routing } from './l4l3.js';
import { tcpFlow, ports, natLesson, fragmentation } from './l4l3more.js';
import { switching, physicalLayer } from './l2l1.js';
import { vlans, wifiLesson, hubLesson } from './l2l1more.js';
import { DEEP } from './deep.js';

export const SCENARIOS = [
  http, dnsRecursive, dhcpLesson, smtpLesson,
  presentation, certificates,
  session, websocket,
  tcpReliable, tcpFlow, udpVoice, ports,
  routing, natLesson, fragmentation,
  switching, vlans, wifiLesson,
  physicalLayer, hubLesson,
];

for (const s of SCENARIOS) {
  // merge extra depth for original lessons
  const d = DEEP[s.id];
  if (d) {
    s.keyIdeas ||= d.keyIdeas;
    Object.entries(d.steps || {}).forEach(([i, notes]) => { if (s.steps[i] && !s.steps[i].deep) s.steps[i].deep = notes; });
  }
  // global packet numbers
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
