import { frame, ethernet, ipv4, tcp, udp, icmp, dns, custom, opaqueBytes } from '../../lib/packet.js';

const data = (n, seed, what = 'Video data') => custom({ name: what, osi: 7, summary: `${n} bytes`, fields: [['Payload', opaqueBytes(n, seed), `${n} bytes`, 'Application bytes. TCP just numbers and delivers them.', { opaque: true }]] });

/* ================= Layer 4: TCP flow & congestion control ================= */
const V = { ip: '10.0.0.5', mac: '52:54:00:aa:00:05' };
const S = { ip: '198.51.100.80', mac: '52:54:00:bb:00:80' };
const R = { a: '52:54:00:ff:00:01', b: '52:54:00:ff:01:01' };
const MSS = 1448;
const sv = (seq, o = {}) => frame(ethernet({ src: S.mac, dst: R.b }), ipv4({ src: S.ip, dst: V.ip, ttl: 60 }), tcp({ sport: 443, dport: 50600, flags: ['ACK'], seq, ack: 1, win: 501, ...o }), data(MSS, seq % 97));
const ack = (n, o = {}) => frame(ethernet({ src: V.mac, dst: R.a }), ipv4({ src: V.ip, dst: S.ip }), tcp({ sport: 50600, dport: 443, flags: ['ACK'], seq: 1, ack: n, ...o }));
const seg = (k, t, extra = {}) => ({ t, from: 'server', to: 'client', label: `Seg ${k}`, kind: 'req', proto: 'TCP', info: `443 → 50600 [ACK] Seq=${1 + (k - 1) * MSS} Len=${MSS}`, note: `bytes ${1 + (k - 1) * MSS}–${k * MSS}`, frame: sv(1 + (k - 1) * MSS), ...extra });
const ak = (k, t, extra = {}) => ({ t, from: 'client', to: 'server', label: `ACK ${k}`, kind: 'res', proto: 'TCP', info: `50600 → 443 [ACK] Ack=${1 + k * MSS} Win=${extra.win ?? 65535}`, note: `received everything through segment ${k}`, frame: ack(1 + k * MSS, { win: extra.win ?? 65535 }), ...extra });

export const tcpFlow = {
  id: 'tcpflow',
  layer: 4,
  name: 'TCP Flow & Congestion',
  full: 'How fast should TCP send?',
  tag: 'Slow start, cwnd, rwnd, zero window, AIMD',
  summary:
    'Reliability isn\'t enough: TCP must also avoid drowning the receiver (flow control) and the network (congestion control). The sender may have at most min(cwnd, rwnd) bytes unacknowledged in flight. rwnd is advertised by the receiver in every ACK; cwnd is the sender\'s own estimate of what the network can carry, grown and shrunk by the congestion algorithm.',
  keyIdeas: [
    'Bytes in flight ≤ min(congestion window, receiver window)',
    'Slow start: cwnd doubles every round trip until loss or ssthresh',
    'Flow control: receiver window shrinking to zero, zero-window probes',
    'Congestion avoidance (AIMD): +1 MSS per RTT, halve on loss',
    'Bandwidth-delay product: why long fat networks need big windows',
  ],
  facts: [
    ['OSI layer', 'Transport (4)'],
    ['Flow control', 'Receiver window (rwnd) in every segment'],
    ['Congestion control', 'cwnd: Reno / CUBIC / BBR'],
    ['Initial window', '10 segments on modern stacks (RFC 6928)'],
    ['Defined in', 'RFC 5681, RFC 7323, RFC 9438 (CUBIC)'],
  ],
  legend: [{ kind: 'req', label: 'Data' }, { kind: 'res', label: 'ACK' }, { kind: 'hs', label: 'Window event' }, { kind: 'err', label: 'Lost' }],
  nodes: {
    client: { label: 'Viewer', sub: V.ip, type: 'laptop', x: 150, y: 360 },
    router: { label: 'ISP Router', sub: 'buffer: 50 pkts', type: 'router', x: 500, y: 250 },
    server: { label: 'Video Server', sub: S.ip, type: 'server', x: 850, y: 360 },
  },
  links: [['client', 'router', '100 Mb/s'], ['router', 'server', '1 Gb/s']],
  seq: ['client', 'server'],
  steps: [
    {
      title: 'Slow start: round 1', sub: 'cwnd = 1 segment',
      text: 'The connection is new, so the server has no idea how much the path can carry. It starts cautiously. We use cwnd = 1 segment so the growth is easy to see (real stacks start at 10). It sends one segment and waits for the ACK, a full round trip.',
      deep: [
        'A round trip (RTT) is the time for a segment to reach the receiver and its ACK to come back. TCP\'s sending rate is roughly cwnd / RTT.',
        'Each ACK that acknowledges new data increases cwnd by one MSS during slow start. One ACK per segment means cwnd doubles each RTT: exponential growth, despite the name "slow".',
      ],
      show: ['client', 'router', 'server'],
      facts: [['cwnd', '1 MSS (1448 B)'], ['rwnd', '65,535 B'], ['ssthresh', '∞ (unknown)'], ['In flight', '1 segment']],
      packets: [seg(1, 0), ak(1, 0.04)],
    },
    {
      title: 'Slow start: rounds 2–3', sub: 'Doubling every RTT',
      text: 'After one ACK, cwnd is 2: two segments go out back-to-back. Their ACKs make cwnd 4. Watch the timeline: each round trip carries twice as much as the last. Within ~10 RTTs a connection can go from 1 to 1,000 segments in flight.',
      deep: ['Receivers often use delayed ACKs (one ACK per two segments, or after 40–200 ms) to save packets. Stacks compensate with "appropriate byte counting", growing cwnd by the bytes acknowledged rather than by the number of ACKs.'],
      show: [],
      facts: [['Round 2', 'cwnd 2 → 4'], ['Round 3', 'cwnd 4 → 8'], ['Throughput', '≈ doubles per RTT']],
      packets: [seg(2, 0.041), seg(3, 0.0411), ak(3, 0.081), seg(4, 0.082), seg(5, 0.0821), seg(6, 0.0822), seg(7, 0.0823), ak(7, 0.122)],
    },
    {
      title: 'The receiver can\'t keep up', sub: 'Flow control: window → 0',
      text: 'The viewer\'s laptop is busy and its app isn\'t reading the socket. The receive buffer fills, and each ACK advertises a smaller window, until one says Win=0: "stop, I have no room". The server must stop sending, however large cwnd is. That\'s flow control, protecting the receiver.',
      deep: [
        'While the window is zero the sender sends tiny zero-window probes on a backoff timer. Otherwise, if the window-update ACK were lost, both sides would wait for each other forever (deadlock).',
        'Wireshark highlights these as [TCP ZeroWindow] and [TCP Window Full]. Seeing them in a capture means the receiving application is the bottleneck, not the network.',
      ],
      show: [],
      facts: [['rwnd', '65,535 → 0'], ['Sender', 'Paused, sending zero-window probes'], ['Bottleneck', 'Receiving app']],
      packets: [
        ak(7, 0.2, { label: 'Win=0', kind: 'hs', info: '50600 → 443 [ACK] Ack=10137 Win=0 [TCP ZeroWindow]', note: 'Buffer full: stop sending!', win: 0 }),
        { t: 0.5, from: 'server', to: 'client', label: 'Probe', kind: 'hs', proto: 'TCP', info: '443 → 50600 [ACK] Seq=10136 Len=0 [TCP ZeroWindowProbe]', note: 'Any room yet?', frame: frame(ethernet({ src: S.mac, dst: R.b }), ipv4({ src: S.ip, dst: V.ip, ttl: 60 }), tcp({ sport: 443, dport: 50600, flags: ['ACK'], seq: 10136, ack: 1, win: 501 })) },
        ak(7, 0.6, { label: 'Win update', kind: 'hs', info: '50600 → 443 [ACK] Ack=10137 Win=65535 [TCP Window Update]', note: 'App read the data: room for 64 KB again', win: 65535 }),
      ],
    },
    {
      title: 'Congestion: a router overflows', sub: 'Loss = slow down',
      text: 'Sending faster and faster eventually exceeds the bottleneck: the 100 Mb/s link. The router\'s queue fills and it drops segment 9. The viewer keeps ACKing 8 (duplicate ACKs). After three duplicates the server fast-retransmits segment 9 and halves cwnd: multiplicative decrease.',
      deep: [
        'TCP treats loss as the network\'s way of saying "too fast". This shared rule is why millions of flows can share the internet without collapsing (it did collapse in 1986, before Van Jacobson added congestion control).',
        'ssthresh is set to half the cwnd at the time of loss. Below ssthresh TCP uses slow start; above it, congestion avoidance.',
        'Modern alternatives: CUBIC (Linux/Windows default) grows cwnd along a cubic curve tuned for fast links. BBR (Google) estimates bottleneck bandwidth and RTT directly instead of waiting for loss.',
      ],
      show: [],
      facts: [['Lost', 'Segment 9 (router queue full)'], ['cwnd', '16 → 8 (halved)'], ['ssthresh', '8 segments']],
      packets: [
        seg(8, 0.61),
        seg(9, 0.6101, { lost: true, lostAt: 0.5, kind: 'err', label: 'Seg 9', info: '443 → 50600 Seq=11585 Len=1448 [dropped: queue full]', note: 'Router queue full: dropped', lostWhy: 'ISP router: the 100 Mb/s link is busy and its 50-packet queue is full, so it drops the segment (tail drop).' }),
        seg(10, 0.6102),
        ak(8, 0.65, { label: 'Dup ACK ×3', kind: 'res', info: '50600 → 443 [ACK] Ack=11585 [TCP Dup ACK #3]', note: 'Still missing segment 9!' }),
        seg(9, 0.66, { label: 'Retransmit 9', info: '443 → 50600 Seq=11585 Len=1448 [TCP Fast Retransmission]', note: 'Fast retransmission of segment 9' }),
        ak(10, 0.7),
      ],
    },
    {
      title: 'Congestion avoidance', sub: 'Additive increase',
      text: 'Now above ssthresh, TCP probes gently: +1 segment per round trip instead of doubling. Over time cwnd follows a sawtooth: climb slowly, lose a packet, halve, climb again. This is AIMD (additive increase, multiplicative decrease), and it makes competing flows converge to a fair share.',
      deep: [
        'Bandwidth-delay product: to fill a 100 Mb/s path with 40 ms RTT you need 100e6 × 0.04 / 8 = 500 KB in flight. The original 16-bit window field maxes out at 64 KB, so TCP\'s window-scale option (negotiated in the SYN) multiplies it by up to 2¹⁴.',
        'Bufferbloat: if router queues are huge, loss arrives late and latency soars (hundreds of ms) before TCP backs off. Active queue management (CoDel, fq_codel) drops early to keep queues short.',
      ],
      show: [],
      facts: [['Growth', '+1 MSS per RTT'], ['Pattern', 'Sawtooth (AIMD)'], ['Fairness', 'Flows converge to equal share']],
      packets: [seg(11, 0.71), seg(12, 0.7101), ak(12, 0.75)],
    },
  ],
  quiz: [
    { q: 'A sender may have at most how many bytes in flight?', options: ['cwnd + rwnd', 'min(cwnd, rwnd)', 'Always 64 KB'], answer: 1, why: 'Both the network (cwnd) and receiver (rwnd) limits must be respected.' },
    { q: 'An ACK with Win=0 means…', options: ['The network is congested', 'The receiver\'s buffer is full: stop sending', 'The connection is closing'], answer: 1, why: 'Zero window is flow control from the receiver.' },
    { q: 'During slow start, cwnd…', options: ['Grows by 1 MSS per RTT', 'Doubles roughly every RTT', 'Stays fixed'], answer: 1, why: '+1 MSS per ACK means doubling per round trip.' },
    { q: 'What does TCP do to cwnd after detecting loss via dup ACKs?', options: ['Doubles it', 'Halves it (multiplicative decrease)', 'Sets it to 0'], answer: 1, why: 'Loss signals congestion; AIMD halves the window.' },
  ],
};

/* ================= Layer 4: Ports & multiplexing ================= */
const L = { ip: '192.168.1.10', mac: '3c:22:fb:10:4a:10' };
const GW = '00:1e:58:a1:00:01';
const SRVA = '203.0.113.10';
const lo = () => ethernet({ src: L.mac, dst: GW });
const li = () => ethernet({ src: GW, dst: L.mac });
const syn = (sport, dport, t, o = {}) => ({ t, from: 'laptop', to: 'server', label: `SYN →${dport}`, kind: 'tcp', proto: 'TCP', info: `${sport} → ${dport} [SYN]`, note: `${L.ip}:${sport} → ${SRVA}:${dport}`,
  frame: frame(lo(), ipv4({ src: L.ip, dst: SRVA, ttl: 128 }), tcp({ sport, dport, flags: ['SYN'], opts: true })), ...o });

export const ports = {
  id: 'ports',
  layer: 4,
  name: 'Ports & Multiplexing',
  full: 'Many conversations, one IP address',
  tag: 'Sockets, 4-tuples, open/closed/filtered ports',
  summary:
    'An IP address gets data to the right computer; a port number gets it to the right program. Every connection is identified by a 4-tuple (source IP, source port, destination IP, destination port), so one laptop can hold hundreds of simultaneous conversations, even several with the same server and service. This is called multiplexing.',
  keyIdeas: [
    'Well-known (0–1023), registered (1024–49151) and ephemeral (49152–65535) ports',
    'A socket = IP + port; a connection = the 4-tuple (5-tuple with protocol)',
    'How the OS demultiplexes incoming segments to the right process',
    'Open vs closed (RST) vs filtered (silence) ports, as seen by scanners',
    'Inspecting sockets with netstat / ss',
  ],
  facts: [
    ['OSI layer', 'Transport (4)'],
    ['Port field', '16 bits → 0–65535'],
    ['Well-known', '22 SSH · 25 SMTP · 53 DNS · 80 HTTP · 443 HTTPS'],
    ['Ephemeral range', '49152–65535 (IANA; Linux uses 32768–60999)'],
    ['Registry', 'IANA service name & port registry'],
  ],
  legend: [{ kind: 'tcp', label: 'SYN' }, { kind: 'res', label: 'SYN-ACK' }, { kind: 'dns', label: 'UDP' }, { kind: 'err', label: 'Reset / dropped' }],
  nodes: {
    laptop: { label: 'Laptop', sub: `${L.ip}\nbrowser · music · game`, type: 'laptop', x: 130, y: 370 },
    router: { label: 'Router', sub: '192.168.1.1', type: 'router', x: 380, y: 280 },
    inet: { label: 'Internet', type: 'cloud', x: 610, y: 330 },
    server: { label: 'Server', sub: `${SRVA}\n:443 open · :8080 closed · :23 filtered`, type: 'server', x: 860, y: 230 },
  },
  links: [['laptop', 'router'], ['router', 'inet'], ['inet', 'server']],
  seq: ['laptop', 'inet', 'server'],
  steps: [
    {
      title: 'Two tabs, one server', sub: 'Same destination, different source ports',
      text: 'Two browser tabs open connections to the same server on port 443. The OS gives each a different ephemeral source port (51000, 51001). The 4-tuples differ, so they are completely separate connections with separate sequence numbers, windows and buffers.',
      deep: [
        'A listening server socket (0.0.0.0:443) accepts connections; each accepted connection gets its own socket, identified by the full 4-tuple. That\'s how one web server port serves 10,000 clients at once.',
        'Running out of ephemeral ports (port exhaustion) happens on busy proxies that make many short outbound connections: each closed connection lingers in TIME_WAIT for up to 2 minutes.',
      ],
      show: ['laptop', 'router', 'inet', 'server'],
      facts: [['Tab 1', `${L.ip}:51000 ↔ ${SRVA}:443`], ['Tab 2', `${L.ip}:51001 ↔ ${SRVA}:443`]],
      packets: [syn(51000, 443, 0), syn(51001, 443, 0.002),
        { t: 0.03, from: 'server', to: 'laptop', label: 'SYN-ACK →51000', kind: 'res', proto: 'TCP', info: '443 → 51000 [SYN, ACK]', note: 'Reply demultiplexed to tab 1 by port 51000', frame: frame(li(), ipv4({ src: SRVA, dst: L.ip, ttl: 52 }), tcp({ sport: 443, dport: 51000, flags: ['SYN', 'ACK'], ack: 1, opts: true })) },
        { t: 0.031, from: 'server', to: 'laptop', label: 'SYN-ACK →51001', kind: 'res', proto: 'TCP', info: '443 → 51001 [SYN, ACK]', note: 'Reply demultiplexed to tab 2 by port 51001', frame: frame(li(), ipv4({ src: SRVA, dst: L.ip, ttl: 52 }), tcp({ sport: 443, dport: 51001, flags: ['SYN', 'ACK'], ack: 1, opts: true })) },
      ],
    },
    {
      title: 'Meanwhile, over UDP…', sub: 'Separate port spaces',
      text: 'At the same moment the music app looks up a name over UDP. TCP port 51000 and UDP port 51000 are unrelated: the protocol number is part of the identity (the 5-tuple). The OS hands the reply to whichever process is bound to that UDP port.',
      show: [],
      facts: [['Music app', `UDP ${L.ip}:62000 → 8.8.8.8:53`], ['Identity', '5-tuple incl. protocol']],
      packets: [
        { t: 0.01, from: 'laptop', to: 'inet', label: 'DNS (UDP)', kind: 'dns', proto: 'DNS', info: 'Standard query A cdn.music.example', note: 'UDP 62000 → 53', dst: '8.8.8.8', frame: frame(lo(), ipv4({ src: L.ip, dst: '8.8.8.8', proto: 17, df: false }), udp({ sport: 62000, dport: 53 }), dns({ id: 0x77a1, qname: 'cdn.music.example' })) },
      ],
    },
    {
      title: 'Knocking on a closed port', sub: 'RST: "nobody lives here"',
      text: 'The laptop tries port 8080, where nothing is listening. The server\'s OS answers immediately with RST, ACK: "connection refused". The fast, explicit refusal tells you the host is up but the service isn\'t running.',
      deep: ['For UDP the equivalent is an ICMP "port unreachable" (type 3, code 3). That\'s how `traceroute` on Linux knows it reached the destination, since it probes high UDP ports.'],
      show: [],
      facts: [['Port 8080', 'closed'], ['Response', 'RST, ACK'], ['App sees', 'ECONNREFUSED']],
      packets: [syn(51002, 8080, 1.0),
        { t: 1.03, from: 'server', to: 'laptop', label: 'RST', kind: 'err', proto: 'TCP', info: '8080 → 51002 [RST, ACK] Seq=1 Ack=1', note: 'Connection refused', frame: frame(li(), ipv4({ src: SRVA, dst: L.ip, ttl: 52 }), tcp({ sport: 8080, dport: 51002, flags: ['RST', 'ACK'], seq: 0, ack: 1, win: 0 })) },
      ],
    },
    {
      title: 'A filtered port', sub: 'Silence from a firewall',
      text: 'Port 23 (telnet) is blocked by the server\'s firewall, which silently drops the SYN. The laptop hears nothing and retransmits the SYN with exponential backoff (1 s, 2 s, 4 s…) before giving up with a timeout. Scanners like nmap call this "filtered".',
      deep: ['Dropping is stealthier than rejecting and wastes the attacker\'s time, but it also makes legitimate failures slow to diagnose. Internal networks often prefer REJECT (send RST) for faster errors.'],
      show: [],
      facts: [['Port 23', 'filtered (dropped)'], ['Client', 'SYN retries: 1 s, 2 s, 4 s…'], ['App sees', 'ETIMEDOUT after ~20 s']],
      packets: [syn(51003, 23, 2.0, { lost: true, lostAt: 0.85, kind: 'err', note: 'Dropped by firewall: no reply at all', lostWhy: 'Server firewall: rule "drop tcp/23" discards the SYN silently.' })],
    },
    {
      title: 'See it yourself', sub: 'netstat / ss',
      text: 'Run `netstat -ano` (Windows) or `ss -tunap` (Linux) to list every socket: protocol, local address:port, remote address:port, state (LISTEN, ESTABLISHED, TIME_WAIT…) and the owning process ID. Port numbers are how the OS keeps all these conversations apart.',
      show: [],
      facts: [['TCP 192.168.1.10:51000', '203.0.113.10:443 ESTABLISHED'], ['TCP 192.168.1.10:51001', '203.0.113.10:443 ESTABLISHED'], ['UDP 192.168.1.10:62000', '*:*'], ['TCP 0.0.0.0:135', 'LISTENING']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'What uniquely identifies a TCP connection?', options: ['The destination port', 'The 4-tuple: src IP, src port, dst IP, dst port', 'The MAC address'], answer: 1, why: 'Two tabs to the same server:443 differ only by source port.' },
    { q: 'A SYN to a port with no listener usually gets…', options: ['SYN-ACK', 'RST', 'No reply'], answer: 1, why: 'The OS refuses with a reset; silence suggests a firewall.' },
    { q: 'Which range are ephemeral ports drawn from (IANA)?', options: ['0–1023', '1024–49151', '49152–65535'], answer: 2, why: 'Clients pick temporary source ports from the dynamic range.' },
  ],
};

/* ================= Layer 3: NAT ================= */
const PH = { ip: '192.168.1.11', mac: '3c:22:fb:10:4a:11' };
const PUB = '198.51.100.7';
const ISP = '00:aa:bb:cc:dd:01';
const RW = '00:1e:58:a1:00:02';
const WEB = '203.0.113.10';
const nat = (sport, natPort, who) => `NAT router: rewrites source ${who}:${sport} → ${PUB}:${natPort}, records the mapping, fixes IP and TCP checksums.`;

export const natLesson = {
  id: 'nat',
  layer: 3,
  name: 'NAT',
  full: 'Network Address Translation',
  tag: 'Private addresses sharing one public IP',
  summary:
    'There aren\'t enough IPv4 addresses for every device, so homes and offices use private addresses (like 192.168.x.x) internally and share one public address. The router rewrites the source IP and port of every outgoing packet and remembers the mapping, so replies can be translated back. This is NAT with port translation (PAT / NAPT).',
  keyIdeas: [
    'Private ranges (RFC 1918): 10/8, 172.16/12, 192.168/16, not routable on the internet',
    'How the NAT table maps inside IP:port ↔ outside IP:port',
    'Why two devices can use the same source port at once',
    'Why unsolicited inbound traffic is dropped, and port forwarding',
    'Side effects: checksums, "NAT breaks end-to-end", CGNAT, and IPv6 as the long-term fix',
  ],
  facts: [
    ['OSI layer', 'Network (3), also rewrites Layer 4 ports'],
    ['Private ranges', '10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16'],
    ['Type shown', 'NAPT / PAT (many-to-one)'],
    ['Mapping timeout', '≈ 2–5 min UDP, hours for TCP'],
    ['Defined in', 'RFC 1918, RFC 3022, RFC 4787'],
  ],
  legend: [{ kind: 'req', label: 'Inside → out' }, { kind: 'res', label: 'Reply' }, { kind: 'err', label: 'Blocked' }],
  nodes: {
    laptop: { label: 'Laptop', sub: '192.168.1.10', type: 'laptop', x: 100, y: 230 },
    phone: { label: 'Phone', sub: PH.ip, type: 'phone', x: 100, y: 430 },
    router: { label: 'NAT Router', sub: `LAN 192.168.1.1\nWAN ${PUB}`, type: 'router', x: 400, y: 320 },
    inet: { label: 'Internet', type: 'cloud', x: 640, y: 320 },
    web: { label: 'Web Server', sub: WEB, type: 'server', x: 880, y: 220 },
    attacker: { label: 'Scanner', sub: '192.0.2.66', type: 'laptop', x: 880, y: 440 },
  },
  links: [['laptop', 'router'], ['phone', 'router'], ['router', 'inet'], ['inet', 'web'], ['inet', 'attacker']],
  seq: ['laptop', 'phone', 'router', 'web', 'attacker'],
  steps: [
    {
      title: 'Private inside, public outside', sub: 'RFC 1918 addresses',
      text: 'The laptop (192.168.1.10) and phone (192.168.1.11) use private addresses. Millions of other homes use the very same ones, so internet routers refuse to route them. Only the router\'s WAN side has a real public address: 198.51.100.7.',
      deep: ['Many ISPs now put customers behind a second layer, carrier-grade NAT (CGNAT, 100.64.0.0/10). That\'s why hosting a game server from home can be impossible without IPv6 or a tunnel.'],
      show: ['laptop', 'phone', 'router', 'inet', 'web', 'attacker'],
      facts: [['Inside', '192.168.1.0/24'], ['Outside', PUB], ['NAT table', '(empty)']],
      packets: [],
    },
    {
      title: 'Going out', sub: 'Source rewritten',
      text: 'The laptop sends a SYN from 192.168.1.10:52344 to the web server. On the LAN capture (packet 1) the source is private. On the WAN capture (packet 2) the router has replaced it with 198.51.100.7:40001 and logged the mapping. The web server only ever sees the public address.',
      deep: ['Because the IP source changes, the router must recompute the IP header checksum, and also the TCP/UDP checksum, which covers a pseudo-header containing the IP addresses. Open both packets in the inspector and compare.'],
      show: [],
      facts: [['NAT entry', '192.168.1.10:52344 ↔ 198.51.100.7:40001'], ['Destination', `${WEB}:443 (unchanged)`]],
      packets: [
        { t: 0, from: 'laptop', to: 'router', label: 'SYN (LAN)', kind: 'req', proto: 'TCP', info: '192.168.1.10:52344 → 203.0.113.10:443 [SYN] (LAN side)', note: 'Source is private: 192.168.1.10:52344',
          frame: frame(ethernet({ src: '3c:22:fb:10:4a:10', dst: '00:1e:58:a1:00:01' }), ipv4({ src: '192.168.1.10', dst: WEB, ttl: 128, srcNote: 'Private address: only meaningful inside this home.' }), tcp({ sport: 52344, dport: 443, flags: ['SYN'], opts: true })) },
        { t: 0.001, from: 'router', to: 'web', label: 'SYN (WAN)', kind: 'req', proto: 'TCP', info: '198.51.100.7:40001 → 203.0.113.10:443 [SYN] (WAN side, translated)', note: 'Source rewritten: 198.51.100.7:40001',
          hold: { inet: 'Internet routers forward it normally: the source is now a real public address.' },
          frame: frame(ethernet({ src: RW, dst: ISP }), ipv4({ src: PUB, dst: WEB, ttl: 127, srcNote: 'Rewritten by NAT: the router\'s public address.' }), tcp({ sport: 40001, dport: 443, flags: ['SYN'], opts: true, seqNote: 'Unchanged by NAT.' })) },
      ],
    },
    {
      title: 'Coming back', sub: 'Reverse translation',
      text: 'The SYN-ACK arrives addressed to 198.51.100.7:40001. The router looks up port 40001 in its NAT table, finds 192.168.1.10:52344, rewrites the destination, and forwards it into the LAN. The laptop never knows translation happened.',
      show: [],
      facts: [['Lookup', ':40001 → 192.168.1.10:52344'], ['Rewritten', 'Destination IP + port']],
      packets: [
        { t: 0.03, from: 'web', to: 'router', label: 'SYN-ACK (WAN)', kind: 'res', proto: 'TCP', info: '203.0.113.10:443 → 198.51.100.7:40001 [SYN, ACK]', note: 'Addressed to the public IP',
          frame: frame(ethernet({ src: ISP, dst: RW }), ipv4({ src: WEB, dst: PUB, ttl: 52 }), tcp({ sport: 443, dport: 40001, flags: ['SYN', 'ACK'], ack: 1, opts: true })) },
        { t: 0.031, from: 'router', to: 'laptop', label: 'SYN-ACK (LAN)', kind: 'res', proto: 'TCP', info: '203.0.113.10:443 → 192.168.1.10:52344 [SYN, ACK] (translated back)', note: 'Destination restored: 192.168.1.10:52344',
          hold: {}, frame: frame(ethernet({ src: '00:1e:58:a1:00:01', dst: '3c:22:fb:10:4a:10' }), ipv4({ src: WEB, dst: '192.168.1.10', ttl: 51 }), tcp({ sport: 443, dport: 52344, flags: ['SYN', 'ACK'], ack: 1, opts: true })) },
      ],
    },
    {
      title: 'Two devices, same port', sub: 'Port translation saves the day',
      text: 'By coincidence the phone also picks source port 52344 to the same server. If the router only changed IPs, replies would be ambiguous. So it maps the phone to a different public port, 40002. One public IP can support ~64,000 simultaneous connections per destination.',
      show: [],
      facts: [['Laptop', '192.168.1.10:52344 ↔ :40001'], ['Phone', '192.168.1.11:52344 ↔ :40002']],
      packets: [
        { t: 0.5, from: 'phone', to: 'web', label: 'SYN', kind: 'req', proto: 'TCP', info: '192.168.1.11:52344 → 203.0.113.10:443 [SYN] → translated to :40002', note: 'Mapped to 198.51.100.7:40002',
          hold: { router: nat(52344, 40002, PH.ip) },
          frame: frame(ethernet({ src: RW, dst: ISP }), ipv4({ src: PUB, dst: WEB, ttl: 63 }), tcp({ sport: 40002, dport: 443, flags: ['SYN'], opts: true })) },
      ],
    },
    {
      title: 'Uninvited guests', sub: 'No mapping, no entry',
      text: 'A scanner sends a SYN to 198.51.100.7:3389. There\'s no NAT table entry for that port, so the router has no idea which inside device it\'s for and drops it. That\'s why NAT incidentally acts like a basic firewall, and why hosting a server needs an explicit port-forwarding rule.',
      deep: [
        'Port forwarding is a static NAT entry such as "WAN:25565 → 192.168.1.10:25565". UPnP lets apps create these automatically, which is convenient but risky.',
        'Peer-to-peer apps (video calls, games) use NAT traversal tricks like STUN and hole punching, or relay through a TURN server, when both peers are behind NAT.',
        'IPv6 has enough addresses (2¹²⁸) for every device to be globally reachable, so NAT isn\'t needed. A stateful firewall provides the protection instead.',
      ],
      show: [],
      facts: [['Inbound to', `${PUB}:3389`], ['NAT entry', 'none → dropped'], ['To allow', 'port forwarding rule']],
      packets: [
        { t: 9, from: 'attacker', to: 'router', label: 'SYN :3389', kind: 'err', proto: 'TCP', info: '192.0.2.66:61000 → 198.51.100.7:3389 [SYN] (no NAT mapping: dropped)', note: 'No mapping: dropped', lost: true, lostAt: 0.93, lostWhy: 'NAT router: no table entry for port 3389, so it can\'t know which inside host this is for. Dropped.',
          frame: frame(ethernet({ src: ISP, dst: RW }), ipv4({ src: '192.0.2.66', dst: PUB, ttl: 50 }), tcp({ sport: 61000, dport: 3389, flags: ['SYN'] })) },
      ],
    },
  ],
  quiz: [
    { q: 'Which is a private (RFC 1918) address?', options: ['8.8.8.8', '172.20.4.1', '203.0.113.10'], answer: 1, why: '172.16.0.0/12 covers 172.16–172.31.' },
    { q: 'How does NAT tell two inside devices apart on one public IP?', options: ['By MAC address', 'By assigning different public source ports', 'It can\'t'], answer: 1, why: 'Port translation (PAT) gives each flow a unique public port.' },
    { q: 'Why is an unsolicited inbound SYN dropped?', options: ['TTL expired', 'No NAT mapping exists for it', 'Wrong checksum'], answer: 1, why: 'Without a mapping the router can\'t pick an inside destination.' },
  ],
};

/* ================= Layer 3: Fragmentation & MTU ================= */
const H = { ip: '10.10.0.5', mac: '52:54:00:10:00:05' };
const D = { ip: '172.20.0.9', mac: '52:54:00:20:00:09' };
const R1 = { l: '52:54:00:ee:00:01', w: '52:54:00:ee:00:02' };
const R2 = { a: '52:54:00:dd:00:01', b: '52:54:00:dd:00:02' };
const BIG = 1472; // UDP data → 1500-byte IP packet
const original = frame(ipv4({ src: H.ip, dst: D.ip, proto: 17, id: 0x5a5a, df: false }), udp({ sport: 40400, dport: 9999 }), data(BIG, 3, 'Sensor batch'));
const payload = original.bytes.slice(20); // UDP header + data = 1480 bytes
const piece = (bytes, start, label) => custom({ name: label, osi: 4, summary: `${bytes.length} bytes of the original payload`, fields: [['Fragment data', bytes, `bytes ${start}–${start + bytes.length - 1}`, start === 0 ? 'Starts with the UDP header; the rest of the datagram follows in later fragments.' : 'Continuation. No UDP header here: only the first fragment has ports!', { opaque: start !== 0 }]] });

export const fragmentation = {
  id: 'frag',
  layer: 3,
  name: 'MTU & Fragmentation',
  full: 'When a packet is too big for the next link',
  tag: 'Fragment offsets, DF bit, Path MTU discovery',
  summary:
    'Every link has a Maximum Transmission Unit: the largest packet it can carry (1500 bytes on Ethernet, less on some VPN tunnels). If a packet is bigger than the next link\'s MTU, IPv4 can split it into fragments that are reassembled at the destination. Or, if fragmenting isn\'t allowed, the router reports back so the sender can shrink its packets.',
  keyIdeas: [
    'MTU vs MSS: 1500-byte packet = 20 IP + 20 TCP + 1460 data',
    'How Identification, MF flag and Fragment Offset (×8 bytes) rebuild a packet',
    'Only the destination reassembles, and losing one fragment loses the whole packet',
    'DF bit + ICMP "Fragmentation needed" = Path MTU Discovery',
    'Why black-hole routers and blocked ICMP cause mysterious hangs; MSS clamping',
  ],
  facts: [
    ['OSI layer', 'Network (3)'],
    ['Ethernet MTU', '1500 bytes (jumbo: 9000)'],
    ['Minimum IPv4 MTU', '68 bytes (IPv6: 1280)'],
    ['Offset unit', '8 bytes'],
    ['Defined in', 'RFC 791, RFC 1191 (PMTUD), RFC 8900'],
  ],
  legend: [{ kind: 'req', label: 'Packet / fragment' }, { kind: 'err', label: 'ICMP error' }],
  nodes: {
    host: { label: 'Sensor hub', sub: H.ip, type: 'laptop', x: 100, y: 360 },
    r1: { label: 'R1', sub: 'MTU 1500 →', type: 'router', x: 360, y: 260 },
    r2: { label: 'R2 (VPN)', sub: '→ MTU 1000 tunnel', type: 'router', x: 640, y: 260 },
    dst: { label: 'Collector', sub: D.ip, type: 'server', x: 890, y: 360 },
  },
  links: [['host', 'r1', 'MTU 1500'], ['r1', 'r2', 'MTU 1500'], ['r2', 'dst', 'MTU 1000']],
  seq: ['host', 'r1', 'r2', 'dst'],
  steps: [
    {
      title: 'A full-size packet', sub: '1500 bytes, DF not set',
      text: 'The sensor hub sends a 1500-byte UDP datagram: 20-byte IP header, 8-byte UDP header and 1472 bytes of data. That\'s exactly Ethernet\'s MTU, so it crosses the first two links fine. But R2 forwards into a VPN tunnel whose MTU is only 1000.',
      deep: ['Tunnels add their own headers (IPsec, GRE, WireGuard ≈ 60–80 bytes), so the inner packet must be smaller than 1500. Mismatched MTUs are one of the most common causes of "small pages load, big downloads hang".'],
      show: ['host', 'r1', 'r2', 'dst'],
      facts: [['Packet', '1500 B (20 IP + 8 UDP + 1472)'], ['DF', '0 (fragmenting allowed)'], ['Next-link MTU at R2', '1000 B']],
      packets: [
        { t: 0, from: 'host', to: 'r2', label: '1500 B', kind: 'req', proto: 'UDP', info: '10.10.0.5 → 172.20.0.9 UDP 40400 → 9999 Len=1472 (1500 B packet)', note: 'Full-size packet heading for a smaller link',
          frame: frame(ethernet({ src: H.mac, dst: R1.l }), ipv4({ src: H.ip, dst: D.ip, proto: 17, id: 0x5a5a, df: false }), udp({ sport: 40400, dport: 9999 }), data(BIG, 3, 'Sensor batch')) },
      ],
    },
    {
      title: 'R2 fragments it', sub: 'Two pieces, same ID',
      text: 'R2 splits the 1480-byte payload into fragments that fit in 1000 bytes. Fragment 1 carries bytes 0–975 (MF=1, offset 0). Fragment 2 carries bytes 976–1479 (MF=0, offset 976). Both keep Identification 0x5a5a, so the destination knows they belong together. Each piece gets its own 20-byte IP header.',
      deep: [
        'Fragment data sizes (except the last) must be multiples of 8, because the offset field counts 8-byte units: 1000 − 20 = 980 → rounded down to 976 = 122 × 8.',
        'Only the first fragment contains the UDP/TCP header with port numbers. Firewalls and load balancers that look at ports struggle with later fragments, one reason fragmentation is disliked.',
        'IPv6 routers never fragment. Only the sending host may, using a Fragment extension header.',
      ],
      show: [],
      facts: [['Fragment 1', '20 + 976 B · MF=1 · offset 0'], ['Fragment 2', '20 + 504 B · MF=0 · offset 976'], ['Shared ID', '0x5a5a']],
      packets: [
        { t: 0.002, from: 'r2', to: 'dst', label: 'Frag 1', kind: 'req', proto: 'IPv4', info: 'Fragmented IP protocol (proto=UDP, off=0, ID=5a5a) [MF]', note: 'Offset 0, more fragments follow',
          frame: frame(ethernet({ src: R2.b, dst: D.mac }), ipv4({ src: H.ip, dst: D.ip, proto: 17, id: 0x5a5a, df: false, mf: true, fragOffset: 0, ttl: 62 }), piece(payload.slice(0, 976), 0, 'Fragment 1 payload')) },
        { t: 0.0021, from: 'r2', to: 'dst', label: 'Frag 2', kind: 'req', proto: 'IPv4', info: 'Fragmented IP protocol (proto=UDP, off=976, ID=5a5a)', note: 'Offset 976, last fragment',
          frame: frame(ethernet({ src: R2.b, dst: D.mac }), ipv4({ src: H.ip, dst: D.ip, proto: 17, id: 0x5a5a, df: false, fragOffset: 976, ttl: 62 }), piece(payload.slice(976), 976, 'Fragment 2 payload')) },
      ],
    },
    {
      title: 'Reassembly', sub: 'Only at the destination',
      text: 'Intermediate routers never reassemble: fragments might even take different paths. The collector buffers pieces by (source, destination, protocol, ID), places each at offset × 8, and when the MF=0 piece arrives and there are no gaps, rebuilds the original 1480-byte datagram and hands it to UDP.',
      deep: ['If any fragment is lost, the whole datagram is discarded after a reassembly timeout (~30–60 s). With 10 fragments and 1% loss each, ~10% of datagrams die. Fragmentation multiplies loss.'],
      show: [],
      facts: [['Key', 'src, dst, protocol, ID'], ['Complete when', 'MF=0 received and no gaps'], ['Timeout', '≈ 30–60 s']],
      packets: [],
    },
    {
      title: 'Don\'t Fragment', sub: 'DF=1 and an ICMP error',
      text: 'TCP traffic normally sets DF=1. When a 1500-byte DF packet reaches R2, it can\'t be fragmented, so R2 drops it and sends back ICMP type 3, code 4: "Fragmentation needed, next-hop MTU 1000". The sender remembers the path MTU and resends smaller packets. That\'s Path MTU Discovery.',
      deep: [
        'PMTUD black holes: some firewalls block all ICMP "for security". Then the error never arrives, big packets vanish silently and connections hang after the handshake (small packets work, large ones don\'t). Never block ICMP type 3 code 4!',
        'Workarounds: routers "clamp" the TCP MSS option in SYN packets to fit the tunnel (e.g. 1360), and modern stacks use packetization-layer PMTUD (RFC 4821), probing sizes without relying on ICMP.',
      ],
      show: [],
      facts: [['DF', '1'], ['R2 action', 'Drop + ICMP 3/4 (MTU 1000)'], ['Sender', 'Path MTU = 1000 → resend']],
      packets: [
        { t: 1, from: 'host', to: 'r2', label: 'DF 1500 B', kind: 'req', proto: 'TCP', info: '10.10.0.5:50800 → 172.20.0.9:443 [ACK] Len=1460 (DF set)', note: 'Too big, and fragmenting is forbidden', lost: true, lostAt: 0.98, lostWhy: 'R2: packet is 1500 B, the tunnel MTU is 1000 and DF=1, so it must drop it and report back.',
          frame: frame(ethernet({ src: H.mac, dst: R1.l }), ipv4({ src: H.ip, dst: D.ip, id: 0x6b01 }), tcp({ sport: 50800, dport: 443, flags: ['ACK'], seq: 1, ack: 1 }), data(1460, 7, 'Upload data')) },
        { t: 1.004, from: 'r2', to: 'host', label: 'Frag needed', kind: 'err', proto: 'ICMP', info: 'Destination unreachable (Fragmentation needed) next-hop MTU 1000', note: 'Use packets ≤ 1000 bytes on this path',
          frame: frame(ethernet({ src: R1.l, dst: H.mac }), ipv4({ src: '10.20.0.2', dst: H.ip, proto: 1, df: false, ttl: 63 }), icmp({ type: 3, code: 4, mtu: 1000, embedded: frame(ipv4({ src: H.ip, dst: D.ip, id: 0x6b01 }), tcp({ sport: 50800, dport: 443, flags: ['ACK'], seq: 1, ack: 1 }), data(1460, 7)).bytes.slice(0, 28) })) },
        { t: 1.01, from: 'host', to: 'dst', label: 'Resend 1000 B', kind: 'req', proto: 'TCP', info: '10.10.0.5:50800 → 172.20.0.9:443 [ACK] Len=960 (fits path MTU)', note: 'Smaller segments now fit end to end',
          frame: frame(ethernet({ src: H.mac, dst: R1.l }), ipv4({ src: H.ip, dst: D.ip, id: 0x6b02 }), tcp({ sport: 50800, dport: 443, flags: ['ACK'], seq: 1, ack: 1 }), data(960, 8, 'Upload data')) },
      ],
    },
  ],
  quiz: [
    { q: 'A fragment has offset field 122. Where does its data start?', options: ['Byte 122', 'Byte 976 (122 × 8)', 'Byte 1220'], answer: 1, why: 'Offsets are in 8-byte units.' },
    { q: 'Who reassembles IPv4 fragments?', options: ['Every router', 'The next router', 'Only the final destination'], answer: 2, why: 'Fragments can take different paths; only the destination sees them all.' },
    { q: 'What does ICMP type 3 code 4 tell the sender?', options: ['Port closed', 'Packet too big and DF set: here is the next-hop MTU', 'TTL expired'], answer: 1, why: 'It drives Path MTU Discovery.' },
    { q: 'Why do some connections hang after the handshake on VPNs?', options: ['DNS failure', 'ICMP "fragmentation needed" is blocked (PMTUD black hole)', 'Too many ports'], answer: 1, why: 'Small packets pass, large DF packets vanish silently.' },
  ],
};
