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

**9 guided lessons** (open with ☰ Lessons, or the 1–7 layer buttons):

| Layer | Lesson | What you watch happen |
|---|---|---|
| 7 Application | HTTP | DNS → TCP handshake → GET → 200 OK |
| 7 Application | DNS | Recursive lookup: root → .com → authoritative |
| 6 Presentation | Encode · Compress · Encrypt | UTF-8, gzip, TLS 1.3 records (with decrypted view) |
| 5 Session | Sessions | Full handshake, login cookie, session ticket, drop, resume, close |
| 4 Transport | TCP | Handshake, windowed send, loss, dup ACKs, retransmit, FIN |
| 4 Transport | UDP | Real-time voice: no handshake, loss isn't retransmitted |
| 3 Network | IP Routing | Subnet decision, traceroute via TTL + ICMP, MAC rewrite per hop |
| 2 Data Link | Ethernet & ARP | ARP broadcast, switch MAC learning, unicast forwarding, FCS drop |
| 1 Physical | Bits on the Wire | Preamble/SFD, line coding, inter-frame gap, noise |

Each lesson has four synchronized views:
- **Network**: devices appear per step; packets animate along their real path (lost ones burst mid-link).
- **Sequence**: a ladder diagram of every exchange, grouped by step.
- **Encapsulation**: the sender's stack adds headers 7→1, the receiver strips them 1→7.
- **Lab**: a hands-on sandbox for each layer (see below).

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
