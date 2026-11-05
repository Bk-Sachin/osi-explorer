# OSI Explorer → a 3-level course

**Status:** draft proposal, nothing built yet · **Date:** 5 Nov 2026

The aim is to turn the current 20 standalone lessons into a structured **Beginner → Intermediate → Advanced**
course that's fun, visual, and measurably teaches. This document covers research findings, the
proposed course structure, game mechanics, visual changes, content gaps and a phased roadmap.

---

## 1. What the research says (and what it means for us)

| Finding | Design implication |
|---|---|
| Gamification in networking courses shows **modest, context-dependent gains, mostly in engagement and motivation**, not guaranteed learning gains ([ICCS 2023, AGH](https://www.iccs-meeting.org/archive/iccs2023/papers/140770739.pdf); virtual-currency study via [NSF PAR](https://par.nsf.gov/search/author:%22Hsin,%20Wen%20Jung%22)) | Use game mechanics to get people *coming back*, but make the core loop **interactive problem-solving**, not points. Points must reward understanding, not clicking. |
| Duolingo-style streaks, leagues and XP drive return visits, but critics note **XP measures activity, not learning**, and leaderboards encourage speed-running ([UX Collective analysis](https://uxdesign.cc/duolingo-analyzing-all-engagement-and-retention-techniques-3e73b79120cf), [DEV](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4)) | Gentle streaks with free "freeze" days; **XP only for correct predictions and solved challenges**; no punishing "hearts". Optional, not mandatory, leaderboards. |
| Brilliant's model: **bite-sized (5–15 min) sequences of small problems with instant feedback**, rolling back gently on mistakes, instead of video lectures ([Brilliant](https://brilliant.org/)) | Each step gets a quick interaction ("predict", "drag", "choose") *before* the reveal. Target 10-minute lessons. |
| **Worked examples reduce cognitive load for novices** and improve transfer; subgoal-labelled examples cut failure rates ([NSF PAR](https://par.nsf.gov/servlets/purl/10171482), [Raspberry Pi CLT summary](https://static.raspberrypi.org/files/curriculum/quickreads/1-Pedagogy_Summary_Cognitive_Load_Theory_V14b_2023.pdf)) | Beginner = fully worked, narrated example. Intermediate = **faded** example (learner fills in some fields). Advanced = blank-slate challenge. |
| Retrieval and spaced practice have **robust long-standing evidence** and reduce reliance on working memory ([DfE handout](https://support-for-early-career-teachers.education.gov.uk/assets/materials/edt-Block-10-mentor-handout-10.1.pdf), [Teaching CS](https://teachingcs.substack.com/p/learning-about-learning)) | Add a **Review queue**: questions from earlier lessons resurface after 1, 3, 7 and 21 days. |
| Packet Tracer's **Simulation Mode** freezes time and steps PDUs; its **Challenge Mode** asks learners to make the device's decision; activities auto-score with Check Results ([PT help](https://tutorials.ptnetacad.net/help/default/operatingModes.htm), [Packt](https://subscription.packtpub.com/book/cloud-and-networking/9781782170426/11/ch11lvl1sec60/testing-the-activity)) | We already have simulation mode. Add a **"Be the device"** challenge: the packet stops at a switch or router and the learner picks the output port, next hop or new TTL. |
| Browser games like **Netsim** (route packets, then spoof them), **Subnet** (route packets by IP), and **Routing It** (build networks on a budget) show puzzle formats work for this topic ([Netsim paper](https://cs.uwaterloo.ca/~uhengart/publications/ase17.txt), [Subnet](https://p5ina.itch.io/subnet), [Routing It](https://singular-programmer.itch.io/routing-it)) | Add puzzle levels: build-a-network sandbox, subnet puzzles, and "attack then defend" levels at Advanced. |
| Explorable explanations: readers build intuition by **changing the author's scenarios and trying their own**; the author must still guide and structure ([Bret Victor](https://worrydream.com/ExplorableExplanations/), [Wikipedia](https://en.wikipedia.org/wiki/Explorable_explanation)) | Every lesson gets "what if?" knobs (drop this packet, change the MTU, set TTL=1), but inside a guided story, not a blank sandbox. |
| Known misconceptions: **"TCP/IP is based on OSI"**, confusing classful rules / 1-bits vs 0-bits in **subnetting**, and **DNS** explained vaguely ([NANOG thread](https://seclists.org/nanog/2014/Dec/558), [subnetting study](https://pta.trunojoyo.ac.id/welcome/detail/140631100100), [BCS examiner report](https://www.bcs.org/media/ojvj0mwq/heq-apr24-pgd-nis-report.pdf), [Uppsala protocol study](https://www.it.uu.se/research/publications/reports/2002-006)) | Write quiz distractors from these misconceptions. Add a dedicated "OSI vs TCP/IP: a model, not a blueprint" lesson. Make subnetting visual (bit-by-bit). |
| Industry blueprints: **Network+ N10-009** = Concepts 23%, Implementation 20%, Operations 19%, Security 14%, **Troubleshooting 24%** ([DestCert](https://destcert.com/?p=36372)). **CCNA 200-301 v1.1** = Fundamentals 20, Access 20, **IP Connectivity 25**, IP Services 10, Security 15, Automation 10 ([open-exam-prep](https://open-exam-prep.com/exams/ccna/introduction/exam-domains-and-weights); v2.0 due Feb 2027) | Troubleshooting is the biggest single domain, and we have almost none of it as *practice*. Add "Fix the broken network" missions. Map Intermediate to Network+ and Advanced to CCNA-style topics. |
| TryHackMe's beginner path groups rooms into **modules with a clear "start from zero" promise** ([TryHackMe beginner path](https://tryhackme.com/path/outline/beginner)) | Present a visible **map** of modules per level with prerequisites, so learners always know "where am I, what's next". |

---

## 2. Course structure

### The core idea: one network, three depths

Reuse the same 20 simulations, but each lesson gets a **level dial** that changes what's shown, what's
asked and how much the learner does. One engine, three experiences.

| | 🟢 Beginner: "Explorer" | 🟡 Intermediate: "Technician" | 🔴 Advanced: "Engineer" |
|---|---|---|---|
| **Who** | Curious, no background | Studying for Network+ / first IT job | CCNA-level, devs, security learners |
| **Language** | Analogies first (post office, envelopes), jargon introduced gently | Correct terminology, header fields | RFC terms, edge cases, numbers |
| **Packet inspector** | Layer "envelopes" only, with 1-line meaning each | Full field list with explanations | Hex, bit-level flags, checksums you can recompute |
| **Animation** | Slow (0.5×), narrated, one device at a time, mascot guide | Normal speed, captions | Fast, captions optional, timing/latency shown |
| **Interaction** | Predict-what-happens taps | Fill-in the faded example (e.g. "what's the next ACK number?") | "Be the device" decisions, break it and fix it |
| **Assessment** | 3 picture-based questions | 5 mixed questions + one mini-challenge | Timed scenario + troubleshooting mission |
| **Mapped to** | General literacy (ITF+-ish) | CompTIA Network+ N10-009 | CCNA 200-301 + beyond |

### 🟢 Beginner course: "How the internet works" (≈ 3–4 hours)

| Module | Lessons (✓ = exists, ✚ = new) | Win condition |
|---|---|---|
| B1 · Your home network | ✚ *Tour of a home network* (devices, cables, Wi-Fi) · ✓ Wi-Fi (beginner cut) | Label every device in a photo-style diagram |
| B2 · Addresses | ✚ *IP vs MAC: house address vs person's name* · ✓ DHCP (beginner cut) | Give 3 devices correct addresses in a puzzle |
| B3 · Finding things by name | ✓ DNS (beginner cut) | Resolve a name by dragging the query through the tree |
| B4 · Loading a web page | ✓ HTTP (beginner cut) · ✓ TCP handshake (first step only) | Order the 7 packets correctly |
| B5 · The layer cake | ✚ *Envelopes inside envelopes* (drag-and-drop encapsulation) · ✚ *OSI vs TCP/IP* | Wrap a message in the right order |
| B6 · Staying safe | ✓ Certificates (beginner cut: "the padlock") | Spot the fake site |
| 🎓 Capstone | "Get the café online": connect, get an address, load a page | Earn the **Explorer badge** |

### 🟡 Intermediate course: "Network technician" (≈ 10–12 hours)

| Module | Lessons | Win condition |
|---|---|---|
| I1 · Physical & link | ✓ Bits on the wire · ✓ Hubs & collisions · ✓ Ethernet & ARP · ✓ VLANs | Configure access/trunk ports so two departments are isolated |
| I2 · IP addressing | ✓ Routing · ✚ *Subnetting step by step* (visual bit-slicer) · ✚ *IPv6 essentials* · ✓ NAT | Subnet a 3-floor office (/24 → four /26s) |
| I3 · Transport | ✓ TCP · ✓ UDP · ✓ Ports & multiplexing · ✓ TCP flow (first half) | Predict ACK numbers in a 6-segment exchange |
| I4 · Services | ✓ DHCP · ✓ DNS · ✓ HTTP · ✓ SMTP | Fix a site that "won't load" (DNS issue) |
| I5 · Security basics | ✓ Certificates · ✚ *Firewalls & ACLs* · ✚ *Common attacks: ARP spoofing, rogue DHCP* | Write 3 firewall rules that pass the test traffic |
| I6 · Troubleshooting ⭐ | ✚ *The troubleshooting method* (bottom-up / top-down / divide-and-conquer) · ✚ 6 "broken network" missions | Solve 4 of 6 missions |
| 🎓 Capstone | "Small office build-out": plan IPs, VLANs, DHCP, DNS, firewall; then a surprise fault | **Technician badge** + Network+ objective coverage report |

### 🔴 Advanced course: "Network engineer" (≈ 15–20 hours)

| Module | Lessons | Win condition |
|---|---|---|
| A1 · Transport internals | ✓ TCP flow & congestion (full) · ✚ *CUBIC vs BBR race* · ✚ *QUIC & HTTP/3* | Tune buffer/RTT so a flow fills a 1 Gb/s path (bandwidth-delay product) |
| A2 · Routing at scale | ✓ Fragmentation/PMTUD · ✚ *OSPF: link-state flooding & SPF* · ✚ *BGP: how the internet's networks agree* · ✚ *STP: loops and root bridges* | Recover from a link failure; explain a BGP route leak |
| A3 · Secure sessions | ✓ Sessions · ✓ WebSocket · ✓ Certificates (full) · ✚ *TLS 1.3 key schedule* · ✚ *Wi-Fi WPA3/SAE* | Decrypt a capture when given the keys |
| A4 · Modern networks | ✚ *VXLAN/overlay networks* · ✚ *SDN & automation (REST/NETCONF, JSON/YANG)* · ✚ *CDNs & anycast* | Automate a VLAN change via a mock API |
| A5 · Packet forensics | ✚ *Read a capture like a pro* · ✚ 5 "capture-the-flag" packet hunts | Find the exfiltrated file in a capture |
| A6 · Attack & defend | ✚ *Spoofing, SYN floods, DNS poisoning, MITM* (Netsim-style) and their defences | Break, then harden, the same network |
| 🎓 Capstone | "Outage war room": timed multi-fault incident across layers 1–7 | **Engineer badge** |

**Content totals:** 20 existing lessons get three cuts each, plus about 22 new lessons, 11 troubleshooting missions and 5 CTF hunts.

---

## 3. Making it fun: game mechanics

Ranked by impact versus effort. ⭐ = do first.

| Mechanic | How it works here | Why |
|---|---|---|
| ⭐ **Predict before reveal** | Before each packet moves: "Where will the switch send this?" (tap a port). Correct = XP + confetti; wrong = gentle explanation, then the animation shows the truth | Retrieval practice + instant feedback (Brilliant model) |
| ⭐ **Be the device** (challenge mode) | The packet freezes at a router; the learner picks the route-table entry, writes the new TTL and chooses the new destination MAC | Packet Tracer's best idea; deep understanding of forwarding |
| ⭐ **Fix the broken network** | Missions with a symptom ("the laptop can't load google.com"). Learner runs virtual tools (ping, tracert, nslookup, arp -a) in a fake terminal and finds the fault | Troubleshooting is 24% of Network+; very game-like ("detective") |
| ⭐ **Course map + mastery stars** | A visual map (like a subway map, one line per level) with ★–★★★ per lesson: watched / quiz passed / challenge solved | Clear progress; TryHackMe-style structure |
| **Packet Passport** | A passport gets a stamp for each layer the learner "visits" (L1 stamp after the PHY lessons, and so on). Seven stamps = certificate | Collectible tied to the OSI theme |
| **Build-the-frame** puzzle | Drag header blocks (Ethernet, IP, TCP, HTTP) into the right order and fill in values; the hex dump updates live | Hands-on encapsulation |
| **Subnet speedrun** | Timed rounds: "Which of these is in 10.20.0.0/14?" Personal best, no global ranking | Builds fluency for a known misconception area |
| **Gentle streaks** | Daily goal = 1 lesson or 5 review cards; 2 free freeze days a week | Return visits without anxiety |
| **Review queue** | Spaced flashcards from finished lessons (1 / 3 / 7 / 21 days), including "spot the field" hex cards | Long-term retention |
| **Boss levels** | Each module ends with a harder mixed scenario; the Advanced capstone is a timed incident | Climax + consolidation |
| **Story mode** (optional) | "You're the new IT intern at Café Byte". Each module is a day on the job, with a recurring cast (owner, hacker, ISP tech) | Narrative glue; context for why each topic matters |
| **Achievements** | "Ping Pong" (100 pings), "TTL Hunter" (finish traceroute), "Handshake Hero", "Zero Window" (find a ZeroWindow in a capture) | Delight; encourages exploring the "what if" knobs |
| **Certificates** | Shareable PDF or image per level, listing the objectives covered | Motivation and proof for job seekers |

**Avoid:** losing lives or "hearts" for wrong answers, mandatory public leaderboards, and XP for merely watching. Research shows these
optimise for activity, not learning.

---

## 4. Visual changes

### For every level
- **Level theme colours:** green, amber, red accents. A level badge in the header. A level switcher on each lesson ("try this at Advanced").
- **"What-if" knobs panel** on every simulation, for example: drop this packet · set MTU · TTL · turn off DHCP · add latency · flip a bit. The sim re-runs with the change and the narration explains the difference.
- **Time-scale ruler:** a strip under the stage showing real elapsed time (ns for the PHY, µs on a LAN, ms on the internet), so learners feel the difference in scale.
- **Side-by-side compare mode:** run two variants in sync, e.g. TCP vs UDP under 10% loss, hub vs switch, HTTP/1.1 vs HTTP/2, IPv4 vs IPv6.
- **Accessibility:** a reduced-motion setting (show steps without travel animation), colour-blind-safe packet colours plus shape icons, keyboard play, captions read by screen readers.

### Beginner-specific visuals
- **Mascot guide**, "Pax the Packet": a friendly envelope character who narrates, gets "stamped" at routers and wrapped in layers. Shown only at Beginner.
- **Envelope encapsulation:** actual nested-envelope graphics instead of byte bars. The letter (HTTP) goes into a TCP envelope, then an IP envelope with an address, then an Ethernet envelope for the local courier.
- **City-map metaphor:** a zoomed-out view where routers are post offices and links are roads; zoom into a building (LAN) and then a device (the protocol stack). Continuous zoom between "internet → LAN → device → layers".
- **Simplified diagrams:** at most 4 devices, big labels, no MAC addresses unless asked.

### Intermediate-specific visuals
- **Live tables beside the stage:** MAC table, ARP cache, routing table, NAT table and TCP state machine update as packets flow. Rows flash when they change.
- **Bit-slicer for subnetting:** an IP address as 32 coloured tiles; drag the prefix boundary and watch network/host bits, mask, broadcast and host range update.
- **Fake terminal:** a styled console for `ping`, `tracert`, `nslookup`, `arp -a`, `netstat`, `ipconfig`, with outputs generated from the sim state.

### Advanced-specific visuals
- **Timeline / waterfall view:** a Wireshark-like I/O graph and a cwnd/rwnd chart over time (for CUBIC vs BBR), and a TCP sequence (Stevens) graph.
- **Bit-level header editor:** toggle flags and edit fields; checksums recompute live and show "invalid" when you tamper.
- **Topology builder:** drag routers, switches and hosts; draw links; set link MTU, latency and loss; then run any lesson's traffic over your own network.
- **Capture import (stretch goal):** open a small `.pcap` and render it in the sequence, stack and inspector views.

---

## 5. Changes to the lesson data model (draft, no code)

Each lesson object would gain:

| Field | Purpose |
|---|---|
| `levels: { beginner, intermediate, advanced }` | Per-level overrides: which steps, text variants, visible fields, speed default |
| `objectives[]` with tags like `N10-009 1.4`, `CCNA 3.2` | Objective coverage reports and certificates |
| `prereqs[]` | Course map arrows; soft-lock (warn, don't block) |
| `predictions[]` per step | The "predict before reveal" question, options and explanation |
| `challenges[]` | "Be the device" checkpoints: packet no., device, expected decision |
| `knobs[]` | Allowed what-if changes and how each alters packets |
| `misconceptions[]` | Distractor bank used by quizzes and the review queue |
| field-level `level` tag in packet builders | Hide advanced fields (Identification, checksum) at Beginner |

New stores: `progress` (stars per lesson per level, XP, streak, badges, passport stamps) and `reviewQueue`
(card id, next due date, interval). These can stay in localStorage at first; accounts and sync come later
(e.g. a small backend or a hosted DB) if certificates need to be verifiable.

New content types: **mission** (fault scenario + virtual tools + success check), **puzzle** (build-the-frame, subnet, topology), **CTF hunt** (capture + question + flag).

---

## 6. Gaps in today's app (honest audit)

| Gap | Impact | Fix (level) |
|---|---|---|
| Learners mostly **watch**; interaction is limited to Step/Play and quizzes at the end | Biggest learning gap | Predictions + challenges (all levels) |
| **No troubleshooting practice** | Misses the largest Network+ domain | Missions + fake terminal (I, A) |
| Same jargon density for everyone | Beginners bounce off MAC/hex on screen 1 | Level dial, mascot, envelope view (B) |
| No subnetting drill (only a calculator) | Known misconception area | Bit-slicer + speedrun (I) |
| No IPv6, STP, OSPF, BGP, firewalls, QUIC | Coverage holes vs Network+ / CCNA | New lessons (I, A) |
| No path / prerequisites / map | Learners don't know what to do next | Course map (all) |
| No spaced review | Knowledge fades after one pass | Review queue (all) |
| Quizzes are 3–4 questions, recognition only | Shallow assessment | Mixed formats: ordering, drag-label, numeric answers, hex-spotting |
| Desktop-first layout | Many learners are on phones | Mobile lesson layout: stacked stage, swipeable steps |

---

## 7. Phased roadmap (suggested)

| Phase | Scope | Rough size |
|---|---|---|
| **1. Course skeleton** | Level picker on first visit, course map, stars, level-based text and inspector filtering for the existing 20 lessons, mobile layout | Medium |
| **2. Active learning core** | Predict-before-reveal on every step, "be the device" challenges, richer quiz formats, review queue | Medium–Large |
| **3. Beginner polish** | Mascot, envelope encapsulation view, home-network tour, IP vs MAC lesson, OSI vs TCP/IP lesson, Explorer capstone + badge | Medium |
| **4. Troubleshooting** | Fake terminal, mission engine, 6 Intermediate missions, firewall/ACL and subnetting lessons, IPv6 essentials, Technician capstone | Large |
| **5. Advanced** | Timeline/cwnd charts, compare mode, topology builder, OSPF/BGP/STP/QUIC/TLS key schedule lessons, CTF hunts, war-room capstone | Large |
| **6. Engagement extras** | Passport stamps, achievements, gentle streaks, shareable certificates, optional accounts/sync | Small–Medium |

Phase 1 + 2 alone turn the app from "an interactive explainer" into "a course", and they reuse everything already built.

---

## 8. Open questions for you

1. **Audience priority:** which level should we polish first? Beginner widens the audience; Intermediate fits job/cert seekers best.
2. **Cert alignment:** should we explicitly label objectives "Network+ N10-009" / "CCNA"? It's useful for learners, but these are trademarks, so phrase it as "aligned with", not "official".
3. **Accounts:** keep everything local (simple, private), or add sign-in for cross-device progress and verifiable certificates?
4. **Story mode:** is the "Café Byte intern" narrative wanted, or keep a neutral tone?
5. **Mascot / art style:** keep the current blueprint look for all levels, or a friendlier illustrated style for Beginner?

---

## Sources

- Zieliński & Konieczny, gamified networking course, ICCS 2023: https://www.iccs-meeting.org/archive/iccs2023/papers/140770739.pdf
- Virtual-currency gamification in a networking course (Hsin et al.): https://par.nsf.gov/search/author:%22Hsin,%20Wen%20Jung%22
- Online gameful networks course (UOC): https://redenorte.ufam.edu.br/Record/oai:https:--bdm.ufpa.br:8443:prefix-2890/Details
- Duolingo engagement analysis: https://uxdesign.cc/duolingo-analyzing-all-engagement-and-retention-techniques-3e73b79120cf · critique: https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4
- Brilliant (learn by doing): https://brilliant.org/
- Worked examples / subgoal labels for novices: https://par.nsf.gov/servlets/purl/10171482 · Cognitive load summary: https://static.raspberrypi.org/files/curriculum/quickreads/1-Pedagogy_Summary_Cognitive_Load_Theory_V14b_2023.pdf
- Retrieval & spacing: https://support-for-early-career-teachers.education.gov.uk/assets/materials/edt-Block-10-mentor-handout-10.1.pdf · https://teachingcs.substack.com/p/learning-about-learning
- Packet Tracer modes & activities: https://tutorials.ptnetacad.net/help/default/operatingModes.htm · https://subscription.packtpub.com/book/cloud-and-networking/9781782170426/11/ch11lvl1sec60/testing-the-activity
- Netsim (Waterloo): https://cs.uwaterloo.ca/~uhengart/publications/ase17.txt · Subnet: https://p5ina.itch.io/subnet · Routing It: https://singular-programmer.itch.io/routing-it
- Explorable explanations: https://worrydream.com/ExplorableExplanations/ · https://en.wikipedia.org/wiki/Explorable_explanation
- Misconceptions: NANOG https://seclists.org/nanog/2014/Dec/558 · subnetting https://pta.trunojoyo.ac.id/welcome/detail/140631100100 · BCS report https://www.bcs.org/media/ojvj0mwq/heq-apr24-pgd-nis-report.pdf · Uppsala https://www.it.uu.se/research/publications/reports/2002-006
- Network+ N10-009 domains: https://destcert.com/?p=36372 · CCNA 200-301 v1.1 domains: https://open-exam-prep.com/exams/ccna/introduction/exam-domains-and-weights
- TryHackMe beginner path: https://tryhackme.com/path/outline/beginner
