from .inserts import DEMO_D, DEMO_E, FIG_EXPERIENCES

APS = 'Apple Platform Security, <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">“Find My security”</a> (check the current edition).'
HEINRICH = 'A. Heinrich, M. Stute, T. Kornhuber, M. Hollick, “Who Can Find My Devices? Security and Privacy of Apple’s Crowd-Sourced Bluetooth Location Tracking System”, PoPETs 2021 (3) — <a href="https://petsymposium.org/popets/2021/popets-2021-0045.php">petsymposium.org</a>. Independent research (reverse engineering).'
FTT = '<a href="/articles/from-tap-to-trace.html">From Tap to Trace</a> (the essay version: Part III on ownership, Part V on the finding network, Figure 06).'

M = dict(
    num=5, file='m05.html', title='AirTag life cycle, finding network and handshakes',
    kicker='Module 5 · How a lost thing is found',
    dek='A suitcase is left on a platform. Its tag cannot see a map and cannot phone home. This module follows the whisper from the tag to a stranger’s phone, through a sealed report, to the owner’s screen — and shows what each handshake does and does not establish.',
    prereq='Module 4 (the BLE whisper and rotating identifiers), and Module 2 Scene 15 for the idea of a cryptographic proof.',
    scenes=[

dict(id=31, title='First-time setup: from a new tag to a named item',
 lede='Setting up a tracker takes a few taps. Those taps are documented; most of what happens underneath is not.',
 frames=['Hold the new tag next to an unlocked iPhone (after pulling the battery tab). Close range is part of the setup step.',
         'The iPhone shows a Connect prompt. Nothing is linked until the owner agrees.',
         'The owner taps Continue and the item is registered to their Apple Account, which must use two-factor authentication.',
         'The item appears in Find My under the name the owner chose (here, “Keys”).',
         'These are Apple’s documented user steps, not a public trace of the messages underneath (Scene 32).'],
 A=(['Dad gets a new tag for his keys.', 'He holds it next to his phone.', 'The phone asks: “Connect?”', 'He says yes and calls it “Keys”.', 'Now the tag belongs to Dad’s account.'],
    'The tag joins one person’s account only when that person says yes on their own phone.'),
 B='''<p>Setup ties a tag to <strong>one Apple Account</strong>. You hold the tag near an unlocked iPhone or iPad, tap <em>Connect</em>, choose a name, and tap <em>Continue</em>; from then on the tag shows up in Find My on every device signed in to that account. The account must use two-factor authentication, and Find My and Location Services must be on.</p>
<p><strong>Where the analogy breaks:</strong> it feels like “pairing” a pair of headphones, but the important link is not tag-to-phone; it is tag-to-<em>account</em>. Replace the phone and the tag is still yours (Scene 41).</p>''',
 C='''<ul>
<li>Documented steps: hold near device → Connect → name → Continue → registered to the Apple Account. <span class="tag doc">documented</span></li>
<li>Requirements: a compatible iPhone or iPad on a current iOS/iPadOS, Find My and Location Services on, two-factor authentication. <span class="tag doc">documented</span></li>
<li>One account at a time; to give a tag away, remove it from your account first. <span class="tag doc">documented</span></li>
<li>The radio and server messages during setup are not published. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>''',
 D='''<p>The security-relevant step is <strong>account binding under an authenticated session</strong>, not radio proximity. Proximity limits who can start setup; the account binding (with two-factor authentication) decides who can later read locations. Treat “held near the phone” as a usability gate, not an authentication factor.</p>''',
 E='''<ul><li>If staff register trackers to company assets, decide <em>whose</em> Apple Account they are bound to. A personal account binding means the company cannot recover the asset’s history when that person leaves.</li></ul>''',
 eng='<p>The phone screens are generic drawings, not Apple UI captures. The tag is drawn as a generic round tracker.</p>',
 test=['Does the scene present setup as a packet-level trace? (No: frame 5 says it is the documented user steps.)', 'Is the link drawn as registration (grey dashed), not data? (Yes.)', 'Does it imply several accounts can own one tag at once? (No: one account at a time.)'],
 src=['Apple Support, “Set up your AirTag” and “Find My: AirTag” user guide — <a href="https://support.apple.com/">support.apple.com</a>.', FTT]),

dict(id=32, title='What setup actually establishes, layer by layer',
 lede='Six things are set up when a tag joins an account. For each one we say what Apple documents, what we infer, and what is not public.',
 frames=['Tag hardware identity: a serial number is documented (printed, and shown by an NFC tap); factory key material is not disclosed.',
         'Onboarding transport: a short-range radio exchange with the owner’s iPhone, inferred from the documented “hold it near” step; the messages are not disclosed.',
         'User authorisation: the owner taps Connect on a device signed in to an Apple Account with two-factor authentication. Documented.',
         'Account registration: the item is linked to one Apple Account at a time. The behaviour is documented; the message format is not.',
         'Key provisioning: the owner’s device creates a key pair and a secret from which rotating keys are derived. The design is documented; the exact exchange is not.',
         'Revocation and transfer: Remove Item unlinks the tag so another account can add it. The behaviour is documented; the cryptographic mechanism is not.'],
 A=(['Setting up a tag is like several locks clicking shut.', 'One lock is the tag’s own number.', 'One is Dad saying “yes”.', 'One gives the tag secret codes to whisper.', 'Some locks we can see; some are hidden inside.'],
    'Several separate things get set up at once, and only some of them are explained in public.'),
 B='''<p>“Pairing” is really six jobs: identify the hardware, talk to it, get the owner’s permission, record the owner, give the tag what it needs to make <strong>rotating identifiers</strong> (Module 4), and make it possible to undo all of that later.</p>
<p><strong>Where the analogy breaks:</strong> a list of layers suggests a neat, documented protocol stack. Here, several layers are only visible through their effects. Labels below tell you which.</p>''',
 C='''<ol>
<li><strong>Hardware identity.</strong> Serial number on the tag and on the NFC page. <span class="tag doc">documented</span> Factory-provisioned keys or certificates. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>Transport.</strong> Close-range radio during setup (Bluetooth LE is the natural candidate). <span class="tag concept">inferred</span> Message contents. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>Authorisation.</strong> User consent on a signed-in device with two-factor authentication. <span class="tag doc">documented</span></li>
<li><strong>Registration.</strong> One account at a time; removal required before transfer. <span class="tag doc">documented</span> Server API and formats. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>Key provisioning.</strong> Apple describes a P-224 key pair (d, P) and a secret SK₀ created on the owner’s device, from which time-indexed keys are derived; the tag can compute the public keys it advertises, while private keys stay with the owner. <span class="tag doc">documented</span> <span class="tag verify">verify against the current guide</span> How SK₀ and P reach the tag. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>Revocation.</strong> Remove Item, then another account can add the tag. <span class="tag doc">documented</span> Whether and how keys are erased on the tag. <span class="tag undisclosed">not publicly disclosed</span></li>
</ol>''',
 D='''<p>Threat-model each layer separately. The strongest public guarantees are in layers 3 and 5 (authenticated consent; private keys held only by the owner’s devices). The least visible are 1, 2 and 6: factory provisioning, the setup transport and erasure on removal. Independent research has examined parts of the system <span class="tag research">research</span>; claims beyond it are inference.</p>''',
 E='''<ul><li>When a vendor says a device is “securely paired”, ask which of these six layers that covers, and which are documented. “Undisclosed” is not “insecure”, but it is unverifiable by you.</li></ul>''',
 eng='<p>Indicator chips: DOCUMENTED (Apple states it), INFERRED (follows from documented behaviour), UNDISCLOSED (not public). No layer here is drawn as a packet sequence.</p>',
 test=['Is every layer labelled documented, inferred or undisclosed? (Yes, in the diagram and in level C.)', 'Does the scene invent message names or byte layouts? (No.)', 'Are private keys placed only on the owner’s side? (Yes.)'],
 src=[APS, 'Apple Support, “Set up your AirTag”; “Remove an AirTag from your Apple Account” — <a href="https://support.apple.com/">support.apple.com</a>.', HEINRICH]),

dict(id=33, title='Far-away luggage: a tag that does not know where it is',
 lede='A suitcase is left on a station platform. The owner is far away. What does the tag actually know?',
 frames=['The suitcase is left on the platform; the owner is far away (distances illustrative).',
         'The tag has no satellite receiver and no SIM or mobile modem: it cannot look up its own position or call anyone.',
         'What it has: a coin cell and a Bluetooth Low Energy radio that repeats a short advertisement.',
         'So who knows where it is? Not the tag — a passing phone that knows where it is itself (Scene 34).'],
 A=(['Grandma leaves her suitcase on the train platform.', 'Its tag cannot see a map.', 'It has no phone inside, so it cannot call.', 'It just keeps whispering a secret word.'],
    'The tag cannot find itself, so it whispers and waits for a phone that knows where it is.'),
 B='''<p>Item trackers like AirTag are deliberately simple: a coin cell, a Bluetooth Low Energy radio, and a few other parts (Module 4). They have <strong>no GPS and no mobile connection</strong>. That is why they are small and why the battery lasts about a year or more, and it is also why they depend entirely on other people’s phones to be found far away.</p>
<p><strong>Where the analogy breaks:</strong> “the tag reports its location” is the common phrase, and it is wrong. The tag reports nothing; phones near it report <em>their own</em> location (Scene 35).</p>''',
 C='''<ul>
<li>AirTag hardware: Bluetooth LE, ultra-wideband, NFC, speaker, accelerometer, user-replaceable CR2032 cell. No GNSS receiver, no cellular modem. <span class="tag doc">documented</span></li>
<li>Compare a GPS tracker: GNSS receiver + cellular modem + larger battery; it knows and sends its own coordinates (Module 4, Scene 30).</li>
<li>Advertising intervals and power are covered in Module 4 (Scenes 24 and 29); values there are labelled illustrative.</li>
</ul>''',
 D='''<p>The design choice (no GNSS, no cellular) moves the location capability to a crowd of third-party devices. That keeps the tag cheap and long-lived, but makes the system’s privacy depend on how those third parties report: encrypted, anonymous, and with rotating identifiers (Scenes 36 and 28).</p>''',
 E='''<ul><li>For high-value assets that must be tracked anywhere, a crowd-sourced tag is the wrong tool: coverage depends on passers-by. Use dedicated GNSS + cellular trackers under a managed contract.</li></ul>''',
 eng='<p>The owner’s distance is illustrative. Radio arcs are illustrative drawings, not field measurements.</p>',
 test=['Does any frame show the tag receiving satellite signals? (No: crossed out.)', 'Is the coin cell shown as the only power source? (Yes.)'],
 src=['Apple, “AirTag — Technical Specifications” — <a href="https://support.apple.com/">support.apple.com</a>.', FTT]),

dict(id=34, title='A passer-by’s phone overhears the whisper',
 lede='A stranger walks past the suitcase. Their phone hears the tag’s advertisement. Nobody pairs with anything.',
 frames=['The tag repeats a short Bluetooth LE advertisement carrying a rotating public key: no name, no owner, no location.',
         'A participating iPhone within radio range receives it, one way. Reception is not guaranteed.',
         'There is no pairing, no handshake and no reply to the tag: the tag never learns who heard it.',
         'It is an observation handled in the background, not a connection to the owner or the tag.'],
 A=(['A lady walks past the suitcase.', 'Her phone hears the tag’s whisper.', 'The phone does not answer the tag.', 'The lady does not even notice.'],
    'A passing phone can overhear a whisper without talking back, like hearing a bell ring.'),
 B='''<p>Bluetooth LE devices can <strong>broadcast</strong> short advertisements that any nearby receiver may hear — the same mechanism shops use for beacons. The tag advertises; a passing iPhone that participates in the Find My network scans and picks it up. There is no pairing and no two-way exchange, and the finder does nothing.</p>
<p><strong>Where the analogy breaks:</strong> “the tag connects to nearby phones” is a common description and it is wrong. A connection would let the two sides exchange messages; here information moves one way only.</p>''',
 C='''<ul>
<li>BLE advertising is connectionless; scanners can receive advertisements without pairing (Bluetooth Core Specification, advertising and scanning). <span class="tag spec">specification</span></li>
<li>The Find My advertisement carries (part of) the current public key Pᵢ. <span class="tag doc">documented</span> Exact payload layout is described by independent research <span class="tag research">research</span>, not by Apple.</li>
<li>Reception is probabilistic: scan windows, distance, walls and bodies matter (Module 4, Scene 27 and demo C).</li>
</ul>''',
 D='''<p>The finder phone is an <strong>untrusted relay that learns little</strong>: a random-looking key that changes over time. It cannot link the key to an owner. Risks remain elsewhere: the same broadcast can be heard by any scanner, which is why the identifiers rotate (Module 4, Scene 28).</p>''',
 E='''<ul><li>Your managed iPhones may act as finders for strangers’ items by default. Know whether your mobile policy changes that, and what it costs in privacy and in battery: very little, per Apple’s design.</li></ul>''',
 eng='<p>“Participating” means an Apple device with Find My network participation on; reception is not guaranteed.</p>',
 test=['Is any reply from the phone to the tag drawn? (No: crossed out.)', 'Does the scene say the finder is notified or asked? (No.)'],
 src=['Bluetooth SIG, Core Specification (advertising and scanning) — <a href="https://www.bluetooth.com/specifications/specs/">bluetooth.com</a>.', APS, HEINRICH]),

dict(id=35, title='Whose location is it? The finder phone’s own',
 lede='The whisper has no position in it. The location in a sighting is where the finder’s phone thinks it is.',
 frames=['The whisper arrives with a rotating key and no location: the tag does not know where it is.',
         'The finder phone works out its own approximate position from satellites (GNSS), Wi-Fi and cell towers, as for any map app.',
         'A sighting is the phone’s estimated place plus the time: the tag was somewhere within radio range of that point.',
         'The tag never asks a satellite anything.'],
 A=(['The tag whispers, but it does not know where it is.', 'The lady’s phone knows where it is from satellites and Wi-Fi.', 'The phone says: “I heard it, here, now.”', 'That is the clue.'],
    'The clue is the place of the phone that heard the tag, not a place the tag knew.'),
 B='''<p>Every modern phone can estimate its own position. When a participating iPhone hears a lost item, it attaches <strong>its own</strong> estimated location and the time. The resulting point is approximate twice over: the phone’s position has an error, and the tag could be anywhere within Bluetooth range of the phone.</p>
<p><strong>Where the analogy breaks:</strong> a map pin looks precise. A sighting is closer to “near here, at about this time”.</p>''',
 C='''<ul>
<li>Phone location fuses GNSS, Wi-Fi and cellular data and motion sensors; accuracy varies from metres to hundreds of metres. <span class="tag concept">conceptual</span></li>
<li>BLE range to a phone is typically tens of metres, less through bodies and walls. <span class="tag illus">illustrative</span></li>
</ul>
<p class="eq">Sighting uncertainty ≈ phone position error + radio range (order of magnitude, not a formula Apple publishes). <span class="tag concept">conceptual</span></p>''',
 D='''<p>The location in a report is <strong>the finder’s location</strong>. The design protects the finder by encrypting it to the tag’s key and not attaching the finder’s identity (Scene 36). That also means a sighting is evidence of proximity, not of the tag’s exact position.</p>''',
 E='''<ul><li>When someone presents a tracker map as evidence (asset loss, an incident), treat each point as “near, at about this time”, with error bars, not as a GPS fix.</li></ul>''',
 eng='<p>Satellites, access point and tower are generic. Signals into the phone are drawn as radio signals; the sighting is local information until it is encrypted in Scene 36.</p>',
 test=['Is any arrow drawn from a satellite to the tag? (No; frame 4 crosses it out.)', 'Is the sighting described as approximate? (Yes.)'],
 src=[APS, FTT]),

dict(id=36, title='The sighting is sealed before it leaves the finder’s phone',
 lede='The finder phone encrypts the sighting to the tag’s public key, then uploads it. Only the owner’s devices can open it.',
 frames=['The tag advertises its current public key Pᵢ, which changes over time.',
         'The finder phone encrypts its own location and the time to Pᵢ. Only the matching private key opens it.',
         'The encrypted report travels over the internet to Apple’s Find My relay.',
         'The relay stores it under a lookup value: a SHA-256 hash of the public key.',
         'Hidden content is not zero metadata: the hash, the ciphertext, the upload time and network connection data still exist.'],
 A=(['The lady’s phone writes a note: “here, now”.', 'It locks the note with the tag’s open padlock.', 'It posts the locked note to a big mailbox.', 'The mailbox cannot open it.'],
    'The finder locks the note with the tag’s public padlock, so only the owner’s key can open it.'),
 B='''<p>This is <strong>public-key encryption</strong>: anyone can lock a message with a public key; only the holder of the matching private key can unlock it. The tag broadcasts a public key; the finder’s phone uses it to seal the location; the private key never leaves the owner’s devices. Apple stores the sealed report filed under a fingerprint (a hash) of that public key.</p>
<p><strong>Where the analogy breaks:</strong> “end-to-end encrypted” means the content is hidden. It does not mean nothing is known: a report exists, at a time, under a lookup value.</p>''',
 C='''<ul>
<li>Curve NIST P-224; the finder generates an ephemeral key pair, performs ECDH with Pᵢ, derives a symmetric key, and encrypts the location with AES-GCM. <span class="tag doc">documented</span> <span class="tag verify">verify against the current guide</span></li>
<li>Apple states it cannot read the location and does not know the identity of the finder. <span class="tag doc">documented</span></li>
<li>Upload is over a normal TLS connection, so network metadata exists at that layer. <span class="tag concept">conceptual</span></li>
</ul>
<p class="eq">report = (ephemeral public key, AES-GCM(KDF(ECDH(e, Pᵢ)), location ‖ time)) &nbsp;·&nbsp; index = SHA-256(Pᵢ)</p>''',
 D='''<p>Two separate protections: <strong>confidentiality</strong> of the location (encryption to Pᵢ) and <strong>unlinkability</strong> of reports across time (rotating Pᵢ, so hashes change). Residual exposure: upload timing, the volume of reports per hash, and transport metadata, which depend on Apple’s retention practices rather than on cryptography. Research has analysed the design and some implementation issues <span class="tag research">research</span>.</p>''',
 E='''<ul><li>“Apple can’t see it” is a statement about content. If your risk includes metadata (who uploads when, from where), ask what is retained and for how long; the cryptography does not answer that.</li></ul>''',
 eng='<p>Hash rows and ciphertext blocks are drawn as placeholders, not real values. Subscript indices are illustrative.</p>',
 test=['Does the scene claim Apple sees no metadata? (No: frame 5.)', 'Is the finder shown encrypting before upload? (Yes, frame 2.)', 'Is the public key drawn as able to decrypt? (No: only the private key opens it.)'],
 src=[APS, HEINRICH, FTT]),

dict(id=37, title='How the owner gets the answer',
 lede='The owner’s own device fetches the sealed reports and opens them. What it shows is a last-seen point, not a live feed.',
 frames=['The owner opens Find My on a device signed in to their Apple Account (with two-factor authentication).',
         'The device regenerates the public keys its tag would have used over the period, and hashes each one.',
         'It asks the relay for reports filed under those hashes and downloads the matching encrypted reports.',
         'It decrypts them locally with the private keys dᵢ and shows an estimated place and a time.',
         'A sighting, not live tracking: points arrive when phones pass by, with delays and gaps.'],
 A=(['Grandma opens the Find My app.', 'Her phone works out which secret words the tag used.', 'It fetches the locked notes from the mailbox.', 'Only her phone can unlock them.', 'It shows: “near Platform 3, 14 minutes ago”.'],
    'The owner’s phone collects the locked notes and opens them itself, so it sees where the suitcase was, not where it is right now.'),
 B='''<p>The owner’s device knows the secret from which every past public key was derived, so it can recompute them, fetch the reports filed under their hashes, and decrypt them. The map then shows the most recent sighting with a time.</p>
<p><strong>Where the analogy breaks:</strong> a moving dot on a map looks like live tracking. It is a series of separate, delayed reports; if no participating phone passes by, nothing new arrives.</p>''',
 C='''<ul>
<li>Owner devices derive Pᵢ and dᵢ for each time period from (d, SK₀), compute SHA-256(Pᵢ), query the relay and decrypt reports locally. <span class="tag doc">documented</span> <span class="tag verify">verify against the current guide</span></li>
<li>Access requires an authenticated Apple Account session on an owner device. <span class="tag doc">documented</span></li>
<li>Report frequency and latency depend on passers-by and are not published as guarantees. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>''',
 D='''<p>The <strong>decryption boundary</strong> is the owner’s device set. The account service authorises the query; the relay returns ciphertexts. Compromise of the owner’s Apple Account and a trusted device is therefore the main path to someone else reading the locations — an identity problem, not a cryptographic one (Module 6).</p>''',
 E='''<ul><li>Protect the accounts that own trackers like any account with location data: strong two-factor authentication, reviewed trusted devices, and a recovery plan.</li></ul>''',
 eng='<p>Times and place names are illustrative. Demo D, below, lets you scrub through the three places and toggle what each party can see.</p>',
 test=['Is decryption drawn on the owner’s device, not at Apple? (Yes.)', 'Is the result described as a sighting with a time, not a live position? (Yes, frame 5.)'],
 src=[APS, FTT]),

dict(id=38, title='The whole exchange in five lanes',
 lede='The same story as a sequence diagram: five parties, eleven numbered steps, and two trust boundaries.',
 frames=['The five lanes. 1, the tag broadcasts its current public key over Bluetooth; 2, the finder phone takes its own location and the time; 3, it encrypts them to the public key.',
         '4, the finder uploads the encrypted report with its SHA-256 lookup hash; 5, the relay stores it by hash.',
         '6, the owner’s device signs in with two-factor authentication; 7, the account service returns an authorised session.',
         '8, the owner’s device derives the public keys and hashes; 9, it requests reports by hash; 10, the relay returns the encrypted reports; 11, the device decrypts them with its private keys.',
         'Trust boundaries: Apple’s services store and route; the private keys stay on the owner’s devices.'],
 A=(['The tag whispers.', 'A stranger’s phone writes a locked note.', 'The mailbox keeps the note.', 'Grandma proves who she is.', 'Her phone fetches and unlocks the note.'],
    'Five helpers pass one locked note along, and only the last one can open it.'),
 B='''<p>Read the diagram top to bottom. Blue is radio, purple is encrypted, green is local or plaintext, grey dashed is permission. Notice which lanes never see a location in the clear: the tag (it never had one), the relay and the account service. The <a href="/articles/from-tap-to-trace.html">From Tap to Trace</a> essay draws a shorter version as Figure 06.</p>
<p><strong>Where the analogy breaks:</strong> a sequence diagram looks synchronous. In reality, steps 1–5 and 6–11 happen at different times and many times over.</p>''',
 C='''<ul class="steps">
<li><strong>1.</strong> Tag → finder: BLE advertisement containing Pᵢ. <span class="tag doc">documented</span></li>
<li><strong>2.</strong> Finder: own location (GNSS / Wi-Fi / cellular) and time. <span class="tag concept">conceptual</span></li>
<li><strong>3.</strong> Finder: ECIES-style encryption to Pᵢ (P-224, ECDH, KDF, AES-GCM). <span class="tag doc">documented</span></li>
<li><strong>4.</strong> Finder → relay: SHA-256(Pᵢ), ciphertext, over TLS. <span class="tag doc">documented</span></li>
<li><strong>5.</strong> Relay: store by hash. <span class="tag doc">documented</span> Retention period. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>6–7.</strong> Owner device ↔ account service: authenticated session. <span class="tag concept">conceptual</span></li>
<li><strong>8.</strong> Owner device: derive Pᵢ, compute hashes. <span class="tag doc">documented</span></li>
<li><strong>9–10.</strong> Query by hash; receive ciphertexts. <span class="tag doc">documented</span> Exact API. <span class="tag undisclosed">not publicly disclosed</span></li>
<li><strong>11.</strong> Owner device: decrypt with dᵢ. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>Map controls to lanes: the tag (rotation, hardware), the finder (encrypt before upload, no identity attached), Apple services (storage, authorisation, metadata retention), the owner’s devices (key custody, device trust). The weakest boundary in practice is usually the owner’s account, not the cipher.</p>''',
 E='''<ul><li>Use this diagram to assign ownership in a review: which risks are yours (accounts, devices, people), which are the vendor’s (relay, retention), and which no one controls (who walks past).</li></ul>''',
 eng='<p>The boxes for the trust boundaries are labelled in the diagram; the legend omits them only for space.</p>',
 test=['Does any lane other than the owner’s device decrypt? (No.)', 'Is the sign-in drawn as permission (grey dashed), not data? (Yes.)', 'Are steps 6–7 labelled conceptual rather than documented messages? (Yes.)'],
 src=[APS, HEINRICH, FTT]),

dict(id=39, title='Finding it nearby is a different mechanism',
 lede='The map says roughly where. In the same room, Find My switches to sound and ultra-wideband — a separate exchange.',
 frames=['Far away, the map shows a last-seen point built from sightings: a global location.',
         'In Bluetooth range, the owner’s iPhone can ask the tag to play a sound.',
         'A compatible iPhone and the tag exchange ultra-wideband messages; the round-trip time gives the distance.',
         'The phone combines ultra-wideband with its camera, ARKit, accelerometer and gyroscope to point an arrow (illustrative readout).',
         'The Bluetooth advertisement carries no direction. Precision Finding needs an iPhone with ultra-wideband: iPhone 11 or later, not iPhone SE.'],
 A=(['The map says the keys are at home.', 'At home, Dad asks the tag to beep.', 'His phone and the tag ping each other very fast.', 'An arrow says: “8 metres, that way”.'],
    'Far away a map gives a rough place; close by the phone measures how far and which way.'),
 B='''<p>There are three different answers: <strong>where on Earth</strong> (from sightings, Scene 37), <strong>how far</strong> (from ultra-wideband ranging) and <strong>which way</strong> (ranging plus the phone’s own sensors). Play Sound simply uses a Bluetooth connection when you are within range.</p>
<p><strong>Where the analogy breaks:</strong> the arrow looks like the tag is pointing at itself. The phone works the direction out; nothing in the tag’s broadcast says “I am to your left”.</p>''',
 C='''<ul>
<li>Precision Finding uses ultra-wideband with camera input, ARKit, accelerometer and gyroscope. <span class="tag doc">documented</span></li>
<li>Requires an iPhone with ultra-wideband (iPhone 11 and later, excluding iPhone SE models). <span class="tag doc">documented</span> <span class="tag verify">check current models</span></li>
<li>Ultra-wideband ranging is a two-way exchange between the owner’s phone and the tag, not a location broadcast. <span class="tag concept">conceptual</span></li>
</ul>
<p class="eq">distance ≈ c · (t_round − t_reply) / 2, with c ≈ 3 × 10⁸ m/s (two-way ranging) <span class="tag concept">conceptual</span></p>''',
 D='''<p>Nearby finding is an <strong>owner-initiated, short-range</strong> interaction and uses different radios from the crowd-sourced network. Threat models for “someone nearby can locate the tag precisely” differ from those for “someone far away can read sightings”; keep them separate in reviews.</p>''',
 E='''<ul><li>Precision Finding is a feature of the owner’s phone hardware. When buying devices for staff who must locate assets, check UWB support rather than assuming every iPhone has it.</li></ul>''',
 eng='<p>The “8 m to the right” readout is illustrative, not a captured screen.</p>',
 test=['Is direction attributed to the phone’s sensors and ranging, not to the BLE advertisement? (Yes.)', 'Is the iPhone SE exclusion stated? (Yes.)', 'Is the map point described as global location from sightings? (Yes.)'],
 src=['Apple Support, “Use Precision Finding to locate your AirTag” — <a href="https://support.apple.com/">support.apple.com</a>.', FTT]),

dict(id=40, title='NFC Lost Mode: a tap that shows a note, not a location',
 lede='Someone finds the tag itself. They tap it with an NFC phone and read only what the owner chose to share.',
 frames=['The finder holds an iPhone or NFC-capable Android phone a few centimetres from the tag. No app and no account are needed.',
         'The phone opens a web page about the item showing its serial number.',
         'Only if the owner turned on Lost Mode: the owner’s message and the phone number or email the owner chose to share.',
         'What NFC does not do: no distant tracking, no part in the crowd-sourced network, and no contact details unless the owner chose them.'],
 A=(['A boy finds a tag on a bench.', 'He touches it with his mum’s phone.', 'A page opens: “Lost! Please call.”', 'The page shows only what the owner wanted.'],
    'Touching the tag shows a short note the owner left, and only works when the phone is right next to it.'),
 B='''<p>Tags like AirTag also contain an <strong>NFC</strong> chip, the same short-range technology as contactless cards (Module 2). A tap opens a web page about the item. If the owner has put the item in <strong>Lost Mode</strong>, the page also shows the owner’s message and the contact details they chose to share.</p>
<p><strong>Where the analogy breaks:</strong> this is not how the item is found far away. NFC works at centimetres, so it only helps the person already holding the tag.</p>''',
 C='''<ul>
<li>Any NFC-capable smartphone can read the tag; the page shows the serial number. <span class="tag doc">documented</span></li>
<li>In Lost Mode the owner can add a message and a phone number or email; “Notify When Found” alerts the owner when the item is seen. <span class="tag doc">documented</span></li>
<li>For a tag found moving with you that is not yours, Apple’s guidance says the page can show the serial number and the last four digits of the owner’s phone number. <span class="tag doc">documented</span> <span class="tag verify">verify current behaviour</span></li>
<li>NFC operating distance: a few centimetres (ISO/IEC 14443-class proximity). <span class="tag spec">specification</span></li>
</ul>''',
 D='''<p>The NFC page is a <strong>deliberate, owner-controlled disclosure</strong>. Review it as such: what the owner publishes (phone number, email) is visible to whoever holds the tag. Safety guidance for people who find an unknown tag belongs to Module 7.</p>''',
 E='''<ul><li>If company assets carry trackers in Lost Mode, publish a role mailbox or switchboard number, never a person’s mobile number.</li></ul>''',
 eng='<p>The web page is a generic drawing; serial and phone number are fictional. Demo E, below, separates the four kinds of connection a tag can have.</p>',
 test=['Does the scene suggest NFC enables distant tracking? (No: frame 4.)', 'Is contact data shown only as the owner’s choice? (Yes.)', 'Does it give any way to bypass Lost Mode? (No.)'],
 src=['Apple Support, “If your AirTag is lost” / “Use Lost Mode for AirTag” and “What to do if you find an AirTag” — <a href="https://support.apple.com/">support.apple.com</a>.']),

dict(id=41, title='An owner’s life with the tag: what survives each change',
 lede='Phones break, items get shared, accounts get lost. Ownership follows the Apple Account through all of it.',
 frames=['Setup moves the tag from unregistered to registered to one Apple Account.',
         'The owner can share the item with up to five people and later stop sharing; sharing grants viewing and playing a sound, not ownership.',
         'A lost or replaced iPhone changes nothing about ownership: a newly signed-in device gets access, with key material synced through end-to-end encrypted iCloud Keychain, according to Apple.',
         'Remove Item unlinks the tag so another account can set it up; if it is out of range, Apple documents a reset procedure.',
         'Losing the account itself without a recovery path means losing access to the item and its sightings; account recovery restores it.',
         'Every transition shown is documented behaviour; how keys are re-issued, revoked or erased at each step is not disclosed.'],
 A=(['Dad’s tag belongs to his account, not his phone.', 'He lets Mum see it too.', 'His phone breaks; his new phone still finds the tag.', 'If he gives the tag away, he removes it first.', 'If he loses his account, he loses the tag.'],
    'The tag belongs to an account, so keeping that account safe matters more than keeping a phone.'),
 B='''<p>Think of the tag’s owner as <strong>an account</strong>, not a device. That is why a replaced phone just works, why giving a tag away starts with removing it, and why losing access to the account is the one change that can strand the item.</p>
<p><strong>Where the analogy breaks:</strong> a state diagram suggests every transition is clean. Out-of-range removals and account recovery have edge cases; and what happens to keys at each step is not public.</p>''',
 C='''<ul>
<li>Item sharing: up to five people; recipients can see the location and play a sound; the owner can stop sharing. <span class="tag doc">documented</span></li>
<li>Key material syncs among the owner’s devices through end-to-end encrypted iCloud Keychain. <span class="tag doc">documented</span> <span class="tag verify">verify against the current guide</span></li>
<li>Remove Item; a reset procedure exists for tags removed out of range. <span class="tag doc">documented</span></li>
<li>Viewing items on iCloud.com. <span class="tag verify">verify current support</span></li>
<li>Key rotation, re-keying on share or removal, and erasure. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>''',
 D='''<p>Model <strong>permissions, not devices</strong>: owner (full), shared viewers (location + sound), finders (none), Apple (store and route). The most consequential transitions are account compromise and account loss, both identity events. Shared viewers also receive location data; revocation is a policy action you must remember to take.</p>''',
 E='''<ul><li>Add trackers to joiner–mover–leaver processes: who owns each tag’s account binding, who has been shared on it, and who removes it when a person or asset leaves.</li></ul>''',
 eng='<p>States and transitions are simplified. Unwanted-tracking alerts and survivor safety are covered in Module 7; see also <a href="/articles/from-tap-to-trace.html">From Tap to Trace</a>.</p>',
 test=['Does the scene give reset steps? (No: only that Apple documents a procedure.)', 'Is sharing distinguished from ownership? (Yes.)', 'Are undisclosed key mechanisms labelled as such? (Yes, frame 6.)'],
 src=['Apple Support, “Share an AirTag or other item in Find My”, “Remove an AirTag from your Apple Account” — <a href="https://support.apple.com/">support.apple.com</a>.', APS, FTT]),
])

BEFORE = FIG_EXPERIENCES
INSERTS = {37: DEMO_D, 40: DEMO_E}
SCRIPTS = ['/invisible-engine/demos/lost.js', '/invisible-engine/demos/connections.js']
