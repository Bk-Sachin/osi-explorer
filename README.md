# OSI Explorer

An interactive, step-by-step simulator that teaches **all seven OSI layers**, one packet at a time.
Its learning model was inspired by [Protocol Explorer](https://protocol-explorer-alpha.vercel.app/), which covers Layer 7 only.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## What's inside

**20 guided lessons** (open with ☰ Lessons, or the 1–7 layer buttons). Each step has a "Deep dive" with extra detail:

| Layer | Lesson | What you watch happen |
|---|---|---|
| 7 Application | HTTP | DNS → TCP handshake → GET → 200 OK |
| 7 Application | DNS | Recursive lookup: root → .com → authoritative |
| 7 Application | DHCP | Discover, Offer, Request, ACK, conflict-check ARP, lease renewal |
| 7 Application | SMTP | MX lookup, EHLO, envelope, DATA, reply codes, SPF/DKIM/DMARC |
| 6 Presentation | Encode · Compress · Encrypt | UTF-8, gzip, TLS 1.3 records (with decrypted view) |
| 6 Presentation | Certificates & Trust | ECDHE, X.509 chain, CertificateVerify, bad-certificate alert |
| 5 Session | Sessions | Full handshake, login cookie, session ticket, drop, resume, close |
| 5 Session | WebSocket | HTTP Upgrade, 101, full-duplex masked frames, ping/pong, close codes |
| 4 Transport | TCP | Handshake, windowed send, loss, dup ACKs, retransmit, FIN |
| 4 Transport | TCP Flow & Congestion | Slow start, zero window, loss + fast retransmit, AIMD |
| 4 Transport | UDP | Real-time voice: no handshake, loss isn't retransmitted |
| 4 Transport | Ports & Multiplexing | 4-tuples, demultiplexing, open / closed (RST) / filtered ports |
| 3 Network | IP Routing | Subnet decision, traceroute via TTL + ICMP, MAC rewrite per hop |
| 3 Network | NAT | Private → public rewrite, NAT table, port translation, inbound drop |
| 3 Network | MTU & Fragmentation | Fragment offsets, reassembly, DF + ICMP "frag needed" (PMTUD) |
| 2 Data Link | Ethernet & ARP | ARP broadcast, switch MAC learning, unicast forwarding, FCS drop |
| 2 Data Link | VLANs & Trunks | 802.1Q tags, isolated broadcasts, router-on-a-stick |
| 2 Data Link | Wi-Fi (802.11) | Beacons, association, WPA2 4-way handshake, link ACKs, bridging |
| 1 Physical | Bits on the Wire | Preamble/SFD, line coding, inter-frame gap, noise |
| 1 Physical | Hubs & Collisions | Shared medium, collision, jam signal, exponential backoff |

**Study guides** (📖 Study tab), one per layer: purpose, how it maps to TCP/IP, core concepts,
RFC-style 32-bit header diagrams, how it works step by step, commands to try on your own machine,
a troubleshooting table, and exam pointers.

**Animations** are paced for beginners. Packets travel hop by hop and pause at each switch or
router while a caption explains what that device does. Autoplay waits for each journey to finish
plus reading time. You can choose 0.5×–2× speed, and "↻ Replay packet" re-runs the last one.

Each lesson has five synchronized views:
- **Network**: devices appear per step; packets animate along their real path (lost ones burst mid-link).
- **Sequence**: a ladder diagram of every exchange, grouped by step.
- **Encapsulation**: the sender's stack adds headers 7→1, the receiver strips them 1→7.
- **Lab**: a hands-on sandbox for each layer (see below).
- **Study**: the in-depth study guide for the layer.

There's also a Wireshark-style **packet flow** table and a full-screen **packet inspector**. Every frame
is built from real bytes (`src/lib/packet.js`: IPv4/ICMP/TCP/UDP checksums, Ethernet CRC-32,
DNS encoding), so hovering a field highlights its exact bytes in the hex dump, and the other way round.
Each lesson ends with a short quiz. Progress is saved in localStorage.

**Labs**
1. Signal Lab: text → bits → NRZ / NRZI / Manchester / MLT-3 waveform, with adjustable noise and bit-error detection
2. Switch Lab: MAC learning, flooding vs forwarding, switch vs hub
3. Routing Lab: subnet calculator with binary view, longest-prefix-match routing table
4. Transport Lab: sliding-window TCP with packet loss and retransmission, plus a UDP comparison
5. Session Lab: connections vs sessions, TLS ticket resumption, cookie expiry and logout
6. Presentation Lab: real UTF-8/UTF-16/ASCII encoding, gzip (CompressionStream), AES-GCM (Web Crypto), tamper detection
7. HTTP Lab: build raw requests against a mock API (methods, status codes, auth)

## Structure

```
src/
  lib/packet.js          byte-accurate header builders + frame assembler
  data/layers.js         OSI layer metadata
  data/scenarios/*.js    lessons: nodes, links, steps, packets, quizzes
  components/            network, sequence, stack, inspector, panels
  labs/                  one interactive lab per layer
```

To add a lesson, export a scenario object from `src/data/scenarios/` and add it to `index.js`.
