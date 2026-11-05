import { frame, ethernet, ipv4, tcp, udp, icmp, custom, opaqueBytes } from '../../lib/packet.js';

/* ---------------------------- Layer 4: TCP ---------------------------- */
const C = { ip: '10.0.0.5', mac: '52:54:00:aa:00:05' };
const S = { ip: '10.0.1.80', mac: '52:54:00:bb:00:80' };
const R = { a: '52:54:00:ff:00:01', b: '52:54:00:ff:01:01' };
const cOut = () => ethernet({ src: C.mac, dst: R.a });
const sOut = () => ethernet({ src: S.mac, dst: R.b });
const cIp = (id) => ipv4({ src: C.ip, dst: S.ip, id });
const sIp = (id) => ipv4({ src: S.ip, dst: C.ip, id, ttl: 63 });
const data = (n, seed) => custom({ name: 'File data', osi: 7, summary: `${n} bytes`, fields: [['Payload', opaqueBytes(n, seed), `${n} bytes`, 'A chunk of the file being uploaded. TCP doesn\'t care what it is.', { opaque: true }]] });
const seg = (o) => tcp({ sport: 50500, dport: 9000, ...o });
const back = (o) => tcp({ sport: 9000, dport: 50500, ...o });

const tNodes = {
  client: { label: 'Client', sub: C.ip, type: 'laptop', x: 150, y: 350 },
  router: { label: 'Router', sub: '10.0.0.1', type: 'router', x: 500, y: 260 },
  server: { label: 'File Server', sub: S.ip, type: 'server', x: 850, y: 350 },
};

export const tcpReliable = {
  id: 'tcp',
  layer: 4,
  name: 'TCP',
  full: 'Transmission Control Protocol',
  tag: 'Handshake, loss, retransmit, close',
  summary:
    'TCP turns an unreliable network into a reliable, ordered byte stream between two programs. It numbers every byte, acknowledges what arrives, resends what\'s lost, and slows down when the receiver or network is overwhelmed. Ports identify which program on each host is talking.',
  facts: [
    ['OSI layer', 'Transport (4)'],
    ['PDU', 'Segment'],
    ['Header', '20–60 bytes'],
    ['Guarantees', 'Ordered, reliable, flow & congestion control'],
    ['Defined in', 'RFC 9293'],
  ],
  legend: [
    { kind: 'tcp', label: 'Control' },
    { kind: 'req', label: 'Data' },
    { kind: 'res', label: 'ACK' },
    { kind: 'err', label: 'Lost' },
  ],
  nodes: tNodes,
  links: [['client', 'router'], ['router', 'server']],
  seq: ['client', 'server'],
  steps: [
    {
      title: 'Handshake', sub: 'SYN → SYN-ACK → ACK',
      text: 'Each side picks a starting sequence number and tells the other. The SYNs also negotiate options: maximum segment size (1460 bytes on Ethernet), window scaling, selective ACKs.',
      show: ['client', 'router', 'server'],
      facts: [['Client port', '50500 (ephemeral)'], ['Server port', '9000'], ['MSS', '1460 bytes']],
      packets: [
        { t: 0, from: 'client', to: 'server', label: 'SYN', kind: 'tcp', proto: 'TCP', info: '50500 → 9000 [SYN] Seq=0 Win=64240', note: 'Seq=0', frame: frame(cOut(), cIp(0x1001), seg({ flags: ['SYN'], opts: true })) },
        { t: 0.02, from: 'server', to: 'client', label: 'SYN-ACK', kind: 'tcp', proto: 'TCP', info: '9000 → 50500 [SYN, ACK] Seq=0 Ack=1', note: 'Seq=0 Ack=1', frame: frame(sOut(), sIp(0x2001), back({ flags: ['SYN', 'ACK'], ack: 1, opts: true })) },
        { t: 0.04, from: 'client', to: 'server', label: 'ACK', kind: 'tcp', proto: 'TCP', info: '50500 → 9000 [ACK] Seq=1 Ack=1', note: 'Established', frame: frame(cOut(), cIp(0x1002), seg({ flags: ['ACK'], seq: 1, ack: 1 })) },
      ],
    },
    {
      title: 'Send in segments', sub: 'Numbering every byte',
      text: 'The app hands TCP a 3,000-byte upload. TCP cuts it into segments that fit the MSS, numbers them by byte offset, and, because the window allows it, sends several without waiting for each ACK. One gets lost along the way.',
      show: [],
      facts: [['Window', '3 segments in flight'], ['Seg 1', 'bytes 1–1000'], ['Seg 2', 'bytes 1001–2000 (lost!)'], ['Seg 3', 'bytes 2001–3000']],
      packets: [
        { t: 0.05, from: 'client', to: 'server', label: 'Seq=1', kind: 'req', proto: 'TCP', info: '50500 → 9000 [PSH, ACK] Seq=1 Len=1000', note: 'bytes 1–1000', frame: frame(cOut(), cIp(0x1003), seg({ flags: ['PSH', 'ACK'], seq: 1, ack: 1 }), data(1000, 1)) },
        { t: 0.051, from: 'client', to: 'server', label: 'Seq=1001', kind: 'err', proto: 'TCP', info: '50500 → 9000 [PSH, ACK] Seq=1001 Len=1000 [lost]', note: 'bytes 1001–2000, dropped by a congested router', lost: true, frame: frame(cOut(), cIp(0x1004), seg({ flags: ['PSH', 'ACK'], seq: 1001, ack: 1 }), data(1000, 2)) },
        { t: 0.052, from: 'client', to: 'server', label: 'Seq=2001', kind: 'req', proto: 'TCP', info: '50500 → 9000 [PSH, ACK] Seq=2001 Len=1000', note: 'bytes 2001–3000', frame: frame(cOut(), cIp(0x1005), seg({ flags: ['PSH', 'ACK'], seq: 2001, ack: 1 }), data(1000, 3)) },
      ],
    },
    {
      title: 'Spot the gap', sub: 'Cumulative and duplicate ACKs',
      text: 'The server got bytes 1–1000, then 2001–3000: there\'s a hole. ACKs are cumulative ("I have everything up to X"), so it keeps saying Ack=1001, and the SACK option adds "but I also have 2001–3000". Three duplicate ACKs, or a timeout, trigger a resend.',
      show: [],
      facts: [['Server buffer', '1–1000 ✓ · 1001–2000 ✗ · 2001–3000 ✓'], ['App sees', 'Only 1–1000 (in-order delivery)']],
      packets: [
        { t: 0.071, from: 'server', to: 'client', label: 'Ack=1001', kind: 'res', proto: 'TCP', info: '9000 → 50500 [ACK] Seq=1 Ack=1001', note: 'Got up to 1000.', frame: frame(sOut(), sIp(0x2002), back({ flags: ['ACK'], seq: 1, ack: 1001 })) },
        { t: 0.073, from: 'server', to: 'client', label: 'Dup Ack=1001', kind: 'res', proto: 'TCP', info: '9000 → 50500 [ACK] Seq=1 Ack=1001 SACK=2001-3001 [dup ACK]', note: 'Still need 1001! (but I have 2001–3000)', frame: frame(sOut(), sIp(0x2003), back({ flags: ['ACK'], seq: 1, ack: 1001, ackNote: 'Same as before: a duplicate ACK signals a missing segment.' })) },
      ],
    },
    {
      title: 'Retransmit', sub: 'Fill the hole',
      text: 'The client resends only the missing segment (fast retransmit). The server can now deliver all 3,000 bytes to the application in order and jumps its ACK to 3001. TCP also halves its congestion window: loss usually means the network is busy.',
      show: [],
      facts: [['Resent', 'Seq 1001–2000 only'], ['ACK', '3001 (all received)'], ['Congestion window', 'Halved']],
      packets: [
        { t: 0.09, from: 'client', to: 'server', label: 'Seq=1001', kind: 'req', proto: 'TCP', info: '50500 → 9000 [PSH, ACK] Seq=1001 Len=1000 [retransmission]', note: 'Retransmission', frame: frame(cOut(), cIp(0x1006), seg({ flags: ['PSH', 'ACK'], seq: 1001, ack: 1 }), data(1000, 2)) },
        { t: 0.11, from: 'server', to: 'client', label: 'Ack=3001', kind: 'res', proto: 'TCP', info: '9000 → 50500 [ACK] Seq=1 Ack=3001', note: 'All 3,000 bytes received.', frame: frame(sOut(), sIp(0x2004), back({ flags: ['ACK'], seq: 1, ack: 3001 })) },
      ],
    },
    {
      title: 'Close', sub: 'FIN from each side',
      text: 'Each direction closes separately: the client says "no more data from me" with FIN, the server ACKs, then sends its own FIN. The client waits a little (TIME_WAIT) in case a late segment shows up.',
      show: [],
      facts: [['States', 'FIN_WAIT → TIME_WAIT → CLOSED'], ['TIME_WAIT', '2 × max segment lifetime']],
      packets: [
        { t: 0.12, from: 'client', to: 'server', label: 'FIN', kind: 'tcp', proto: 'TCP', info: '50500 → 9000 [FIN, ACK] Seq=3001 Ack=1', note: 'I\'m done sending.', frame: frame(cOut(), cIp(0x1007), seg({ flags: ['FIN', 'ACK'], seq: 3001, ack: 1 })) },
        { t: 0.14, from: 'server', to: 'client', label: 'FIN-ACK', kind: 'tcp', proto: 'TCP', info: '9000 → 50500 [FIN, ACK] Seq=1 Ack=3002', note: 'Me too.', frame: frame(sOut(), sIp(0x2005), back({ flags: ['FIN', 'ACK'], seq: 1, ack: 3002 })) },
        { t: 0.16, from: 'client', to: 'server', label: 'ACK', kind: 'tcp', proto: 'TCP', info: '50500 → 9000 [ACK] Seq=3002 Ack=2', note: 'Closed.', frame: frame(cOut(), cIp(0x1008), seg({ flags: ['ACK'], seq: 3002, ack: 2 })) },
      ],
    },
  ],
  quiz: [
    { q: 'A TCP ACK number of 1001 means…', options: ['Segment number 1001 arrived', 'All bytes before 1001 arrived; 1001 is next', '1001 bytes are in flight'], answer: 1, why: 'ACKs are cumulative and name the next byte expected.' },
    { q: 'What usually triggers a fast retransmit?', options: ['Three duplicate ACKs', 'A FIN flag', 'A DNS timeout'], answer: 0, why: 'Duplicate ACKs mean later data arrived but an earlier segment is missing.' },
    { q: 'What do port numbers identify?', options: ['The computer', 'The program/service on the computer', 'The router'], answer: 1, why: 'IP gets you to the host; the port picks the process.' },
  ],
};

/* ---------------------------- Layer 4: UDP ---------------------------- */
const G = { ip: '10.0.0.7', mac: '52:54:00:aa:00:07' };
const GS = { ip: '10.0.1.90', mac: '52:54:00:bb:00:90' };
const voice = (n, s) => custom({ name: 'RTP voice', osi: 7, summary: `frame ${s}`, fields: [
  ['RTP header', [0x80, 0x6f, 0x00, s, 0x00, 0x00, 0x03, 0x20 * s & 255, 0x12, 0x34, 0x56, 0x78], `seq ${s}`, 'Real-time Transport Protocol: sequence number and timestamp so the receiver can reorder or skip.'],
  ['Opus audio', opaqueBytes(n, 60 + s), `${n} bytes`, '20 ms of compressed voice.', { opaque: true }],
] });
const gram = (s, lost) => ({
  t: 0.02 * s, from: 'client', to: 'server', label: `Voice #${s}`, kind: lost ? 'err' : 'req', proto: 'UDP', lost,
  info: `50700 → 5004 Len=${80 + 12} RTP seq=${s}${lost ? ' [lost]' : ''}`, note: lost ? 'Lost. Nobody resends it: too late to be useful anyway.' : '20 ms of audio',
  frame: frame(ethernet({ src: G.mac, dst: R.a }), ipv4({ src: G.ip, dst: GS.ip, proto: 17, id: 0x3000 + s, df: false }), udp({ sport: 50700, dport: 5004 }), voice(80, s)),
});

export const udpVoice = {
  id: 'udp',
  layer: 4,
  name: 'UDP',
  full: 'User Datagram Protocol',
  tag: 'Fire-and-forget for real-time voice',
  summary:
    'UDP is TCP\'s minimalist sibling: an 8-byte header with ports, a length and a checksum. No handshake, no ACKs, no retransmission, no ordering. That makes it perfect for voice, video and games, where late data is useless, and for tiny exchanges like DNS.',
  facts: [
    ['OSI layer', 'Transport (4)'],
    ['PDU', 'Datagram'],
    ['Header', '8 bytes'],
    ['Guarantees', 'None beyond checksum'],
    ['Used by', 'DNS, DHCP, VoIP, games, QUIC'],
  ],
  legend: [
    { kind: 'req', label: 'Datagram' },
    { kind: 'err', label: 'Lost' },
  ],
  nodes: { client: { label: 'Phone app', sub: G.ip, type: 'phone', x: 150, y: 350 }, router: tNodes.router, server: { label: 'Voice Server', sub: GS.ip, type: 'server', x: 850, y: 350 } },
  links: [['client', 'router'], ['router', 'server']],
  seq: ['client', 'server'],
  steps: [
    {
      title: 'No handshake', sub: 'Just start sending',
      text: 'There\'s no connection to set up. The first datagram already carries voice. Every 20 ms the app hands UDP another small chunk.',
      show: ['client', 'router', 'server'],
      facts: [['Setup cost', '0 round trips'], ['Per packet', '8-byte header vs TCP\'s 20+']],
      packets: [gram(1), gram(2)],
    },
    {
      title: 'Loss happens', sub: 'And nothing is resent',
      text: 'Datagram #3 is dropped. UDP doesn\'t notice or care. Resending would take a round trip, so the audio would arrive too late to play. The app\'s jitter buffer simply conceals 20 ms of missing sound.',
      show: [],
      facts: [['Lost', '#3'], ['Recovery', 'App conceals the gap'], ['Delay added', 'None']],
      packets: [gram(3, true), gram(4), gram(5)],
    },
    {
      title: 'Why choose UDP?', sub: 'Speed over certainty',
      text: 'TCP would stall every later packet behind the lost one (head-of-line blocking) while it retransmits. For live media a tiny glitch beats a frozen call. Apps that want reliability on UDP, like QUIC (HTTP/3), add their own.',
      show: [],
      facts: [['TCP', 'Reliable, ordered, may stall'], ['UDP', 'Fast, unordered, may lose']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'How big is a UDP header?', options: ['8 bytes', '20 bytes', '40 bytes'], answer: 0, why: 'Source port, destination port, length, checksum: 2 bytes each.' },
    { q: 'Why don\'t voice apps retransmit lost audio?', options: ['UDP forbids it', 'It would arrive too late to play', 'Audio can\'t be lost'], answer: 1, why: 'Real-time data has a deadline; late is as bad as lost.' },
    { q: 'Which uses UDP?', options: ['HTTP/1.1', 'DNS queries', 'SSH'], answer: 1, why: 'A DNS question and answer each fit in one datagram.' },
  ],
};

/* ---------------------------- Layer 3: routing ---------------------------- */
const PC = { ip: '192.168.1.10', mac: '3c:22:fb:10:4a:10' };
const R1 = { lan: '192.168.1.1', wan: '10.0.0.1', macL: '00:1e:58:a1:00:01', macW: '00:1e:58:a1:00:02' };
const R2 = { a: '10.0.0.2', b: '172.16.0.1', macA: '00:25:90:c2:00:02', macB: '00:25:90:c2:00:03' };
const SV = { ip: '172.16.0.50', mac: '00:50:56:9d:00:50' };

const probe = (ttl, seq) => [ipv4({ src: PC.ip, dst: SV.ip, proto: 1, ttl, id: 0x7700 + seq, ttlNote: `Set to ${ttl} on purpose: traceroute probes one hop further each time.` }), icmp({ type: 8, id: 0x0042, seq })];
const embedded = (ttl, seq) => frame(...probe(1, seq)).bytes.slice(0, 28);

export const routing = {
  id: 'routing',
  layer: 3,
  name: 'IP Routing',
  full: 'Internet Protocol, ICMP & traceroute',
  tag: 'Hop by hop across networks',
  summary:
    'IP gives every host an address that is meaningful across the whole internet, and routers forward packets one hop at a time toward the destination network. The TTL field stops packets that loop forever, and ICMP reports problems. Traceroute cleverly abuses both to reveal the path.',
  facts: [
    ['OSI layer', 'Network (3)'],
    ['PDU', 'Packet'],
    ['Address', '32-bit IPv4 / 128-bit IPv6'],
    ['Delivery', 'Best effort, hop by hop'],
    ['Defined in', 'RFC 791 (IPv4), RFC 792 (ICMP)'],
  ],
  legend: [
    { kind: 'req', label: 'Probe' },
    { kind: 'err', label: 'Time exceeded' },
    { kind: 'res', label: 'Echo reply' },
  ],
  nodes: {
    pc: { label: 'PC', sub: PC.ip, type: 'laptop', x: 100, y: 380 },
    r1: { label: 'Router R1', sub: `${R1.lan} | ${R1.wan}`, type: 'router', x: 350, y: 250 },
    r2: { label: 'Router R2', sub: `${R2.a} | ${R2.b}`, type: 'router', x: 630, y: 250 },
    server: { label: 'Server', sub: SV.ip, type: 'server', x: 880, y: 380 },
  },
  links: [['pc', 'r1'], ['r1', 'r2'], ['r2', 'server']],
  seq: ['pc', 'r1', 'r2', 'server'],
  steps: [
    {
      title: 'Local or remote?', sub: 'Apply the subnet mask',
      text: 'The PC compares the destination with its own network: 192.168.1.10/24 means "192.168.1.x is local". 172.16.0.50 isn\'t, so the packet goes to the default gateway (R1). At Layer 2 it\'s addressed to R1\'s MAC, while the IP destination stays the server.',
      show: ['pc', 'r1', 'r2', 'server'],
      facts: [['My network', '192.168.1.0/24'], ['Destination', '172.16.0.50 → not local'], ['Next hop', `Gateway ${R1.lan}`]],
      packets: [],
    },
    {
      title: 'TTL = 1', sub: 'Dies at the first router',
      text: 'Traceroute sends a ping with TTL 1. R1 decrements it to 0, drops the packet, and sends back ICMP "Time exceeded" from its own address. Now we know hop 1.',
      show: [],
      facts: [['Hop 1', `${R1.lan} (R1)`], ['RTT', '1.2 ms']],
      packets: [
        { t: 0, from: 'pc', to: 'r1', label: 'TTL=1', kind: 'req', proto: 'ICMP', info: 'Echo (ping) request id=0x0042 seq=1 ttl=1', note: 'Ping with TTL 1', frame: frame(ethernet({ src: PC.mac, dst: R1.macL }), ...probe(1, 1)) },
        { t: 0.0012, from: 'r1', to: 'pc', label: 'Time exceeded', kind: 'err', proto: 'ICMP', info: 'Time-to-live exceeded (in transit) from 192.168.1.1', note: 'Hop 1 = 192.168.1.1',
          frame: frame(ethernet({ src: R1.macL, dst: PC.mac }), ipv4({ src: R1.lan, dst: PC.ip, proto: 1, ttl: 64, id: 0x0a01, df: false }), icmp({ type: 11, embedded: embedded(1, 1) })) },
      ],
    },
    {
      title: 'TTL = 2', sub: 'One hop further',
      text: 'With TTL 2, R1 forwards it (TTL now 1) toward R2 based on its routing table entry for 172.16.0.0/16. R2 drops it and reports. Hop 2 found.',
      show: [],
      facts: [['Hop 2', `${R2.a} (R2)`], ['R1 route', '172.16.0.0/16 via 10.0.0.2'], ['RTT', '4.8 ms']],
      packets: [
        { t: 0.01, from: 'pc', to: 'r2', label: 'TTL=2', kind: 'req', proto: 'ICMP', info: 'Echo (ping) request id=0x0042 seq=2 ttl=2', note: 'Ping with TTL 2', frame: frame(ethernet({ src: PC.mac, dst: R1.macL }), ...probe(2, 2)) },
        { t: 0.0148, from: 'r2', to: 'pc', label: 'Time exceeded', kind: 'err', proto: 'ICMP', info: 'Time-to-live exceeded (in transit) from 10.0.0.2', note: 'Hop 2 = 10.0.0.2',
          frame: frame(ethernet({ src: R1.macL, dst: PC.mac }), ipv4({ src: R2.a, dst: PC.ip, proto: 1, ttl: 63, id: 0x0b01, df: false }), icmp({ type: 11, embedded: embedded(1, 2) })) },
      ],
    },
    {
      title: 'TTL = 3', sub: 'Reaching the destination',
      text: 'TTL 3 is enough: the packet reaches the server with TTL 1 left, and the server answers with a normal Echo reply. Traceroute stops: the path is PC → R1 → R2 → Server.',
      show: [],
      facts: [['Hop 3', `${SV.ip} (destination)`], ['RTT', '6.1 ms']],
      packets: [
        { t: 0.02, from: 'pc', to: 'server', label: 'TTL=3', kind: 'req', proto: 'ICMP', info: 'Echo (ping) request id=0x0042 seq=3 ttl=3', note: 'Ping with TTL 3', frame: frame(ethernet({ src: PC.mac, dst: R1.macL }), ...probe(3, 3)) },
        { t: 0.0261, from: 'server', to: 'pc', label: 'Echo reply', kind: 'res', proto: 'ICMP', info: 'Echo (ping) reply id=0x0042 seq=3 ttl=62', note: 'Destination reached',
          frame: frame(ethernet({ src: R1.macL, dst: PC.mac }), ipv4({ src: SV.ip, dst: PC.ip, proto: 1, ttl: 62, id: 0xc001, df: false }), icmp({ type: 0, id: 0x0042, seq: 3 })) },
      ],
    },
    {
      title: 'One packet, three links', sub: 'IP stays, MAC changes',
      text: 'Capture the same packet on each link and compare: the IP source and destination never change, but each router writes new MAC addresses (Layer 2 is hop-by-hop) and lowers the TTL, recomputing the checksum. Open each one in the inspector.',
      show: [],
      facts: [['Link 1', `MAC PC → R1, TTL 64`], ['Link 2', 'MAC R1 → R2, TTL 63'], ['Link 3', 'MAC R2 → Server, TTL 62']],
      packets: [
        { t: 0.03, from: 'pc', to: 'r1', label: 'Link 1', kind: 'req', proto: 'ICMP', info: 'Echo request seq=4 ttl=64 (captured on link 1)', note: 'TTL 64, dst MAC = R1',
          frame: frame(ethernet({ src: PC.mac, dst: R1.macL, dstNote: 'R1\'s LAN port. Not the server!' }), ipv4({ src: PC.ip, dst: SV.ip, proto: 1, ttl: 64, id: 0x7704 }), icmp({ type: 8, id: 0x42, seq: 4 })) },
        { t: 0.031, from: 'r1', to: 'r2', label: 'Link 2', kind: 'req', proto: 'ICMP', info: 'Echo request seq=4 ttl=63 (captured on link 2)', note: 'TTL 63, new MACs',
          frame: frame(ethernet({ src: R1.macW, dst: R2.macA, srcNote: 'R1\'s WAN port: rewritten by R1.', dstNote: 'R2: the next hop.' }), ipv4({ src: PC.ip, dst: SV.ip, proto: 1, ttl: 63, id: 0x7704 }), icmp({ type: 8, id: 0x42, seq: 4 })) },
        { t: 0.033, from: 'r2', to: 'server', label: 'Link 3', kind: 'req', proto: 'ICMP', info: 'Echo request seq=4 ttl=62 (captured on link 3)', note: 'TTL 62, new MACs again',
          frame: frame(ethernet({ src: R2.macB, dst: SV.mac, srcNote: 'R2\'s server-side port.', dstNote: 'Finally, the server itself.' }), ipv4({ src: PC.ip, dst: SV.ip, proto: 1, ttl: 62, id: 0x7704 }), icmp({ type: 8, id: 0x42, seq: 4 })) },
      ],
    },
  ],
  quiz: [
    { q: 'What changes at every router hop?', options: ['Source and destination IP', 'MAC addresses and TTL', 'TCP port numbers'], answer: 1, why: 'Layer 2 is per-link; IP addresses are end to end (without NAT).' },
    { q: 'Why does the PC send to the gateway\'s MAC?', options: ['The server is on another network', 'The gateway is faster', 'DNS told it to'], answer: 0, why: 'Off-subnet destinations are reached through the default gateway.' },
    { q: 'How does traceroute discover hop 2?', options: ['It asks DNS', 'Sends TTL=2 and waits for Time exceeded', 'Reads the router\'s config'], answer: 1, why: 'The router where TTL hits 0 reveals itself in its ICMP error.' },
  ],
};
