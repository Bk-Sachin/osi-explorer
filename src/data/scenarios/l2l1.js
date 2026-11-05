import { frame, ethernet, arp, ipv4, udp, icmp, physical, custom, opaqueBytes, asciiB } from '../../lib/packet.js';

/* ---------------------------- Layer 2 ---------------------------- */
const A = { ip: '192.168.1.10', mac: 'a4:5e:60:00:00:0a' };
const B = { ip: '192.168.1.20', mac: 'a4:5e:60:00:00:0b' };
const Cc = { ip: '192.168.1.30', mac: 'a4:5e:60:00:00:0c' };
const BCAST = 'ff:ff:ff:ff:ff:ff';

export const switching = {
  id: 'switching',
  layer: 2,
  name: 'Ethernet & ARP',
  full: 'Frames, MAC addresses and switching',
  tag: 'ARP broadcast, MAC learning, FCS',
  summary:
    'Layer 2 moves frames between devices on the same local network. Every network card has a MAC address; ARP finds the MAC that belongs to an IP; switches learn which MAC lives on which port so they can forward frames only where they need to go; and a CRC at the end of every frame catches corruption.',
  facts: [
    ['OSI layer', 'Data Link (2)'],
    ['PDU', 'Frame'],
    ['Address', '48-bit MAC (e.g. a4:5e:60:00:00:0a)'],
    ['Error check', 'CRC-32 frame check sequence'],
    ['Defined in', 'IEEE 802.3, RFC 826 (ARP)'],
  ],
  legend: [
    { kind: 'bcast', label: 'Broadcast' },
    { kind: 'res', label: 'Unicast' },
    { kind: 'err', label: 'Dropped' },
  ],
  nodes: {
    a: { label: 'Host A', sub: `${A.ip}\n${A.mac}`, type: 'laptop', x: 120, y: 160 },
    sw: { label: 'Switch', sub: '4 ports', type: 'switch', x: 500, y: 300 },
    b: { label: 'Host B', sub: `${B.ip}\n${B.mac}`, type: 'server', x: 870, y: 160 },
    c: { label: 'Host C', sub: `${Cc.ip}\n${Cc.mac}`, type: 'laptop', x: 870, y: 440 },
  },
  links: [['a', 'sw', 'P1'], ['sw', 'b', 'P2'], ['sw', 'c', 'P3']],
  seq: ['a', 'sw', 'b', 'c'],
  steps: [
    {
      title: 'Same network, unknown MAC', sub: 'Check the ARP cache',
      text: 'Host A wants to ping 192.168.1.20. It\'s on the same /24, so no router is needed, but an Ethernet frame needs a destination MAC address, and A\'s ARP cache is empty. The switch\'s MAC table is empty too.',
      show: ['a', 'sw', 'b', 'c'],
      facts: [['A\'s ARP cache', '(empty)'], ['Switch MAC table', '(empty)'], ['Need', 'MAC for 192.168.1.20']],
      packets: [],
    },
    {
      title: 'ARP request', sub: 'Broadcast to everyone',
      text: 'A broadcasts "Who has 192.168.1.20? Tell 192.168.1.10" to ff:ff:ff:ff:ff:ff. The switch learns A\'s MAC is on port 1, and since it\'s a broadcast, floods it out every other port. B and C both receive it; C ignores it.',
      show: [],
      facts: [['Switch learns', `${A.mac} → P1`], ['Forwarding', 'Flood (broadcast)']],
      macTable: [[A.mac, 'P1']],
      packets: [
        { t: 0, from: 'a', to: ['b', 'c'], label: 'ARP who-has', kind: 'bcast', proto: 'ARP', info: `Who has ${B.ip}? Tell ${A.ip}`, note: `Who has ${B.ip}?`, dst: 'Broadcast', src: A.mac,
          frame: frame(ethernet({ src: A.mac, dst: BCAST, type: 0x0806, fcs: true, dstNote: 'Broadcast: every device on the LAN receives it.' }), arp({ op: 1, sha: A.mac, spa: A.ip, tha: '00:00:00:00:00:00', tpa: B.ip })) },
      ],
    },
    {
      title: 'ARP reply', sub: 'Unicast straight back',
      text: 'B recognises its IP and replies directly to A\'s MAC. The switch learns B is on port 2, and because it already knows A is on port 1, sends the reply only there. A caches the answer.',
      show: [],
      facts: [['Switch learns', `${B.mac} → P2`], ['A caches', `${B.ip} → ${B.mac}`], ['Forwarding', 'Port 1 only']],
      macTable: [[A.mac, 'P1'], [B.mac, 'P2']],
      packets: [
        { t: 0.0004, from: 'b', to: 'a', label: 'ARP is-at', kind: 'res', proto: 'ARP', info: `${B.ip} is at ${B.mac}`, note: `${B.ip} is at ${B.mac}`, src: B.mac, dst: A.mac,
          frame: frame(ethernet({ src: B.mac, dst: A.mac, type: 0x0806, fcs: true }), arp({ op: 2, sha: B.mac, spa: B.ip, tha: A.mac, tpa: A.ip })) },
      ],
    },
    {
      title: 'Switched unicast', sub: 'Only the right port',
      text: 'Now A sends the real ping inside a frame to B\'s MAC. The switch looks up B → port 2 and forwards it there only. C never sees it: that\'s the big win of a switch over an old hub, which repeated everything everywhere.',
      show: [],
      facts: [['Lookup', `${B.mac} → P2`], ['C receives', 'Nothing'], ['Frame size', '74 bytes + 4 FCS']],
      macTable: [[A.mac, 'P1'], [B.mac, 'P2']],
      packets: [
        { t: 0.001, from: 'a', to: 'b', label: 'Frame → B', kind: 'res', proto: 'ICMP', info: `Echo request ${A.ip} → ${B.ip}`, note: 'Delivered to port 2 only',
          frame: frame(ethernet({ src: A.mac, dst: B.mac, fcs: true }), ipv4({ src: A.ip, dst: B.ip, proto: 1, ttl: 64, id: 0x0101 }), icmp({ type: 8, id: 7, seq: 1 })) },
        { t: 0.0013, from: 'b', to: 'a', label: 'Frame → A', kind: 'res', proto: 'ICMP', info: `Echo reply ${B.ip} → ${A.ip}`, note: 'Delivered to port 1 only',
          frame: frame(ethernet({ src: B.mac, dst: A.mac, fcs: true }), ipv4({ src: B.ip, dst: A.ip, proto: 1, ttl: 64, id: 0x0201 }), icmp({ type: 0, id: 7, seq: 1 })) },
      ],
    },
    {
      title: 'Corrupted frame', sub: 'The FCS catches it',
      text: 'Electrical noise flips a bit in the next frame. B recomputes the CRC-32 over the received bytes, it doesn\'t match the FCS, and the frame is silently discarded. Ethernet only detects errors; recovery is left to higher layers like TCP.',
      show: [],
      facts: [['Bits flipped', '1'], ['CRC check', 'Mismatch → drop'], ['Recovery', 'Upper layers (e.g. TCP)']],
      macTable: [[A.mac, 'P1'], [B.mac, 'P2']],
      packets: [
        { t: 1.0, from: 'a', to: 'b', label: 'Bad FCS', kind: 'err', proto: 'ICMP', info: `Echo request seq=2 [FCS error: frame dropped]`, note: 'CRC mismatch, discarded by B', lost: true, lostAt: 0.85,
          frame: frame(ethernet({ src: A.mac, dst: B.mac, fcs: true }), ipv4({ src: A.ip, dst: B.ip, proto: 1, ttl: 64, id: 0x0102 }), icmp({ type: 8, id: 7, seq: 2 })) },
      ],
    },
  ],
  quiz: [
    { q: 'What does a switch do with a frame to an unknown MAC?', options: ['Drops it', 'Floods it to all other ports', 'Sends it to the router'], answer: 1, why: 'Until it learns where the MAC lives, flooding is the only way to deliver it.' },
    { q: 'How does a switch learn MAC addresses?', options: ['From the source MAC of frames it receives', 'From DHCP', 'From ARP replies only'], answer: 0, why: 'Every incoming frame reveals "this source MAC is on this port".' },
    { q: 'What happens to a frame whose FCS doesn\'t match?', options: ['It is corrected', 'It is retransmitted by Ethernet', 'It is silently dropped'], answer: 2, why: 'Ethernet detects but doesn\'t repair; TCP or the app recovers.' },
  ],
};

/* ---------------------------- Layer 1 ---------------------------- */
const L = { ip: '192.168.1.10', mac: 'a4:5e:60:00:00:0a' };
const SW = { mac: 'a4:5e:60:00:00:ee' };
const hello = (seed) => [
  ethernet({ src: L.mac, dst: SW.mac, fcs: true }),
  ipv4({ src: L.ip, dst: '192.168.1.255', proto: 17, ttl: 64, df: false, id: 0x4401 }),
  udp({ sport: 5353, dport: 5353 }),
  custom({ name: 'App payload', osi: 7, summary: '"Hi!"', fields: [['Data', asciiB('Hi!'), '"Hi!"', 'Three ASCII bytes: 0x48 0x69 0x21 = 01001000 01101001 00100001.']] }),
];

export const physicalLayer = {
  id: 'physical',
  layer: 1,
  name: 'Bits on the Wire',
  full: 'Signals, encoding, timing and noise',
  tag: 'Preamble, line coding, noise',
  summary:
    'The physical layer has no idea what a "frame" is. It just sends a stream of bits as voltage on copper, pulses of light in fiber, or radio waves. It decides the cable and connector, how a 1 and a 0 look as a signal (line coding), how fast bits go, and how the receiver stays in sync.',
  facts: [
    ['OSI layer', 'Physical (1)'],
    ['PDU', 'Bit / symbol'],
    ['Example', '1000BASE-T: 4 copper pairs, PAM-5'],
    ['Speed', '1 Gbit/s = 1 bit per ns'],
    ['Defined in', 'IEEE 802.3 clauses 25, 40…'],
  ],
  legend: [
    { kind: 'phy', label: 'Signal' },
    { kind: 'err', label: 'Corrupted' },
  ],
  nodes: {
    nic: { label: 'Laptop NIC', sub: 'Transmitter', type: 'laptop', x: 150, y: 330 },
    sw: { label: 'Switch port', sub: 'Receiver', type: 'switch', x: 850, y: 330 },
  },
  links: [['nic', 'sw', 'Cat 6 · 100 m']],
  seq: ['nic', 'sw'],
  steps: [
    {
      title: 'A frame becomes bits', sub: 'Layer 2 hands down a frame',
      text: 'The network card receives a 64-byte frame from the data link layer. To the physical layer that\'s just 512 bits to be turned into a signal on the cable. Try the Signal Lab tab to see what that signal looks like.',
      show: ['nic', 'sw'],
      facts: [['Frame', '64 bytes = 512 bits'], ['Medium', 'Twisted-pair copper'], ['Max length', '100 m']],
      packets: [],
    },
    {
      title: 'Wake up, receiver!', sub: 'Preamble and start delimiter',
      text: 'Before the frame, the PHY sends 7 bytes of 10101010 then 10101011. This steady pattern lets the receiver\'s clock lock onto the sender\'s timing, and the final "11" marks exactly where the frame begins.',
      show: [],
      facts: [['Preamble', '7 × 0x55 (10101010)'], ['SFD', '0xD5 (10101011)'], ['Purpose', 'Clock sync + frame start']],
      packets: [
        { t: 0, from: 'nic', to: 'sw', label: 'Preamble', kind: 'phy', proto: 'PHY', info: 'Preamble 7 bytes + SFD', note: '10101010 ×7, 10101011', src: 'NIC', dst: 'Switch port',
          frame: frame(physical()) },
      ],
    },
    {
      title: 'Line coding', sub: 'Bits as voltage levels',
      text: 'The frame\'s bits follow immediately. Gigabit Ethernet groups bits into symbols on 5 voltage levels (PAM-5) across 4 wire pairs at once; older 10 Mbit Ethernet used Manchester coding, where every bit is a transition, so the clock is built into the signal.',
      show: [],
      facts: [['On the wire', '8 + 64 bytes'], ['Duration @1 Gb/s', '576 ns'], ['Signal speed', '≈ 0.65 c in copper (≈ 500 ns for 100 m)']],
      packets: [
        { t: 0.000001, from: 'nic', to: 'sw', label: 'Frame bits', kind: 'phy', proto: 'PHY', info: 'Preamble + SFD + 64-byte frame (576 bit-times)', note: 'Everything, as one bit stream', src: 'NIC', dst: 'Switch port',
          frame: frame(physical(), ...hello()) },
      ],
    },
    {
      title: 'Inter-frame gap', sub: 'A mandatory pause',
      text: 'After each frame the line must stay idle for 12 byte-times (96 ns at 1 Gb/s). This gap gives receivers time to process the frame and prepare for the next one. So a 64-byte frame really costs 84 bytes of wire time.',
      show: [],
      facts: [['IFG', '12 bytes = 96 bit-times'], ['Wire cost', '7+1+64+12 = 84 bytes'], ['Max rate', '1,488,095 frames/s at 1 Gb/s']],
      packets: [
        { t: 0.0000007, from: 'nic', to: 'sw', label: 'Idle', kind: 'phy', proto: 'PHY', info: 'Inter-frame gap (12 bytes idle)', note: 'Line idle for 96 ns', src: 'NIC', dst: 'Switch port',
          frame: frame(custom({ name: 'Idle line', osi: 1, summary: '12 byte-times', fields: [['Inter-frame gap', Array(12).fill(0), '96 bit-times', 'Idle symbols, not data. Shown as zeros.']] })) },
      ],
    },
    {
      title: 'Noise', sub: 'Signals get distorted',
      text: 'A nearby motor induces noise and one voltage level is misread. The PHY can\'t tell: it faithfully passes up the wrong bit. Layer 2\'s CRC will catch it. Long cables, cheap shielding and interference all raise the bit error rate.',
      show: [],
      facts: [['Bit error rate (spec)', '< 1 in 10¹⁰'], ['Detected by', 'Layer 2 FCS'], ['Fixes', 'Shielding, shorter cables, fiber']],
      packets: [
        { t: 0.000002, from: 'nic', to: 'sw', label: 'Frame bits', kind: 'err', proto: 'PHY', info: 'Frame with 1 flipped bit (FCS will fail)', note: 'Noise flipped a bit', lost: true, lostAt: 0.9, src: 'NIC', dst: 'Switch port',
          frame: frame(physical(), ...hello()) },
      ],
    },
  ],
  quiz: [
    { q: 'What is the preamble for?', options: ['Encryption', 'Letting the receiver sync its clock', 'Carrying the MAC address'], answer: 1, why: 'Alternating bits give a steady rhythm to lock onto.' },
    { q: 'In Manchester coding, a bit is…', options: ['A voltage level held for the bit time', 'A transition in the middle of the bit time', 'A light pulse only'], answer: 1, why: 'The mid-bit transition carries both the value and the clock.' },
    { q: 'Who detects a bit flipped by noise?', options: ['The physical layer', 'The data link layer\'s CRC', 'The router'], answer: 1, why: 'The PHY passes bits blindly; the FCS check at Layer 2 notices.' },
  ],
};
