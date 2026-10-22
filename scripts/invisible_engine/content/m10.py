from .inserts import DEMO_J

# Sources used across the module.
FIPS203 = 'NIST, FIPS 203, <em>Module-Lattice-Based Key-Encapsulation Mechanism Standard</em> (ML-KEM), 13 August 2024 — <a href="https://csrc.nist.gov/pubs/fips/203/final">csrc.nist.gov</a>.'
FIPS204 = 'NIST, FIPS 204, <em>Module-Lattice-Based Digital Signature Standard</em> (ML-DSA), 13 August 2024 — <a href="https://csrc.nist.gov/pubs/fips/204/final">csrc.nist.gov</a>.'
FIPS205 = 'NIST, FIPS 205, <em>Stateless Hash-Based Digital Signature Standard</em> (SLH-DSA), 13 August 2024 — <a href="https://csrc.nist.gov/pubs/fips/205/final">csrc.nist.gov</a>.'
PQC = 'NIST Post-Quantum Cryptography project (status of FN-DSA / draft FIPS 206 and the HQC selection of March 2025) — <a href="https://csrc.nist.gov/projects/post-quantum-cryptography">csrc.nist.gov/projects/post-quantum-cryptography</a> (verify current status).'
IR8547 = 'NIST IR 8547, “Transition to Post-Quantum Cryptography Standards” (initial public draft, November 2024) — <a href="https://csrc.nist.gov/pubs/ir/8547/ipd">csrc.nist.gov</a> (check current status).'
RFC7748 = 'IETF RFC 7748, <em>Elliptic Curves for Security</em> (X25519) — <a href="https://www.rfc-editor.org/rfc/rfc7748">rfc-editor.org</a>.'
SEC1 = 'SECG, <em>SEC 1: Elliptic Curve Cryptography</em>, version 2.0 (point compression) — <a href="https://www.secg.org/sec1-v2.pdf">secg.org</a>.'
FIPS186 = 'NIST, FIPS 186-5, <em>Digital Signature Standard</em> (ECDSA) — <a href="https://csrc.nist.gov/pubs/fips/186-5/final">csrc.nist.gov</a>.'
BTCORE = 'Bluetooth SIG, <em>Core Specification</em>: Vol 6 Part B (advertising data, 31 bytes for legacy advertising), Vol 3 Part F (ATT MTU, default 23, maximum 517), Vol 3 Part H (LE Secure Connections, ECDH P-256) — <a href="https://www.bluetooth.com/specifications/specs/core-specification/">bluetooth.com</a>.'
FINDMY = 'Apple Platform Security, “Find My security” (NIST P-224, ECDH, AES-GCM) — <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">support.apple.com</a>.'
EMV = 'EMVCo, <em>EMV Integrated Circuit Card Specifications for Payment Systems</em>, Books 2 (security and key management; SDA, DDA, CDA with RSA) and the EMVCo elliptic-curve specification bulletins — <a href="https://www.emvco.com/specifications/">emvco.com</a> (verify which apply to a given card).'
PQ3 = 'Apple Security Research, “iMessage with PQ3: The new state of the art in quantum-secure messaging at scale”, February 2024 — <a href="https://security.apple.com/blog/imessage-pq3/">security.apple.com</a> (verify).'
TLSHYB = 'IETF TLS working group, hybrid key exchange drafts (draft-ietf-tls-hybrid-design; the X25519MLKEM768 code point) — <a href="https://datatracker.ietf.org/wg/tls/documents/">datatracker.ietf.org</a> (verify current status and deployment).'
MOSCA = 'M. Mosca, “Cybersecurity in an era with quantum computers: will we be ready?”, IACR ePrint 2015/1075 (later <em>IEEE Security &amp; Privacy</em>, 2018) — <a href="https://eprint.iacr.org/2015/1075">eprint.iacr.org</a>.'
M9 = '<a href="/invisible-engine/m09.html#s72">Module 9, Scene 72</a> (which locks a quantum computer would affect).'
FTT9 = '<a href="/articles/from-tap-to-trace.html#p9">From Tap to Trace, Part IX</a>.'

M = dict(
    num=10, file='m10.html', title='Future cryptography of cards, trackers and accounts',
    kicker='Module 10 · Changing the locks without breaking the doors',
    dek='The replacement locks exist: NIST published them in August 2024. Fitting them is the hard part — a card chip, a coin-cell tracker and a cloud account each change on a different clock, and some will only change when they are replaced.',
    prereq='Module 9, especially Scene 72 (which kinds of cryptography a quantum computer would affect, and which it would only weaken).',
    scenes=[

dict(id=73, title='Inventory first: which cryptography does each part use?',
 lede='Before anyone can migrate, someone has to write down what cryptography runs where — and admit where the answer is not published.',
 frames=['The payment card chip: transaction cryptograms use symmetric keys (TDES or AES, the issuer’s choice) — verified from the EMV specifications; offline card authentication uses RSA certificates and EMV also specifies elliptic curves — unverified for any particular card.',
         'An access badge (AES-128 on current secure credentials — unverified for your fleet), Bluetooth LE Secure Connections pairing (ECDH on P-256 — verified from the Core Specification) and tracker firmware signing (not published — unknown).',
         'Find My location reports (ECDH on P-224, then AES-GCM — verified from Apple’s documentation), the cloud connection (TLS 1.3, elliptic-curve key exchange, hybrid with ML-KEM rolling out — unverified per service) and sharing and backups (design documented, algorithms in part — unverified).',
         'The rows that rely on public-key cryptography are marked: those are the ones Shor’s algorithm would affect, and only on a large fault-tolerant quantum computer that is not publicly known to exist.'],
 A=(['A house has many locks: front door, garage, a safe, a bike lock.', 'Before buying new locks, you walk round and list every one.', 'Some locks have a label that says what kind they are.', 'Some have no label at all — you write “unknown”.', 'Only then can you plan which to change first.'],
    'You cannot change every lock until you have listed them all, including the ones whose type you do not know.'),
 B='''<p>A single tap, a single tag and a single account each use several kinds of cryptography for different jobs. Some are <strong>symmetric</strong> (both sides share a secret key, as in a card’s transaction cryptogram); some are <strong>public-key</strong> (key agreement and signatures). Quantum computers would affect these two families very differently (Module 9, Scene 72).</p>
<p><strong>Where the analogy breaks:</strong> a house’s locks are all visible. Cryptography inside a card, a tag or a cloud service often is not: vendors document some of it, some only for certain versions, and some not at all. “Unknown” is a finding, not a blank.</p>''',
 C='''<ul>
<li>EMV transaction cryptograms (ARQC) are computed with symmetric keys derived per card; the algorithm is TDES or AES depending on the issuer and card generation. <span class="tag spec">EMV specification</span></li>
<li>EMV offline data authentication (SDA, DDA, CDA) uses RSA certificate chains; EMVCo also publishes elliptic-curve specifications — which applies to a given card is not visible from outside. <span class="tag verify">verify per card</span></li>
<li>Bluetooth LE Secure Connections pairing: ECDH on P-256. <span class="tag spec">Core Specification</span> Find My location reports: ECDH on NIST P-224 with AES-GCM. <span class="tag doc">Apple documented</span></li>
<li>Tracker firmware signature algorithms are not publicly documented. <span class="tag undisclosed">not disclosed</span></li>
<li>TLS 1.3 uses ephemeral elliptic-curve Diffie–Hellman; hybrid X25519MLKEM768 key exchange is being deployed by major browsers and content-delivery networks, and Apple’s iMessage PQ3 uses ML-KEM in a hybrid. <span class="tag verify">verify per service</span></li>
</ul>''',
 D='''<p>An inventory is a trust-boundary map with algorithms attached. Record, for each component and version: the job (authentication, key agreement, confidentiality, integrity), the algorithm and key size, the evidence (vendor document, standard, your own measurement) and who can change it. The public-key rows that protect long-lived confidentiality are the first migration candidates; symmetric rows mostly need key-length checks.</p>''',
 E='''<ul><li>Ask every vendor for a cryptographic bill of materials by product and firmware version, with dates. “We use strong encryption” is not an inventory entry.</li><li>Track UNKNOWN rows as open risks with an owner, not as gaps to ignore.</li></ul>''',
 eng='<p>The evidence status reflects public documentation as of this lesson, not any organisation’s fleet. “Shor-exposed” is shorthand for public-key cryptography that Shor’s algorithm would break on a large fault-tolerant quantum computer.</p>',
 test=['Is any algorithm shown as verified without a public source? (No; each verified row cites a standard or vendor document.)', 'Is anything described as broken today? (No; the footnote says the quantum computer needed is not publicly known to exist.)'],
 src=[EMV, BTCORE, FINDMY, TLSHYB, PQ3]),

dict(id=74, title='The new standard locks: three NIST algorithms',
 lede='In August 2024 NIST published three post-quantum standards. They are ordinary software and hardware, designed to resist known quantum attacks.',
 frames=['ML-KEM, FIPS 203: a key-encapsulation mechanism for agreeing a shared secret, built on module lattices; it takes the place of elliptic-curve Diffie–Hellman and RSA key transport.',
         'ML-DSA, FIPS 204: a digital signature scheme, also built on module lattices; it takes the place of ECDSA and RSA signatures.',
         'SLH-DSA, FIPS 205: a stateless hash-based signature scheme whose security rests only on hash functions; larger and slower, a conservative alternative. All three were published on 13 August 2024.',
         'In progress, to check against NIST’s current pages: FN-DSA (Falcon, draft FIPS 206), a compact lattice signature, and HQC, selected in March 2025 as a backup key-encapsulation mechanism based on codes.',
         'All of them run on ordinary classical chips — phones, servers, smart cards — not on quantum computers.'],
 A=(['Clever people designed new kinds of locks.', 'One lock is for agreeing a secret.', 'Two locks are for signing your name so no one can fake it.', 'They work on the phones and computers we already have.', 'They are built so that even a future quantum computer should not open them.'],
    'The new locks run on ordinary computers and are built to resist the tricks a quantum computer is expected to have.'),
 B='''<p>Post-quantum cryptography (PQC) is not quantum technology. It is new mathematics — mainly <strong>lattices</strong> and <strong>hash functions</strong> — chosen because no known quantum algorithm solves those problems efficiently. ML-KEM replaces the key-agreement job; ML-DSA and SLH-DSA replace the signature job. Symmetric ciphers such as AES stay, with long keys.</p>
<p><strong>Where the analogy breaks:</strong> “new locks” suggests the old ones are already being picked. They are not (Module 9, Scene 72). And no lock is proven to hold forever: these are designed to resist known attacks, classical and quantum, and are still being studied.</p>''',
 C='''<ul>
<li>ML-KEM (FIPS 203), parameter sets ML-KEM-512/768/1024; security from the Module Learning With Errors problem. <span class="tag spec">FIPS 203</span></li>
<li>ML-DSA (FIPS 204), ML-DSA-44/65/87; Module-LWE and Module-SIS. <span class="tag spec">FIPS 204</span></li>
<li>SLH-DSA (FIPS 205), stateless hash-based (SPHINCS+ lineage); security rests on the hash function. <span class="tag spec">FIPS 205</span></li>
<li>FN-DSA (draft FIPS 206) and HQC (selected March 2025 as an additional KEM) — status changes; check NIST. <span class="tag verify">verify</span></li>
<li>NIST IR 8547 sets out a transition timeline for retiring quantum-vulnerable public-key algorithms. <span class="tag verify">draft; check status</span></li>
</ul>''',
 D='''<p>Treat the standards as building blocks, not as a migration plan. The protocol around them (TLS, account key sync, a tracker’s report format) must be redesigned and reviewed; parameter choice (e.g. ML-KEM-768 vs 1024) is a security-level decision; implementations need side-channel care, especially on smart cards and microcontrollers.</p>''',
 E='''<ul><li>Require vendors to name the standard and parameter set they will use, and their implementation’s validation status, rather than marketing claims of immunity.</li></ul>''',
 eng='<p>Draft and candidate statuses (FIPS 206, HQC) are as understood when this lesson was written; check NIST’s project page.</p>',
 test=['Is PQC described as running on quantum computers? (No; frame 5 says ordinary chips.)', 'Is any algorithm claimed to be immune to quantum attack? (No; “designed to resist known quantum attacks”.)'],
 src=[FIPS203, FIPS204, FIPS205, PQC, IR8547]),

dict(id=75, title='Why trackers cannot simply switch: bytes, chips and batteries',
 lede='Post-quantum keys and signatures are tens to hundreds of times larger than the elliptic-curve ones they replace. For a coin-cell tracker that whispers 31 bytes at a time, that is a design problem.',
 frames=['Sizes from the standards, on a logarithmic scale: elliptic-curve keys and signatures are 32 to 64 bytes; ML-KEM-768 keys and ciphertexts are over 1,000 bytes; ML-DSA-65 signatures 3,309 bytes; SLH-DSA-SHA2-128s signatures 7,856 bytes.',
         'Bytes on air: a legacy Bluetooth advertisement carries at most 31 bytes of data, so one ML-KEM-768 key would need 39 advertisements; even the largest ATT packet size, 517 bytes, needs 3 packets.',
         'Inside the device: a boot ROM fixed at the factory, flash for firmware and keys, tens of kilobytes of RAM, and a coin cell — every extra byte sent costs battery.',
         'Beyond the device: new account devices, key synchronisation and the backend that files and finds reports must accept the new formats while old devices are still in use.',
         'These are design constraints, not vulnerabilities: they decide how and when a migration can happen.'],
 A=(['The new locks are much bigger than the old ones.', 'A tracker can only whisper a few words at a time.', 'A big new key would need dozens of whispers.', 'Every whisper uses a little battery.', 'So engineers must design new ways to talk, not just swap the lock.'],
    'Because the new keys are so much bigger, small devices need new designs, not just new locks.'),
 B='''<p>An elliptic-curve public key fits in a single Bluetooth advertisement with room to spare; a post-quantum key does not come close. That changes how a tracker could broadcast, how many packets it sends, how long its battery lasts, and whether its chip has the memory and speed to compute the new algorithms. The owner’s phones and the cloud service must change in step.</p>
<p><strong>Where the analogy breaks:</strong> “bigger lock” suggests weaker or clumsier. Size is not weakness: these are different mathematics with different costs. And a design may avoid sending the large object at all (for example, keeping post-quantum exchange between phone and cloud), which is for the vendor to design and document.</p>''',
 C='''<p class="eq">⌈1184 / 31⌉ = 39 advertisements ; ⌈1184 / 517⌉ = 3 ATT packets</p>
<ul>
<li>X25519 public key 32 B <span class="tag spec">RFC 7748</span>; compressed P-256 point 33 B <span class="tag spec">SEC 1</span>; ECDSA P-256 signature 64 B as raw r‖s (DER encoding is up to 72 B) <span class="tag spec">FIPS 186-5</span>.</li>
<li>ML-KEM-768: encapsulation key 1,184 B, ciphertext 1,088 B <span class="tag spec">FIPS 203</span>; ML-DSA-65: public key 1,952 B, signature 3,309 B <span class="tag spec">FIPS 204</span>; SLH-DSA-SHA2-128s signature 7,856 B <span class="tag spec">FIPS 205</span>.</li>
<li>Legacy advertising data ≤ 31 B; ATT MTU default 23 B, maximum 517 B. <span class="tag spec">Bluetooth Core Spec</span> The counts above are computed from those limits. <span class="tag calc">computed</span></li>
<li>How any vendor would carry post-quantum keys in a tracker protocol is not published. <span class="tag undisclosed">not disclosed</span></li>
</ul>''',
 D='''<p>Map the migration boundary: which link can change by software (phone ↔ cloud TLS, account key sync), which needs new firmware (tag ↔ phone), and which is fixed in silicon (boot ROM signature check). Each boundary needs a compatibility plan for mixed fleets and a downgrade-resistant transition (Scene 76).</p>''',
 E='''<ul><li>Ask device vendors three questions: can the boot chain verify a new signature type; is there a firmware update path for the installed base; and what is the replacement horizon for devices that cannot be updated?</li></ul>''',
 eng='<p>Bars are drawn from the size table in the scene source; the log scale is labelled. Sizes are for the named parameter sets only.</p>',
 test=['Are the sizes typed by hand into the picture? (No; drawn from one table that cites each standard.)', 'Is size presented as a vulnerability? (No; frame 5 calls it a design constraint.)'],
 src=[FIPS203, FIPS204, FIPS205, RFC7748, SEC1, FIPS186, BTCORE]),

dict(id=76, title='Hybrid key exchange: two locks on one door',
 lede='During the transition, many systems run a classical and a post-quantum key exchange side by side, and combine the results so the session stays secret if either one holds.',
 frames=['Today: a client and a server agree a shared secret with classical elliptic-curve Diffie–Hellman (X25519).',
         'A hybrid adds a post-quantum key encapsulation (ML-KEM-768) alongside it in the same handshake, producing a second shared secret.',
         'A combiner feeds both shared secrets, with the handshake transcript, into one key-derivation function: the session key stays secret if either part holds.',
         'Downgrade prevention: an attacker in the middle who removes the post-quantum offer is caught, because both sides check a hash of everything that was offered.',
         'Rollout states: classical only, then hybrid, then post-quantum only once confidence allows — using reviewed designs such as TLS’s X25519MLKEM768, not a home-made protocol.'],
 A=(['You put two different locks on one door.', 'A thief would need to open both.', 'One lock is old and well tested; one is new.', 'If either lock holds, the door stays shut.', 'And you check nobody quietly removed one of the locks.'],
    'Using an old lock and a new lock together keeps the door shut as long as either one holds.'),
 B='''<p>The old algorithm has decades of study behind it; the new one resists quantum attacks but is younger. A <strong>hybrid</strong> uses both, so a surprise weakness in either does not expose the session. The two results are combined carefully and the whole handshake is checked, so nobody can quietly strip the new part out.</p>
<p><strong>Where the analogy breaks:</strong> two door locks are independent; two key exchanges must be <em>combined</em> correctly, and a naive combination can lose the benefit. That is why only reviewed, standardised constructions should be used.</p>''',
 C='''<p class="eq">session key = KDF( ss<sub>X25519</sub> ‖ ss<sub>ML-KEM</sub> ‖ transcript )</p>
<ul>
<li>TLS 1.3 hybrid key exchange concatenates the two shared secrets into the key schedule; X25519MLKEM768 is the deployed combination. <span class="tag verify">IETF drafts; check status</span></li>
<li>Downgrade resistance comes from authenticating the full transcript (Finished messages, signatures over the handshake). <span class="tag spec">TLS 1.3, RFC 8446</span></li>
<li>Apple’s iMessage PQ3 combines ML-KEM with elliptic-curve keys in its own protocol. <span class="tag verify">vendor documented</span></li>
<li>This scene shows the pattern, not a protocol specification. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Put the hybrid at the key-establishment boundary where long-lived confidentiality is at stake (Scene 78). Require transcript binding, a clear negotiation policy (when to refuse classical-only peers) and monitoring of which mode each connection actually used. Never compose primitives in-house.</p>''',
 E='''<ul><li>Track the share of your traffic (and your vendors’) that uses hybrid key exchange, and set a date-free policy for when classical-only connections become exceptions.</li></ul>''',
 eng='<p>The client, server and combiner are generic. Signatures for authentication are a separate migration (ML-DSA) not shown here.</p>',
 test=['Does the scene suggest designing a custom protocol? (No; frame 5 says reviewed designs only.)', 'Is the post-quantum part shown replacing the classical part at once? (No; rollout states are staged.)'],
 src=[TLSHYB, PQ3, FIPS203, RFC7748]),

dict(id=77, title='Crypto agility: a lifecycle, not a switch',
 lede='Organisations do not “switch on” post-quantum cryptography. They inventory, prioritise, test, roll out in stages, keep the ability to roll back, and check again — and some devices will only change when they are replaced.',
 frames=['Steps 1 and 2: inventory what cryptography runs where, by version (Scene 73); prioritise by data shelf life and exposure (Scene 78).',
         'Steps 3 and 4: engage vendors for roadmaps, firmware paths and test builds; measure sizes, speed, battery and interoperability in a lab.',
         'Steps 5 and 6: stage the rollout — hybrid first, small groups first — and keep the ability to roll back safely and retire old keys.',
         'Step 7: verify continuously and re-inventory as standards move, which leads back to step 1.',
         'Why some devices cannot simply “switch on” new cryptography: no firmware update path, fixed silicon and a coin-cell battery. For these the path is replacement at end of life, planned now.'],
 A=(['First you list every lock.', 'Then you decide which to change first.', 'You try the new locks in a workshop.', 'You change a few, then more.', 'Some tiny old locks cannot change — you plan to replace them.'],
    'Changing locks is a careful cycle you repeat, and some small devices can only be replaced, not upgraded.'),
 B='''<p><strong>Crypto agility</strong> means a system can change its algorithms without being rebuilt. Most phones and servers have it through software updates; many cards and tags have little or none. The cycle shown is how organisations manage that difference over years.</p>
<p><strong>Where the analogy breaks:</strong> the steps look sequential, but in practice different product lines are at different steps at once, and standards change underneath them.</p>''',
 C='''<ul>
<li>Inputs: the inventory (Scene 73), the three clocks (Scene 78), size and performance limits (Scene 75). <span class="tag concept">process</span></li>
<li>Lab measurement covers handshake size and latency, CPU and energy per operation, memory, and interoperability with older peers. <span class="tag concept">conceptual</span></li>
<li>Rollback must not reopen a downgrade path (Scene 76). <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Agility is an architectural property: algorithm identifiers in formats, negotiable suites, updatable trust anchors and key rotation that does not need re-enrolment. Devices without these are migrated by replacement, so their end-of-life dates belong in the security plan.</p>''',
 E='''<ul><li>Assign an owner to each step and each product line; report progress as “share of inventory at each step”, not as a single “quantum-ready” flag.</li></ul>''',
 eng='<p>Process view. The seven steps follow common migration guidance; names and order vary between frameworks.</p>',
 test=['Does the scene imply every device can be upgraded? (No; frame 5 explains why some cannot.)', 'Is a deadline date shown? (No.)'],
 src=[IR8547, FIPS203, FIPS204]),

dict(id=78, title='Three clocks: shelf life, migration time, and the unknown',
 lede='When should you start? Not when someone predicts a date, but when the time your data must stay protected, plus the time change will take, looks long.',
 frames=['Clock x: how long the data must stay secret — its shelf life.',
         'Clock y: how long migrating the systems that protect it will take.',
         'Clock z: how long until a cryptographically relevant quantum computer exists — drawn as unknown, with no date, because published estimates disagree and none is a fact.',
         'The rule (Mosca, 2015): if x + y is larger than z, data encrypted today is at risk. Since z is unknown, ask whether x + y is long; if it is, start now.',
         'Prioritise by sensitivity and exposure: a card’s transaction cryptogram matters for minutes; a tracker’s location history for weeks, and patterns of life for longer; account backups and signed firmware (an authenticity concern) for years.'],
 A=(['Some secrets only matter for a minute.', 'Some secrets must stay secret for years.', 'Changing all the locks takes a long time.', 'Nobody knows when a lock-breaking machine might exist.', 'So we start first where secrets last longest.'],
    'Because nobody knows when, we protect first the secrets that must last longest and take longest to fix.'),
 B='''<p>Three durations decide urgency. If secret data must stay secret for 10 years (x) and moving to new cryptography takes 5 years (y), then it matters whether a capable quantum computer arrives within 15 years (z) — and nobody knows z. The comparison tells you <em>what to do first</em>, not <em>when the danger arrives</em>.</p>
<p><strong>Where the analogy breaks:</strong> real clocks run at known speeds; z is not a clock anyone can read. Treat it as an uncertainty to plan around, not a deadline to quote.</p>''',
 C='''<p class="eq">risk if &nbsp; x + y &gt; z</p>
<ul>
<li>Mosca’s inequality, as a planning heuristic. <span class="tag concept">concept</span></li>
<li>Harvest now, decrypt later applies to confidentiality (x for encrypted data). For signatures, the concern is authenticity: a forged signature only matters once a quantum computer exists, but devices whose trust anchors cannot change carry that exposure for their whole lifetime. <span class="tag concept">conceptual</span></li>
<li>Shelf lives in the table are typical examples. <span class="tag illus">illustrative</span></li>
</ul>''',
 D='''<p>Classify data and trust anchors by shelf life and exposure, estimate y per system from the inventory and vendor answers, and do not invent z. Systems with long x (backups, health or identity data) and long y (embedded devices, firmware trust) go first.</p>''',
 E='''<ul><li>Report risk as “long-shelf-life data still protected by quantum-vulnerable key exchange” and “devices with fixed trust anchors and long lifetimes”, with owners — never as a countdown to a predicted date.</li></ul>''',
 eng='<p>No year appears on clock z by design; published resource estimates (Module 9, Scene 72) change with new methods and hardware.</p>',
 test=['Does the scene give a date for a quantum computer? (No; z is drawn as unknown.)', 'Is firmware treated as a confidentiality problem? (No; it is labelled an authenticity concern.)'],
 src=[MOSCA, IR8547, M9, FTT9]),
])

INSERTS = {74: DEMO_J}
SCRIPTS = ['/invisible-engine/demos/explorer.js']
