# Module 12 content. Each scene: id, title, lede, frames, A(story, why), B, C, D, E, notes(eng, test, src)
APS = 'Apple Platform Security, <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">“Find My security”</a> (check the current edition).'
EMV = 'EMVCo, “EMV Contactless Chip” overview — <a href="https://www.emvco.com/emv-technologies/emv-contactless-chip/">emvco.com</a>.'
NIST = 'NIST, FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA), August 2024 — <a href="https://csrc.nist.gov/projects/post-quantum-cryptography">csrc.nist.gov</a>.'
ALERT = 'Apple Support, <a href="https://support.apple.com/en-us/119874">“What to do if you get an alert that an AirTag … is with you”</a>.'
FINDHUB = 'Google, <a href="https://support.google.com/android/answer/14796936?hl=en">“How Find Hub protects your data”</a>.'
L = lambda path, text: f'<a href="/invisible-engine/{path}">{text}</a>'

M = dict(
    num=12, file='m12.html', title='Holistic architecture',
    kicker='Module 12 · Everything in its place',
    dek='The finale gathers the lesson onto one map: what touches, what radiates, what travels sealed over the internet, what is only arithmetic — and where people, not protocols, decide what is safe.',
    prereq='Modules 1–11; each layer below links back to the scene that teaches it.',
    scenes=[
dict(id=85, title='The whole engine on one map',
 lede='Every object in this lesson lives at a distance: centimetres, metres, or anywhere on the internet. Putting each in its own zone is the quickest way to stop mixing them up.',
 frames=['Touch: the terminal’s field powers the card, and commands and replies pass both ways — only within centimetres.',
         'Radio and internet: the tag broadcasts a rotating key; a passer-by’s phone overhears it and sends a sealed report to the relay, which stores it without being able to read it; the owner’s phone fetches it and opens it.',
         'Nearby: the owner measures distance and direction with ultra-wideband. A finder’s NFC tap shows a web page, not a location — NFC never reaches the relay.',
         'Accounts: the account service decides who may fetch reports and who the tag is shared with. These are permissions, not data.',
         'Underneath everything: cryptography (and its move to post-quantum algorithms), and privacy and governance.'],
 A=(['A card is powered by touching a shop’s machine.', 'A tag whispers to phones walking past.', 'Those phones post a locked letter to a mailbox in the cloud.', 'Only the owner’s phone has the key to open it.', 'Rules and people decide who is allowed to look.'],
    'Each part works at its own distance and does its own job, so knowing which is which tells you what each part can and cannot do.'),
 B='''<p>Three zones, three distances. <strong>Touch</strong> (NFC, centimetres) is where a card is powered and answers a reader (''' + L('m02.html#s09', 'Module 2') + '''). <strong>Radio</strong> (Bluetooth LE and ultra-wideband, metres) is where a tag whispers and a phone overhears or measures distance (''' + L('m04.html#s25', 'Module 4') + ''', ''' + L('m05.html#s39', 'Scene 39') + '''). The <strong>internet</strong> (anywhere) is where sealed reports are stored and accounts decide who may read them (''' + L('m05.html#s36', 'Scene 36') + ''', ''' + L('m06.html#s42', 'Module 6') + ''').</p>
<p><strong>Where the analogy breaks:</strong> the zones are about the radio or field that carries each message, not about where the devices sit. The same phone can be in all three zones in one afternoon.</p>''',
 C='''<ul>
<li>NFC: 13.56 MHz near field, ISO/IEC 14443; both power and data within a few centimetres. <span class="tag spec">specification</span></li>
<li>Bluetooth LE advertising on channels 37/38/39; listening needs no pairing. <span class="tag spec">specification</span> Ultra-wideband ranging measures time of flight between two devices. <span class="tag concept">conceptual</span></li>
<li>Find My reports are end-to-end encrypted; the relay stores them under a lookup value and cannot decrypt them. <span class="tag doc">documented</span></li>
<li>There is no NFC path to the relay: Lost Mode’s NFC tap opens a web page with the serial number and whatever the owner chose to share. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>Draw the trust boundaries on this map before any threat model. The relay is a boundary that stores ciphertext and metadata; the owner’s devices are the only place reports become locations; the account service is where permission — and therefore most real-world abuse — lives (''' + L('m06.html#s48', 'Scene 48') + ''').</p>''',
 E='''<ul><li>Use this map in architecture reviews: for each product, name its zone, its boundary and the team that owns it. Most incidents in this lesson happen at the account and policy layers, not in the radio.</li></ul>''',
 eng='<p>Schematic. Distances are orders of magnitude, not ranges guaranteed by any product. Devices are generic.</p>',
 test=['Is there any arrow from an NFC tap to the cloud relay? (No; frame 3 says so explicitly.)', 'Does any element find a tag by satellite? (No; the tag has no GNSS or cellular.)', 'Are account permissions drawn as data flows? (No; grey dashed arrows are permissions.)'],
 src=[EMV, 'ISO/IEC 14443; Bluetooth SIG, Core Specification.', APS, FINDHUB]),

dict(id=86, title='Three journeys, three different kinds of “wave”',
 lede='The lesson used the word “wave” three times. Each time it meant something different, and the differences are the point.',
 frames=['Energy harvested: a reader’s alternating magnetic field induces a current in a card’s coil, centimetres away. Real energy moves.',
         'Signal overheard: a tag radiates a short radio packet that any phone in range can receive. Real radio waves carry bits over metres.',
         'Amplitudes interfere: in H, Z, H the amplitudes go from 1 and 0, to 0.707 and 0.707, to 0.707 and −0.707, to 0 and 1 (computed). Nothing ripples; the arithmetic adds and cancels.',
         'The same word “wave”, three mechanisms: induction, radio emission and amplitude arithmetic.'],
 A=(['The shop’s machine makes an invisible magnet that powers a card.', 'A tag sends out a tiny radio whisper.', 'A quantum computer does sums where some numbers cancel out.', 'People call all three “waves”, but they are different things.'],
    'Knowing which kind of wave you mean tells you what it can do: power a card, carry a message, or change the odds of an answer.'),
 B='''<p><strong>A</strong> is <em>induction</em>: energy flows through a near magnetic field and falls off steeply with distance (''' + L('m01.html#s04', 'Scene 04') + ''', ''' + L('m02.html#s12', 'Scene 12') + '''). <strong>B</strong> is <em>radio emission</em>: an antenna launches electromagnetic waves that anyone in range can receive (''' + L('m04.html#s25', 'Scene 25') + '''). <strong>C</strong> is <em>quantum amplitude arithmetic</em>: complex numbers attached to outcomes add, and some cancel, so measurement odds change (''' + L('m08.html#s63', 'Scene 63') + ''').</p>
<p><strong>Where the analogy breaks:</strong> only A and B move anything through space. C happens inside a quantum processor; the “wave” is in the mathematics that predicts what measurement will show.</p>''',
 C='''<ul>
<li>Induction: <code>v = −N dΦ/dt</code>; near-field coupling falls steeply with distance. <span class="tag spec">physics</span></li>
<li>Radio: free-space received power falls as 1/d² in the far field; Friis applies only there, not to NFC. <span class="tag spec">physics</span></li>
<li>Amplitudes: H|0⟩ = (|0⟩+|1⟩)/√2; Z flips the sign of |1⟩; H then returns |1⟩, so P(1) = 1. Values computed in the scene. <span class="tag calc">calculated</span></li>
</ul>''',
 D='''<p>Security claims often borrow the wrong wave. “Short range” (A) is a radio property, not an authorisation control; “broadcast” (B) means anyone can listen; “superposition” (C) does not mean a quantum computer reads every answer at once. Test each claim against the mechanism it actually relies on.</p>''',
 E='''<ul><li>When a vendor says “quantum” or “secure because it is short range”, ask which mechanism they mean and what evidence supports the security property, not the physics.</li></ul>''',
 eng='<p>Field and radio arcs are illustrative. Amplitude bars are computed from the gate matrices in the scene source.</p>',
 test=['Is NFC described as a broadcast? (No; it is a near field.)', 'Are amplitudes typed by hand? (No; computed.)', 'Does the scene suggest a quantum computer reads all answers at once? (No; it says the opposite.)'],
 src=['Feynman Lectures on Physics, Vol. I ch. 29; Vol. III ch. 1.', 'Bluetooth SIG, Core Specification.', 'M. A. Nielsen and I. L. Chuang, <em>Quantum Computation and Quantum Information</em>.']),

dict(id=87, title='What is observable, by whom',
 lede='One table for the whole lesson: eight observers, six things they might see. The empty answers matter as much as the full ones — and “unknown” is a finding.',
 frames=['A tap and a radio listener: a card reader sees a plastic card’s number; an NFC phone touching a tag sees only what the owner chose to show; a radio listener sees only the rotating identifier.',
         'A passer-by’s phone sees the identifier, its own location and the report it seals. The relay sees a lookup hash, the sealed report and metadata — never the location.',
         'The owner decrypts the location. Someone who planted a tag sees exactly what an owner sees: the location of the person carrying it.',
         'An organisation’s admin: unknown — it depends on what is enrolled and shared. An outside attacker without the account sees only what a radio listener sees, unless they take over the account.'],
 A=(['Lots of people and machines are near a tag or a card.', 'Most of them can see only a little.', 'The owner can see where the tag is.', 'Someone who hid a tag can see too — that is why alerts exist.', 'Sometimes we just do not know, and we say so.'],
    'Writing down who can see what, and saying “we don’t know” when we don’t, is how you find the risks.'),
 B='''<p>The table agrees with ''' + L('m06.html#s46', 'Scene 46') + ''' and with ''' + L('m05.html#demo-d', 'demo D') + '''. Two rows deserve attention. The <strong>planted tag</strong> row is identical to the owner’s row: encryption protects the account holder, whoever they are (''' + L('m06.html#s49', 'Scene 49') + '''). The <strong>admin</strong> row is unknown: whether an organisation can see locations depends on which accounts and devices it manages and what is shared with them.</p>
<p><strong>Where the analogy breaks:</strong> “observable” here means available to that party by design. It does not cover breaches, legal compulsion or bugs.</p>''',
 C='''<ul>
<li>Plastic contactless card: the reader receives the card number (PAN); a phone wallet sends a device token instead. <span class="tag doc">documented</span></li>
<li>Find My relay: stores reports indexed by a hash of the public key; cannot decrypt them; does not learn the finder’s identity. <span class="tag doc">documented</span></li>
<li>Service metadata (upload time, which account asks) exists even when content is sealed. <span class="tag concept">conceptual</span></li>
<li>An organisation’s visibility: <span class="tag undisclosed">unknown</span> — depends on deployment; not something this lesson can assert.</li>
</ul>''',
 D='''<p>Use “unknown” as a work item, not a blank: each unknown cell is a question for a vendor, an admin or a policy owner. The two cells most often wrong in real reviews are the admin’s view and the metadata column.</p>''',
 E='''<ul><li>For every tracker or wallet programme, fill this table for your organisation and assign an owner to each “unknown”. Re-check it when accounts, devices or vendors change.</li></ul>''',
 eng='<p>Simplified to one finder and one report; Apple’s documented Find My design for the tracker rows.</p>',
 test=['Does the relay row ever show the location? (No.)', 'Is the planted-tag row shown as weaker than the owner’s? (No; it is identical, which is the point.)', 'Are unknown cells left blank? (No; marked unknown.)'],
 src=[APS, EMV, 'This lesson, ' + L('m05.html#demo-d', 'demo D') + ' and ' + L('m06.html#s46', 'Scene 46') + '.']),

dict(id=88, title='What post-quantum cryptography does not fix',
 lede='Post-quantum algorithms will protect messages against a future quantum computer. They will not decide who should be allowed to read them.',
 frames=['What it fixes: key exchange and signatures that a future large, fault-tolerant quantum computer could otherwise attack. Nothing here is broken today.',
         'Consent: a tag hidden in someone’s bag still reports the carrier’s location to the account holder.',
         'Coercion: someone pressured into sharing their location is located just the same.',
         'Phishing and takeover, and stale access: whoever gets into the account — or keeps old access — sees what the owner sees.',
         'What helps instead: alerts on the carrier’s phone, sounds from separated tags, sharing reviews, strong sign-in, least-privilege admin, policy and support. Safety first: disabling a tracker can alert whoever placed it.'],
 A=(['Scientists are making stronger locks for the future.', 'A stronger lock keeps strangers out of the letter.', 'But it cannot tell if the person with the key is being unkind.', 'Phones can warn people about a tag that is not theirs.', 'If you are worried, tell a grown-up you trust.'],
    'Locks protect messages; people and rules protect people.'),
 B='''<p>This is ''' + L('m07.html#demo-k', 'demo K') + ''' as a picture. Post-quantum cryptography replaces the parts of today’s systems that a large quantum computer could attack — key exchange and signatures (''' + L('m09.html#s72', 'Scene 72') + '''). Everything else in the red boxes is about <em>who</em> holds the key and whether they should: consent, coercion, account takeover and stale permissions.</p>
<p><strong>Where the analogy breaks:</strong> “stronger lock” is fair for confidentiality, but post-quantum migration also changes sizes, performance and protocols (Module 10). It is engineering work, not a switch.</p>''',
 C='''<ul>
<li>ML-KEM (FIPS 203) for key establishment; ML-DSA (FIPS 204) and SLH-DSA (FIPS 205) for signatures; they run on ordinary processors. <span class="tag spec">specification</span></li>
<li>No large, fault-tolerant quantum computer capable of breaking RSA or elliptic-curve cryptography is publicly known to exist. <span class="tag concept">status</span></li>
<li>Unwanted-tracking alerts and Lost Mode work independently of the encryption strength of reports. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>Threat models that list only cryptographic adversaries miss the dominant tracker risks. Add the account holder as a potential adversary to the person carrying a tag, and test controls (alerts, sharing review, sign-in strength) separately from crypto.</p>''',
 E='''<ul><li>Fund post-quantum migration on its own timeline (Module 10), and fund consent and account controls now (Module 11). Neither substitutes for the other.</li><li>Safety first: policies must tell people that disabling a tracker can alert whoever placed it, and route them to support.</li></ul>''',
 eng='<p>Generic devices; no product’s post-quantum status is asserted.</p>',
 test=['Does the scene say anything is broken by quantum computers today? (No.)', 'Is post-quantum crypto presented as fixing consent? (No; the opposite.)', 'Is there a safety note? (Yes, frame 5.)'],
 src=[NIST, ALERT, 'Google, <a href="https://support.google.com/product-documentation/answer/14799569?hl=en">Find Hub acceptable use policy</a>.', 'This lesson, ' + L('m07.html#demo-k', 'demo K') + '.']),

dict(id=89, title='The life of a tag: a guardrail and a safety check at every stage',
 lede='From the factory to the bin, a tag passes through seven stages. At each one something should protect the data, and something should protect the person.',
 frames=['Seven stages: issue and provision, register, discover, locate, share, revoke, retire.',
         'A security guardrail at each: keys made in secure hardware and signed firmware; one account with two-factor sign-in; rotating identifiers with no pairing to overhear; end-to-end encrypted reports opened on the owner’s devices; explicit, limited invitations; stopping sharing and removing devices; removing the tag from the account before it changes hands.',
         'A human-safety check at each: alerts for strangers are part of the design; someone else’s tag cannot be quietly added; separated tags become detectable; a carrier can be alerted and an NFC tap shows the serial; review who can see you; plan before changing sharing, because it can alert an abuser; a second-hand tag still linked to someone is a warning sign.',
         'Safety first: disabling a tracker, or changing who it is shared with, can alert whoever placed it. Decide with someone you trust, a support service or the platform’s safety guide.'],
 A=(['A tag is made in a factory with secret keys inside.', 'Someone sets it up on their phone.', 'It helps find lost things, and can be shared with family.', 'At every step there is a lock for the data and a check for people’s safety.', 'If a tag that is not yours is following you, tell a grown-up you trust.'],
    'A good system protects both the information and the people around it, all the way through its life.'),
 B='''<p>The stages follow Apple’s documented AirTag design (''' + L('m05.html#s41', 'Scene 41') + '''); other ecosystems differ in detail (''' + L('m06.html#s47', 'Scene 47') + '''). The purple row is what engineers build; the green row is what keeps people safe when the system is misused (''' + L('m07.html#s53', 'Scene 53') + ''').</p>
<p><strong>Where the analogy breaks:</strong> real life is not a straight line — tags are shared, revoked and re-shared many times, and a stage can be skipped (a tag lost before it is ever registered).</p>''',
 C='''<ul>
<li>Setup links an AirTag to one Apple Account and needs two-factor authentication. <span class="tag doc">documented</span></li>
<li>Item Sharing with up to five people; the owner can stop sharing. <span class="tag doc">documented</span></li>
<li>How keys are re-issued, revoked or erased at each stage is not publicly documented. <span class="tag undisclosed">not disclosed</span></li>
</ul>''',
 D='''<p>For each stage, ask two questions in review: what protects the data, and what protects a person who did not consent? A design that answers only the first will pass a crypto review and fail a safety review.</p>''',
 E='''<ul><li>Turn the two rows into a checklist for procurement and for the 30/90/180-day roadmap (''' + L('m11.html#s84', 'Scene 84') + ''').</li><li>Never require employees to disable alerts or carry undisclosed trackers; route concerns to a confidential, voluntary support path.</li></ul>''',
 eng='<p>Stage names and checks follow Apple’s documented behaviour; reset and removal steps are deliberately not given.</p>',
 test=['Does every stage have both a guardrail and a safety check? (Yes, seven of each.)', 'Is the safety note present? (Yes, frame 4.)', 'Are reset or evasion steps given? (No.)'],
 src=['Apple Support, “Set up your AirTag” and “Share an AirTag”.', ALERT, APS]),
])

AFTER = '''
<section class="ie-legend" aria-labelledby="end-h">
  <h2 id="end-h">The end of the engine</h2>
  <p>Eighty-nine scenes later, the same small card and the same small tag look different: one is powered by a field it cannot feel, the other whispers to strangers who never learn whose it is, and both rely on mathematics that is being rebuilt for a quantum future. What stays the same is the last question in every module: who decides, and who is protected.</p>
  <p><a href="/invisible-engine/">Back to the lesson home</a> · <a href="/articles/from-tap-to-trace.html">Read the essay From Tap to Trace</a></p>
</section>
'''
