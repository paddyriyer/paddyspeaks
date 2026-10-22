from .inserts import DEMO_F

FINDMY = 'Apple Platform Security, “Find My security” — <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">support.apple.com</a>.'
UNWANTED = 'Apple Support, “What to do if you get an alert that an AirTag … is with you” — <a href="https://support.apple.com/en-us/119874">support.apple.com/en-us/119874</a>.'
PSG = 'Apple Personal Safety User Guide, “Detect unwanted trackers” — <a href="https://support.apple.com/guide/personal-safety/detect-unwanted-trackers-ips139b15fd9/web">support.apple.com</a>.'
DULT24 = 'Apple Newsroom, “Apple and Google deliver support for unwanted tracking alerts in iOS and Android”, May 2024 — <a href="https://www.apple.com/newsroom/2024/05/apple-and-google-deliver-support-for-unwanted-tracking-alerts-in-ios-and-android/">apple.com</a>.'
IETF = 'IETF, “Detecting Unwanted Location Trackers (dult)” working group — <a href="https://datatracker.ietf.org/wg/dult/about/">datatracker.ietf.org</a>.'
AIRTAG_UPD = 'Apple Newsroom, “An update on AirTag and unwanted tracking”, February 2022 — <a href="https://www.apple.com/newsroom/2022/02/an-update-on-airtag-and-unwanted-tracking/">apple.com</a>.'
G_BLOG = 'Google Online Security Blog, “How we built the new Find Hub network with user security and privacy in mind”, April 2024 — <a href="https://security.googleblog.com/2024/04/find-my-device-network-security-privacy-protections.html">security.googleblog.com</a>.'
G_DATA = 'Android Help, “How Find Hub protects your data” — <a href="https://support.google.com/android/answer/14796936?hl=en">support.google.com</a>.'
G_UNK = 'Android Help, “Find unknown trackers” — <a href="https://support.google.com/android/answer/13658562?hl=en">support.google.com</a>.'
G_AUP = 'Google Help, “Find Hub acceptable use policy” — <a href="https://support.google.com/product-documentation/answer/14799569?hl=en">support.google.com</a>.'
S_EVOLVE = 'Samsung Newsroom, “Evolving for the Better: SmartThings Ecosystem Gives Galaxy Users Better Control Over Their Connected Devices” — <a href="https://news.samsung.com/global/evolving-for-the-better-smartthings-ecosystem-gives-galaxy-users-better-control-over-their-connected-devices">news.samsung.com</a>.'
S_300 = 'Samsung Newsroom, “Samsung SmartThings Find Rapidly Expands With Over 300 Million Nodes Helping To Locate Devices” — <a href="https://news.samsung.com/global/samsung-smartthings-find-rapidly-expands-with-over-300-million-nodes-helping-to-locate-devices">news.samsung.com</a>.'
S_TAG2 = 'Samsung Newsroom, “Introducing New Samsung Galaxy SmartTag2” — <a href="https://news.samsung.com/us/introducing-new-samsung-galaxy-smarttag2-a-smart-way-to-keep-track-of-important-things-in-your-life">news.samsung.com</a>.'
EA = '<a href="/articles/every-arrow-is-a-decision.html#tracker">Every Arrow Is a Decision — Item trackers</a> (the same three companies, compared claim by claim).'
FTT = '<a href="/articles/from-tap-to-trace.html">From Tap to Trace</a> (the essay version of this module).'

M = dict(
    num=6, file='m06.html', title='Account ownership, cryptography, privacy and other ecosystems',
    kicker='Module 6 · Who really owns the tag?',
    dek='Holding a tag, owning the account and holding the keys are three different things. This module pulls them apart, shows which key does which job, lays out who can see what, compares four tracker networks without ranking them, and ends where the technology runs out: the person being followed.',
    prereq='Module 5, especially Scenes 36–38 (the sealed sighting and the five-lane exchange).',
    scenes=[

dict(id=42, title='Three kinds of “mine”: holding it, owning the account, holding the keys',
 lede='“My tag” can mean three different things. Most surprises — good and bad — live in the gaps between them.',
 frames=['Possession: whoever holds the tag. That alone opens nothing.',
         'The linked account: the one account the tag is registered to. It decides who may ask for reports.',
         'The keys: whoever holds the private keys can open the sealed reports. They live on trusted devices.',
         'The overlaps: the rightful owner with a trusted device has all three; a finder holds the tag but reads nothing; the owner far away sees sightings; a newly signed-in device gets the keys only once it is trusted.'],
 A=(['Grandma’s keys have a little tag on them.', 'If a stranger picks up the keys, they hold the tag — but cannot see anything.', 'Grandma’s account is where the tag is listed.', 'Her phone has a secret key that opens the messages.', 'You need the right account and the secret key to see where the tag has been.'],
    'Holding a tag, owning its account and holding its secret key are three different things, and only the key opens the messages.'),
 B='''<p>Think of three circles. <strong>Possession</strong> is physical: whoever has the tag in their pocket. The <strong>account</strong> is administrative: the one Apple Account the tag is registered to (Scene 31), which decides who may ask the service for reports. The <strong>keys</strong> are cryptographic: whoever holds the private keys can open the sealed location reports (Scene 36).</p>
<p>For the rightful owner, on a trusted device, all three coincide. A finder holds the tag but can read nothing. An owner far away holds account and keys but not the tag — the normal “lost” case.</p>
<p><strong>Where the analogy breaks:</strong> the account and the keys are not as separable as two circles suggest. Apple syncs the Find My keys between the owner’s devices through end-to-end encrypted iCloud Keychain, which a new device joins only after it is trusted (for example by entering another device’s passcode). So “signed in” and “holds the keys” usually converge — but not instantly, and not for someone who knows only the password.</p>''',
 C='''<ul>
<li>Account linking is documented: one Apple Account per AirTag; removing it frees it for another account. <span class="tag doc">documented</span></li>
<li>Location reports are end-to-end encrypted to keys the owner’s devices hold; Apple says it cannot read them. <span class="tag doc">documented</span></li>
<li>Key material reaches a new device through end-to-end encrypted iCloud Keychain, which requires the device to be trusted. <span class="tag verify">verify</span></li>
<li>Exact conditions under which a new device receives Find My keys are not spelled out step by step. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>''',
 D='''<p>Model the three domains as separate trust decisions. Possession is a physical control (who can tamper with or remove the tag). The account is an authorisation control (who may ask for reports). The keys are a confidentiality control (who can read them). An attacker needs both the account and a device that holds the keys to read locations; a password alone is designed not to be enough when end-to-end keys sit behind device trust.</p>''',
 E='''<ul><li>When a company issues trackers, decide which <em>account</em> owns them — a personal account means the company holds possession but not authority.</li><li>Off-boarding must cover all three domains: return the tag, remove it from the account, and retire devices that hold keys.</li></ul>''',
 eng='<p>Venn regions are illustrative. The “new device” label is conceptual; Apple documents the keychain sync, not a step-by-step key hand-over.</p>',
 test=['Does the scene imply that signing in alone grants every secret? (No — trusted-device conditions are named.)', 'Does possession read anything? (No.)'],
 src=[FINDMY, FTT]),

dict(id=43, title='The journey of a secret: from birth to revocation',
 lede='Two families of keys travel through the system. Only one of them can read where a tag has been — and the service never holds it.',
 frames=['Generate: the owner’s device creates a key pair (d, P) and a secret seed SK₀.',
         'Provision: at setup the tag receives P and SK₀ — enough to derive public keys, never the private key d.',
         'Store and sync: d stays on the owner’s trusted devices; Apple says Find My key material syncs between them through end-to-end encrypted iCloud Keychain.',
         'Derive and rotate: tag and owner derive a new key pair about every 15 minutes; the tag broadcasts only the public half.',
         'Recover or revoke, and the second family: TLS certificates, device attestation, firmware signing and account authentication do other jobs and cannot open a location report.'],
 A=(['Grandma’s phone makes a secret key and a matching lock.', 'It gives the tag the lock, but keeps the key.', 'The phone and tag change to a new lock and key every little while.', 'Grandma’s other phone gets a copy of the key, safely.', 'The company that carries the messages never gets the key.'],
    'The key that opens the messages is made on the owner’s phone and stays with the owner, so the company can carry messages it cannot read.'),
 B='''<p>A key has a life: it is <strong>born</strong> on a trusted device, <strong>handed</strong> (in part) to the tag at setup, <strong>kept</strong> on the owner’s devices, <strong>changed</strong> regularly, and eventually <strong>recovered</strong> after a lost phone or <strong>retired</strong> when the tag is removed.</p>
<p>Meanwhile a second family of keys — the ones that secure connections, prove a device is genuine, sign software updates and check passwords — keeps the service running. None of them can open a location report. That split is what “end-to-end” means here.</p>
<p><strong>Where the analogy breaks:</strong> the tag does not receive a “lock” in the everyday sense; it receives material from which it can compute a fresh public key on schedule, without being able to compute the private key.</p>''',
 C='''<ul>
<li>Apple documents a key pair and a secret on the owner’s device, from which rotating public keys Pᵢ (tag) and private keys dᵢ (owner) are derived; the tag broadcasts the current Pᵢ. <span class="tag doc">documented</span></li>
<li>The broadcast key changes about every 15 minutes. <span class="tag doc">documented</span></li>
<li>Key material syncs among the owner’s devices through end-to-end encrypted iCloud Keychain. <span class="tag verify">verify</span></li>
<li>How keys are re-issued or erased on removal, sharing or reset. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>
<p class="eq">rotation: SKᵢ = KDF(SKᵢ₋₁) → (uᵢ, vᵢ); Pᵢ = uᵢ·P + vᵢ·G (tag); dᵢ = uᵢ·d + vᵢ (owner)</p>
<p>The formula is the published shape of the scheme (elliptic-curve scalar arithmetic); demo F below runs a toy version you can check by hand. <span class="tag concept">conceptual</span></p>''',
 D='''<p>The design property to verify is <strong>key separation</strong>: the service’s operational keys (TLS, attestation, account authentication) must never be able to derive or unwrap the owner’s report keys. Recovery is the weak joint: any path that restores report keys after all devices are lost is, by definition, a path an attacker with the same proofs could use.</p>''',
 E='''<ul><li>Ask vendors to state, in writing, which party holds which key family and what their recovery path requires.</li><li>Treat account-recovery settings (recovery contacts, recovery keys) as part of the tracker’s security, not a separate topic.</li></ul>''',
 eng='<p>The provisioning detail (that the tag receives P and SK₀) follows Apple’s Platform Security description; check the current edition. Service-key boxes are generic.</p>',
 test=['Are manufacturer/service keys shown as able to read reports? (No.)', 'Is the rotation period stated as Apple-documented, not invented? (Yes, about 15 minutes.)'],
 src=[FINDMY, 'Apple Platform Security, “iCloud Keychain security overview” (check the current edition).']),

dict(id=44, title='Open padlocks and private keys — and why a signature is not a lock',
 lede='Public-key cryptography does two different jobs. Mixing them up is the commonest mistake in explanations of trackers.',
 frames=['The analogy: hand out open padlocks (public keys); keep the only key (the private key). Anyone can snap a padlock shut; only the keyholder opens it.',
         'The precise version: a finder encrypts a location to the public key P; only the owner’s private key d decrypts it.',
         'In practice: a one-time key agreement (ECDH), a key-derivation function and authenticated encryption (AES-GCM) do the work. The public key never decrypts anything.',
         'A different job: a maker signs a firmware update with its private signing key; the device checks it with the maker’s public key. The update itself is not hidden.',
         'Not the same thing: encryption decides who can read; a signature proves who wrote. Different keys, different jobs.'],
 A=(['Grandma gives out open padlocks to anyone.', 'A helper can lock a note in a box with one.', 'Only Grandma has the key to open it.', 'A signature is different: it is like a seal that shows who made the note.', 'A seal does not hide the note — it only proves who wrote it.'],
    'Locks hide a message so only the keyholder can read it; signatures prove who wrote a message without hiding it.'),
 B='''<p>With public-key encryption, the owner can give the world a way to send them secrets without giving anyone a way to read them. In Find My, the tag broadcasts the public key; a passing phone uses it to seal its location; only the owner’s private key opens the seal.</p>
<p>A <strong>digital signature</strong> uses a key pair the other way round: the maker signs with a private key and anyone checks with the public key. It proves the update came from the maker and was not changed. It hides nothing.</p>
<p><strong>Where the analogy breaks:</strong> real systems do not literally lock the message with the public key. They use it to agree a fresh one-time key, then encrypt with fast symmetric cryptography — that is what demo F shows.</p>''',
 C='''<ul>
<li>Find My reports: an ephemeral key agreement with the broadcast public key (ECDH), a key-derivation function, then AES-GCM. <span class="tag doc">documented</span></li>
<li>Signatures (for example ECDSA) prove origin and integrity; they are verified with a public key and provide no confidentiality. <span class="tag spec">specification</span></li>
<li>Decrypting needs the private key; verifying needs only the public key. Different keys, different jobs. <span class="tag concept">conceptual</span></li>
</ul>
<p class="eq">encrypt: e ← random; E = e·G; K = KDF(e·Pᵢ); c = AES-GCM_K(location, time) → send (E, c)<br>decrypt: K = KDF(dᵢ·E); location = AES-GCM⁻¹_K(c)</p>''',
 D='''<p>Watch for designs that “sign for privacy” or “encrypt for authenticity”. A signed broadcast proves origin but leaks the payload; an encrypted report hides content but does not by itself prove which tag it came from. Find My’s known integrity limitation — anyone who hears a public key can encrypt a report to it — follows directly: confidentiality is not authenticity (Module 7, Scene 50).</p>''',
 E='''<ul><li>When a vendor says “encrypted”, ask: encrypted to whom, and signed by whom? The two answers protect different things.</li></ul>''',
 eng='<p>Keys and algorithms are simplified. Demo F uses deliberately tiny numbers so the arithmetic is visible; it is not secure and not Apple’s implementation.</p>',
 test=['Does the scene say the public key decrypts anything? (No.)', 'Is a signature described as hiding content? (No.)'],
 src=[FINDMY, 'NIST FIPS 186-5, Digital Signature Standard.', 'NIST SP 800-38D, AES-GCM.']),

dict(id=45, title='Three layers of protection, three different jobs',
 lede='“Encrypted” can mean the radio link, the internet hop or the report itself. In Find My they are three different things.',
 frames=['The path: the tag, a passer-by’s phone, Apple’s relay and the owner’s phone.',
         'The radio broadcast is not encrypted: the rotating key is public by design. Bluetooth link encryption applies only to connections, not broadcasts.',
         'TLS protects each internet hop in transit, and ends at Apple’s servers.',
         'End-to-end encryption wraps the report from the finder’s phone to the owner’s phone — through the relay and while stored there.',
         'Where data is readable: on the finder’s phone (its own location) and the owner’s phone after decrypting; at rest on the relay, only ciphertext, a lookup hash, upload time and connection metadata.'],
 A=(['The tag whispers out loud — anyone nearby can hear it.', 'The helper’s phone puts the note in a sealed envelope.', 'The envelope travels inside a locked truck to the post office.', 'The post office opens the truck but not the envelope.', 'Only Grandma’s phone opens the envelope.'],
    'Three different protections guard three different parts of the trip, and only the sealed envelope keeps the location secret all the way.'),
 B='''<p>There are three layers. The <strong>radio broadcast</strong> is deliberately public: the tag shouts a changing key so any passing phone can use it. <strong>TLS</strong> — the padlock in your browser — protects each internet connection, but it ends at the server it connects to. <strong>End-to-end encryption</strong> protects the report itself, from the finder’s phone all the way to the owner’s phone, even while it waits on Apple’s servers.</p>
<p><strong>Where the analogy breaks:</strong> “the post office opens the truck” makes TLS sound weak. It is not; it simply protects a different stretch. The point is that only the end-to-end layer survives the server.</p>''',
 C='''<ul>
<li>BLE advertising carries no link-layer encryption; LE link encryption applies to established connections. <span class="tag spec">specification</span></li>
<li>Finder → Apple and Apple → owner use TLS; the report payload is end-to-end encrypted to the owner’s keys. <span class="tag doc">documented</span></li>
<li>At rest, the relay stores encrypted reports under a lookup hash; Apple says it cannot read them. <span class="tag doc">documented</span></li>
<li>Upload time and connection metadata exist at the service and network layers. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Draw the boundary where each layer terminates. TLS terminates at Apple, so anything not separately end-to-end encrypted (lookup hashes, timing, account identity on download) is visible to the operator. The public broadcast is an intentional exposure; its privacy rests on rotation (Scene 28), not on encryption.</p>''',
 E='''<ul><li>In vendor assessments, ask for a layer-by-layer answer: what is protected on the radio, in transit, at rest and on device — and which party terminates each layer.</li></ul>''',
 eng='<p>The thick box around Apple’s relay is a trust boundary, drawn without its legend entry so the legend row fits. Bands are schematic, not to scale.</p>',
 test=['Is the Bluetooth broadcast described as encrypted? (No.)', 'Does TLS appear to continue through the server? (No — it ends there.)', 'Is the relay shown holding the location? (No.)'],
 src=[FINDMY, 'Bluetooth Core Specification, Vol 6 Part B (link layer), Vol 3 Part H (security).']),

dict(id=46, title='Who can see what: one table, eight observers',
 lede='A table is the honest way to state privacy claims: every observer, every kind of information, and no blank cells.',
 frames=['The tag knows only its own identifier. The passer-by’s phone hears it, knows its own location and itself, makes the sealed report and its own uploads. A nearby radio listener hears only the identifier.',
         'The relay operator sees a lookup hash (not the identifier), stores the sealed report and has service metadata — never the location. An internet provider sees only that connections happened.',
         'The owner derives the identifiers, decrypts the location and knows their own account. A person the owner shares with can view the location; how their device gets access is not publicly documented.',
         'An outside attacker without the account or keys sees only what any radio listener sees — unless they take over the owner’s account, when they see what the owner sees.'],
 A=(['Many people are near the tag’s message.', 'The tag and anyone close can hear its whisper.', 'The post office keeps the sealed envelope but cannot read it.', 'Only Grandma, and anyone she shares with, sees where the tag is.', 'A stranger cannot read it — unless they steal Grandma’s account.'],
    'Lots of people can see that a message exists, but only the owner — and people the owner chooses — can see where the tag is.'),
 B='''<p>The table states, observer by observer, what each can learn under Apple’s documented design. Most cells are “no”. The “metadata only” cells matter: the operator knows that reports exist, when they were uploaded and which account asks for them, even though it cannot read the locations.</p>
<p><strong>Where the analogy breaks:</strong> a table makes every cell look equally certain. Some are documented by Apple, some follow from how networks work, and two (how a shared user’s device gets access) are simply not public.</p>''',
 C='''<ul>
<li>Relay: sealed report and lookup hash; cannot read locations; says reports do not identify the finder. <span class="tag doc">documented</span></li>
<li>Internet provider and operator connection metadata. <span class="tag concept">conceptual</span></li>
<li>Item Sharing lets up to five people view an item’s location. <span class="tag doc">documented</span></li>
<li>How a shared user’s device obtains what it needs to see the location. <span class="tag undisclosed">not publicly disclosed</span></li>
<li>The table agrees with Module 5, demo D (<code>demos/lost.json</code>). <span class="tag concept">consistency check</span></li>
</ul>''',
 D='''<p>The asterisked attacker row is the real threat model: confidentiality holds against everyone without the account, so the account becomes the target (Scene 48). Also note the “nearby radio listener” row: hearing a rotating identifier is harmless alone, but repeated co-location is exactly what unwanted-tracking detection relies on (Module 7, Scene 51).</p>''',
 E='''<ul><li>Use this table format for any location product you approve: one row per observer, one column per data type, a label per cell, and no blanks.</li></ul>''',
 eng='<p>“Approx. location” for the passer-by’s phone is its own location; for the owner, the decrypted report. Other ecosystems differ; see Scene 47 and Every Arrow.</p>',
 test=['Does the operator ever see the location? (No.)', 'Are undocumented cells marked as such? (Yes, “undisclosed”.)', 'Does the table match Module 5 demo D? (Yes.)'],
 src=[FINDMY, 'Apple Support, “Share an AirTag or other Find My item” (check current wording).', 'Module 5, <a href="/invisible-engine/m05.html#demo-d">demo D</a>.']),

dict(id=47, title='Four networks, similar goals, different designs',
 lede='Apple, Google, Samsung and Tile all run crowd-sourced finding networks. Their published detail differs far more than their goals.',
 frames=['The four networks and who relays sightings: nearby Apple devices; Android devices (by default only in busy areas, as an aggregated location); Galaxy devices; phones running the Tile or Life360 app (verify).',
         'Encryption and account linking, as each company documents them; Tile is not compared on encryption here.',
         'Precise finding, and alerts for the person a tag travels with: iPhone and Android share a specification; Samsung’s alert is a setting; Tile offers a manual scan (verify).',
         'What each publishes about its design, and a reminder: no ranking, and nothing implies the networks share data or algorithms.'],
 A=(['Four companies make little tags.', 'Each has its own helpers: phones that carry messages.', 'Each says it seals the messages, in its own way.', 'Some phones can warn you about a tag that is not yours.', 'They tell us different amounts about how it works.'],
    'Four companies built the same kind of helper network in different ways, and they explain their designs in very different detail.'),
 B='''<p>All four networks let lost things be found through other people’s phones without telling the finder anything. Apple and Google document end-to-end encryption; Samsung says its data is encrypted and protected by Knox, with a private ID that changes every 15 minutes. Google’s default is cautious: it waits until several Android devices have seen an item and shows an aggregated location, intended for busy places.</p>
<p>Alerts for the person a tag travels with differ: Apple and Google wrote one shared specification so iPhones and Android phones alert about each other’s trackers; Samsung’s unknown-tag alert is a setting in the SmartThings app; Tile offers a manual scan.</p>
<p><strong>Where the analogy breaks:</strong> a table with equal columns suggests equal evidence. Apple’s and Google’s designs are described in security documents; Samsung’s in newsroom posts; Tile’s claims here were not confirmed from Tile’s own pages for this lesson.</p>''',
 C='''<ul>
<li>Apple: end-to-end encrypted reports; broadcast key changes about every 15 minutes. <span class="tag doc">documented</span></li>
<li>Google Find Hub: end-to-end encryption with a key unlocked by the phone’s screen lock; default aggregated locations in busy areas. <span class="tag doc">documented</span></li>
<li>Samsung SmartThings Find: encrypted, Knox-protected; private ID changes every 15 minutes; one account or device at a time. <span class="tag doc">documented</span></li>
<li>Tile/Life360: network of app users; Scan and Secure; Anti-Theft Mode with identity verification. <span class="tag verify">verify</span></li>
<li>Cross-platform alerts: Apple and Google’s Detecting Unwanted Location Trackers specification, iOS 17.5+ and Android 6.0+. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>Do not assume algorithmic equivalence: “encrypted” in a newsroom post is not a protocol description. For each network ask who holds the decryption keys, what the operator retains, how identifiers rotate and how a carried-but-not-owned tag is detected on <em>other</em> platforms.</p>''',
 E='''<ul><li>If staff use trackers from several ecosystems, your detection story depends on the weakest alerting path among them.</li><li>Prefer vendors that publish security design documents you can cite.</li></ul>''',
 eng='<p>No scores or rankings, by rule. Cells marked “verify” were not confirmed from the company’s own pages. The same three large ecosystems are compared claim by claim in Every Arrow.</p>',
 test=['Is any network ranked or called better? (No.)', 'Does the scene imply shared data or algorithms between networks? (No.)', 'Are Tile claims marked verify? (Yes.)'],
 src=[FINDMY, G_BLOG, G_DATA, G_UNK, S_EVOLVE, S_300, S_TAG2, DULT24, EA]),

dict(id=48, title='Where the account is the weak point',
 lede='End-to-end encryption moves the target. Nobody needs to break the cryptography if they can stand where the owner stands.',
 frames=['One account with its trusted devices and shares.',
         'A shared or reused password (needs: the password and a way past two-factor authentication) and a forgotten trusted device still signed in (needs: physical access to it). Both expose the owner’s view.',
         'Coercive access by someone with power over the owner, and a share nobody remembers.',
         'Account takeover and recovery abuse: both need control of credentials or recovery paths, and both expose everything the owner sees.',
         'Shared household permissions — several people can see one item by design — and the defences: review devices and sharing (for example Apple’s Safety Check), a unique password with two-factor authentication, and a recovery method you control.'],
 A=(['Grandma’s secret is safe in her phone.', 'But if someone knows her password, they might get in.', 'An old phone left signed in could show the tag too.', 'Sometimes a person makes someone else show their phone.', 'Checking who can see things keeps Grandma safe.'],
    'The locks are strong, so the easiest way in is through the account, which is why checking who has access matters.'),
 B='''<p>Once reports are end-to-end encrypted, the practical risks move to the <strong>account</strong>: who knows the password, which old devices are still trusted, who has been shared an item and forgotten, and who controls account recovery. Some risks are not technical at all — someone with power over the owner can simply demand to see the phone.</p>
<p><strong>Where the analogy breaks:</strong> “weak point” sounds like a flaw. These are the expected places where human relationships meet a security design; the defences are reviews and hygiene, not new cryptography.</p>''',
 C='''<ul>
<li>Each risk lists its prerequisite; none is a step-by-step method. <span class="tag concept">defensive summary</span></li>
<li>Apple’s Safety Check (iOS 16 and later) helps review and reset sharing and access, including an emergency reset. <span class="tag verify">verify current features</span></li>
<li>Two-factor authentication is required for AirTag setup. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>Threat-model the account, not the ciphertext. Map each prerequisite to a control: credential theft → unique password and phishing-resistant 2FA; stale devices and shares → periodic review; coercion → safety-oriented features and support services; recovery abuse → recovery contacts and keys under the owner’s sole control.</p>''',
 E='''<ul><li>Include tracker and location-sharing reviews in executive-protection and employee-safety guidance.</li><li>For managed devices, remove personal Find My accounts from corporate phones on off-boarding.</li></ul>''',
 eng='<p>Defensive framing only: prerequisites and exposure, no methods. The household card is drawn without a hazard outline because shared access is by design.</p>',
 test=['Does any card describe how to perform an attack? (No.)', 'Are defences included? (Yes.)'],
 src=['Apple Support, “How Safety Check on iPhone works to keep you safe” (check current page).', PSG, FTT]),

dict(id=49, title='Same tag, two stories: a lost bag, or a person being followed',
 lede='The same network that finds a lost bag can locate the person carrying someone else’s tag. Nothing in the encryption can tell the difference.',
 frames=['A lost bag: the owner sees their own bag on a map. This is what the network is for.',
         'A tag hidden in another person’s bag: the person carrying it is located and was never asked; the owner’s map now shows a person.',
         'Encryption cannot tell the stories apart: it keeps the relay and strangers out, and protects an abusive owner’s view exactly as well as a rightful owner’s.',
         'Protective alerts: a phone can warn the person a separated tag travels with — iPhone and Android, through one shared specification — and a separated tag plays a sound when moved. Alerts take time, need separation from the owner and a compatible phone.',
         'Safety first: disabling a tracker can alert the person who placed it and stops their updates. Think about safety, and consider contacting police or a support service before acting.'],
 A=(['A lost bag can be found with a tag. That is good.', 'But a tag could be hidden in someone’s bag on purpose.', 'Then the wrong person is being followed.', 'Phones can warn you if a strange tag travels with you.', 'If you find one, tell a grown-up you trust before doing anything.'],
    'The same tag that finds lost things can follow a person, so phones warn people — and safety comes before switching anything off.'),
 B='''<p>A tracker network cannot know whether the thing it locates is a bag or a person. When a tag is slipped into someone else’s belongings, the person being located is not the owner, has no account and installed nothing. Encryption does not help: it protects whoever owns the tag, including someone misusing it.</p>
<p>That is why the platforms added <strong>alerts for the person a tag travels with</strong>: iPhones and Android phones can warn about an unknown tracker separated from its owner and seen moving with them, and a separated AirTag plays a sound when moved. These alerts are protections with limits — they take time, require the tag to be away from its owner and need a compatible phone. Module 7 covers them in depth.</p>
<p><strong>Safety first:</strong> disabling a tracker can alert the person who placed it, and stops their location updates. Apple’s guide asks you to consider your safety before doing so. Consider contacting the police or a support service first.</p>''',
 C='''<ul>
<li>Unwanted-tracking alerts on iPhone; a separated AirTag plays a sound when moved. <span class="tag doc">documented</span></li>
<li>Alerts depend on separation from the owner and observation over time. <span class="tag doc">documented limit</span></li>
<li>Apple and Google’s shared specification: alerts on iOS 17.5+ and Android 6.0+ for participating trackers; standards work continues in the IETF DULT working group. <span class="tag doc">documented</span></li>
<li>Google’s Find Hub acceptable use policy forbids tracking people without their knowledge and consent. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>This is a consent problem, not a confidentiality problem. Controls must operate on the <em>carrier’s</em> side (detection, alerts, sound) and on the <em>operator’s</em> side (policy, account association for law-enforcement requests), because the cryptography protects the owner by design.</p>''',
 E='''<ul><li>Publish a tracker-safety note for staff: what alerts look like, why not to disable a found tracker without a safety plan, and who to contact.</li><li>Do not make confrontation a step in any procedure.</li></ul>''',
 eng='<p>No placement, concealment or alert-avoidance detail appears, by rule. The hidden tag is shown only as a hazard outline.</p>',
 test=['Does the scene give any way to avoid detection? (No.)', 'Is the safety note present: disabling can alert the person who placed it? (Yes.)', 'Is encryption presented as solving misuse? (No.)'],
 src=[UNWANTED, PSG, DULT24, IETF, G_UNK, G_AUP, AIRTAG_UPD, FTT]),
])

INSERTS = {44: DEMO_F}
SCRIPTS = ['/invisible-engine/demos/keys.js']
