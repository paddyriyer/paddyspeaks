from .inserts import DEMO_K

# Sources used across the module (the same documents Every Arrow's item-tracker comparison cites).
AP_SEC = 'Apple Platform Security, “Find My security” — <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">support.apple.com</a>.'
AP_UNWANTED = 'Apple Support, “What to do if you get an alert that an AirTag, set of AirPods, Find My network accessory, or compatible Bluetooth location-tracking device is with you” — <a href="https://support.apple.com/en-us/119874">support.apple.com/en-us/119874</a>.'
AP_PS = 'Apple Personal Safety User Guide, “Detect unwanted trackers” — <a href="https://support.apple.com/guide/personal-safety/detect-unwanted-trackers-ips139b15fd9/web">support.apple.com</a>.'
AP_PS_GUIDE = 'Apple Personal Safety User Guide (includes Safety Check) — <a href="https://support.apple.com/guide/personal-safety/welcome/web">support.apple.com/guide/personal-safety</a> (check the current edition).'
AP_DULT = 'Apple Newsroom, “Apple and Google deliver support for unwanted tracking alerts in iOS and Android”, May 2024 — <a href="https://www.apple.com/newsroom/2024/05/apple-and-google-deliver-support-for-unwanted-tracking-alerts-in-ios-and-android/">apple.com/newsroom</a>.'
AP_UPDATE = 'Apple Newsroom, “An update on AirTag and unwanted tracking”, February 2022 — <a href="https://www.apple.com/newsroom/2022/02/an-update-on-airtag-and-unwanted-tracking/">apple.com/newsroom</a>.'
IETF = 'IETF, “Detecting Unwanted Location Trackers (dult)” working group — <a href="https://datatracker.ietf.org/wg/dult/about/">datatracker.ietf.org/wg/dult</a> (check document status).'
G_UNKNOWN = 'Android Help, “Find unknown trackers” — <a href="https://support.google.com/android/answer/13658562?hl=en">support.google.com</a>.'
AP_PRIV = 'Apple Legal, “Find My &amp; Privacy” — <a href="https://www.apple.com/legal/privacy/data/en/find-my/">apple.com/legal/privacy</a>.'
G_AUP = 'Google Help, “Find Hub acceptable use policy” — <a href="https://support.google.com/product-documentation/answer/14799569?hl=en">support.google.com</a>.'
FTT = '<a href="/articles/from-tap-to-trace.html">From Tap to Trace</a>'
EA = '<a href="/articles/every-arrow-is-a-decision.html">Every Arrow Is a Decision</a>, “Item trackers” (Apple, Google and Samsung, each from its own documentation)'

M = dict(
    num=7, file='m07.html', title='Privacy, threat modelling and survivor safety',
    kicker='Module 7 · When the person located is not the owner',
    dek='Strong encryption keeps a location secret from strangers. It cannot ask the person carrying a tag whether they agreed. This module separates the questions, shows where alerts help and where they stop, and ends every path for a person at risk at help, not at a setting.',
    prereq='Module 5 (how a sighting reaches its owner) and Module 6 (keys, accounts and who can see what). If you are reading this because you think you are being tracked, start with Scene 53 and the essay’s safety section: <a href="/articles/from-tap-to-trace.html#p11-alert">From Tap to Trace, Part XI</a>.',
    scenes=[

dict(id=50, title='Where the system can fail people',
 lede='A finding network has more than one way to go wrong, and only some of them are about secrecy. This scene names them in four groups and then separates four questions people often blur into one.',
 frames=['The whole system: a tag in a bag whispers; a passer-by’s phone seals a report; a relay stores it; only the owner’s devices can open it.',
         'Around the tag and the radio: anyone can listen; sightings can be correlated across time and place; a tag can be hidden in someone’s things; firmware or the supply chain can be tampered with.',
         'Around the reports and the service: invented sightings, altered or replayed reports, the relay itself as a target, and metadata about when and how often.',
         'Around accounts and people: an account takeover makes every report readable; access can be shared or coerced; shares go stale; and the person carrying the tag may never have chosen it.',
         'Four separate questions: confidentiality, integrity, authenticity — and consent, which no cipher answers.'],
 A=(['A tag helps people find lost things.', 'It whispers, and a stranger’s phone passes a sealed note on.', 'Only the owner can open the note.', 'But someone could hide a tag in another person’s bag.', 'A secret note can still be unfair if nobody asked.'],
    'Keeping a message secret is not the same as asking people if they agree.'),
 B='''<p>Engineers sort what can go wrong by what it attacks. <strong>Confidentiality</strong> asks who can read a report. <strong>Integrity</strong> asks whether it was changed. <strong>Authenticity</strong> asks whether it really came from a tag and a genuine finder. Encryption mostly answers the first. The fourth question is different in kind: <strong>consent</strong> — did the person being located agree?</p>
<p><strong>Where the analogy breaks:</strong> “threats” sounds like outside hackers. Several of the most serious ones here come from inside the system’s normal use: an owner who reads exactly what the design allows, about a person who never agreed to carry the tag.</p>''',
 C='''<ul>
<li>Find My reports are end-to-end encrypted: Apple says only the owner can see the location, and neither Apple nor the relaying devices learn it. <span class="tag doc">documented</span></li>
<li>The broadcast key changes about every 15 minutes, which limits passive following of one fixed signal. <span class="tag doc">documented</span></li>
<li>Spoofed or replayed reports and correlation by radio fingerprint or movement are threat classes studied in independent research on crowd-sourced finding networks. <span class="tag research">research</span> This lesson names them and does not describe how to carry them out.</li>
<li>Metadata (lookup values, upload times, account queries) remains visible to the service even when content is sealed (Module 5, Scene 36). <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Draw the trust boundaries first, then place threats on them: the radio is public; the relay is trusted for availability and metadata but not for content; the owner’s account is trusted for everything. That makes <strong>account compromise</strong> and <strong>authorised misuse</strong> the threats with the widest blast radius — both pass every cryptographic check. Consent must be handled by product controls (alerts, sound, sharing reviews), not by the cipher.</p>''',
 E='''<ul><li>Keep four separate rows in the risk register: confidentiality, integrity, authenticity and consent. A vendor answer to the first three is not an answer to the fourth.</li>
<li>For company-owned trackers, the realistic top risks are account takeover and misuse by someone with legitimate access, not radio interception.</li></ul>''',
 eng='<p>The diagram names threat classes without mechanisms. Hazard zones are red dashed boxes; the arrows keep their lesson colours (blue radio, purple encrypted).</p>',
 test=['Does any threat include steps to carry it out? (No: names and categories only.)', 'Is consent shown as something encryption does not answer? (Yes, frame 5.)', 'Is the 15-minute rotation attributed to Apple’s own documentation? (Yes.)'],
 src=[AP_SEC, EA + '.', FTT + ', Part VI “The privacy paradox: a threat catalogue” (<a href="/articles/from-tap-to-trace.html#p6">#p6</a>).']),

dict(id=51, title='Two good goals that pull against each other',
 lede='Rotating identifiers protect an owner from strangers following their tag. Unwanted-tracker alerts protect the person carrying a tag by noticing that the same tag keeps showing up. Those goals pull against each other, and designers tune the balance.',
 frames=['Owner privacy: a passer-by sees unrelated values at the café, the station and the office; only the owner’s key links them.',
         'The person carrying it: a tag that travels with someone from home to the bus to the office should be noticed — which means recognising the same tag again.',
         'The two goals sit on a balance: unlinkable on one side, detectable on the other. They are in tension, tuned rather than traded away.',
         'Four illustrative design dials: how often the identifier rotates; how the tag behaves when separated from its owner; whether it plays a sound when moved; how long it must travel with someone before an alert.',
         'A tension, not an impossibility: each dial moves protection between the goals, and designs give up some unlinkability mainly while a tag is away from its owner.'],
 A=(['A tag changes its secret name often.', 'That stops strangers following it.', 'But if a tag sneaks into your bag, your phone needs to notice it.', 'Noticing means spotting the same tag again and again.', 'So the tag has to be a little easier to spot when it is away from home.'],
    'Hiding a tag from strangers and spotting a sneaky tag pull in opposite directions, so designers balance them carefully.'),
 B='''<p>If a tag kept one fixed name, anyone with a phone could follow its owner around. So tags change their name. But a person who unknowingly carries someone else’s tag needs their phone to say: <em>this same tag has been with you for a while</em>. The answer most designs use is to treat a tag differently when it is <strong>separated from its owner</strong>: that is when being noticeable matters most.</p>
<p><strong>Where the analogy breaks:</strong> a balance suggests one setting fixes everything. In practice there are several dials, and each also affects false alarms, battery life and how quickly a real problem is spotted.</p>''',
 C='''<ul>
<li>Rotating identifiers limit passive linking (Apple: the broadcast key changes about every 15 minutes). <span class="tag doc">documented</span></li>
<li>Alerts depend on the tracker being separated from its owner and seen with you over time. <span class="tag doc">documented</span></li>
<li>A separated AirTag also plays a sound when it is moved. <span class="tag doc">documented</span> Exact timing is not stated here. <span class="tag verify">check Apple’s current page</span></li>
<li>The four dials are an illustrative way to describe the design space, not a published parameter list. <span class="tag illus">illustrative</span></li>
</ul>''',
 D='''<p>State the protection goals explicitly and test both: (1) an observer who sees the tag at different places cannot link the sightings while the tag is near its owner; (2) a person carrying a separated tag is told within a bounded, tested time. The second goal is where the user’s safety lives, so measure it on real routes and phones rather than assuming it.</p>''',
 E='''<ul><li>When choosing trackers for staff or assets, ask the vendor how its product behaves when separated, how it is detected on other platforms, and how that has been tested.</li>
<li>Never treat “privacy” as only the owner’s privacy: the person carrying a tag is a data subject too.</li></ul>''',
 eng='<p>The identifier values are invented. The balance and dials are teaching devices, not a model of any product.</p>',
 test=['Is the tension ever called impossible? (No: frame 5 says it is a tension, not an impossibility.)', 'Are the dials labelled illustrative? (Yes.)', 'Does it state a sound-timing number without a source? (No.)'],
 src=[AP_SEC, AP_UNWANTED, AP_PS, FTT + ', Part VI (<a href="/articles/from-tap-to-trace.html#p6">#p6</a>).']),

dict(id=52, title='Alerts across iPhone and Android',
 lede='For years, detection depended on which phone you carried. In May 2024 Apple and Google shipped alerts built on one industry specification. The standard behind it is still being written, and alerts have limits.',
 frames=['Trackers from makers that adopt one specification can be detected by an iPhone on iOS 17.5 or later and an Android phone on Android 6.0 or later.',
         'Deployed: built into both platforms since May 2024, for trackers whose makers adopt the specification.',
         'Standards track: an IETF working group (DULT) is turning the work into standards. Drafts change; check their status. A draft is not a promise.',
         'When an alert may not come: a tag often near its owner, a short trip, Bluetooth or location off or old software, a tracker that does not follow the specification, or a manual scan that sees only what is near now.',
         'No timing guarantee: an alert is a prompt to check; no alert is not proof of safety.'],
 A=(['Some phones are iPhones and some are Android phones.', 'Now both kinds can warn you about a tag that is not yours.', 'The warning says a tag seems to be travelling with you.', 'Sometimes a phone may not notice.', 'If you are worried, tell a grown-up you trust.'],
    'Both kinds of phone can now warn about a strange tag, but a warning can be late or missing, so worries should go to a trusted grown-up.'),
 B='''<p>Apple and Google wrote one industry specification, <em>Detecting Unwanted Location Trackers</em>. Since May 2024, iPhones (iOS 17.5 and later) and Android phones (Android 6.0 and later) can alert about trackers from either network and from makers who adopt it. Android can also <strong>scan</strong> for trackers nearby.</p>
<p><strong>Where the analogy breaks:</strong> an alert is not a smoke alarm with a tested response time. It depends on the tag being separated from its owner, on enough time together, on settings and software, and on the tag following the specification.</p>''',
 C='''<ul>
<li>Cross-platform alerts: iOS 17.5+ and Android 6.0+, announced May 2024. <span class="tag doc">documented</span></li>
<li>IETF DULT working group: drafts for accessory behaviour and detection. <span class="tag spec">standards work</span> <span class="tag verify">check current document status</span></li>
<li>Google: a manual scan shows a tracker near you now, which may not have travelled with you; only trackers separated from their owners appear. <span class="tag doc">documented</span></li>
<li>No platform publishes a guaranteed time-to-alert. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Model detection as a probabilistic control with false negatives you can name: not-separated state, short co-travel, radio or OS conditions, non-compliant hardware. Treat the specification as raising the floor across platforms, not as closing the risk. Compensating controls belong in the human process (Scene 53), not in more scanning.</p>''',
 E='''<ul><li>Do not let device baselines turn off Bluetooth or the alerts on managed phones without weighing staff safety.</li>
<li>Ask tracker suppliers whether their products implement the cross-platform specification and how they were tested.</li></ul>''',
 eng='<p>Phone screens are generic drawings, not captures of either platform’s interface.</p>',
 test=['Is DULT presented as a finished guarantee? (No: drafts, check status.)', 'Are version numbers tied to their source and date? (Yes: May 2024.)', 'Does it say a manual scan proves a tag followed you? (No: near now, not what followed.)'],
 src=[AP_DULT, IETF, G_UNKNOWN, AP_UNWANTED, EA + '.']),

dict(id=53, title='Three people, three safe paths',
 lede='What to do depends on who you are and what you are facing. These three short paths are about safety and getting help. None of them asks anyone to confront, search or bypass anything.',
 frames=['The traveller: an alert on a trip; check you are safe; look for an innocent explanation such as a companion’s tag; if not explained, record the alert, use its own tools, and get help before disabling.',
         'A family member at risk: worried someone knows where they go; tell a trusted person (for a child, a grown-up they trust); make a plan with an advocate or support service; decide together.',
         'An employee or executive: an alert at work or travelling; tell security or HR as well as someone you trust; the company can help; its playbook puts safety first and never has anyone search colleagues’ things.',
         'Consider your safety first: disabling a tracker can alert the person who placed it. Help: a person you trust, local support services, law enforcement, the platform’s safety guide.'],
 A=(['If your phone says a strange tag is with you, stay calm.', 'Go somewhere you feel safe.', 'Tell a grown-up you trust.', 'Do not try to sort it out alone.', 'Grown-ups can get help from people whose job is to keep you safe.'],
    'A strange-tag warning is a reason to get a trusted grown-up, who can find the right help.'),
 B='''<p>Every path here ends with <strong>other people</strong>, because the safest next step depends on things a phone cannot know. A tag in a shared family car is probably innocent; a tag after a relationship has ended may not be. If placement might be deliberate, the timing of what you do matters.</p>
<p><strong>Where the analogy breaks:</strong> a decision tree looks complete. Real situations are not; these paths are a starting point for a conversation with someone who can help, not a substitute for it.</p>''',
 C='''<ul>
<li>Use the alert’s own tools: play a sound, and on supported phones find it more precisely; on Android, the alert and Scan now can help. <span class="tag doc">documented</span></li>
<li>Apple’s guide says to consider your safety before disabling a tracker, because the owner then stops getting its location. <span class="tag doc">documented</span></li>
<li>Google’s Find Hub acceptable use policy forbids tracking people without their knowledge and consent. <span class="tag doc">documented</span></li>
</ul>''',
 D='''<p>For enterprise programmes, design the human process, not just the tooling: a named contact in security or HR, safe options for workplace, travel and parking, legal advice before law enforcement where policy requires it, and a rule that nobody searches colleagues’ belongings on someone’s behalf.</p>''',
 E='''<ul><li>Publish one internal page: “If you get an unknown-tracker alert”. Put safety and support first and the security team’s contact second.</li>
<li>Train managers not to investigate or confront; their job is to connect the person to help.</li></ul>''',
 eng='<p>The three people are illustrative and generic. Support options are named by kind because services differ by country; the essay lists a US hotline as an example.</p>',
 test=['Does any path suggest confronting someone or searching their things? (No.)', 'Does every path end at help, and is the warning about disabling present? (Yes, frame 4.)', 'Is level A gentle and protective? (Yes: tell a grown-up you trust.)'],
 src=[AP_PS, AP_UNWANTED, G_UNKNOWN, G_AUP, FTT + ', Part XI “Protecting real people” (<a href="/articles/from-tap-to-trace.html#p11">#p11</a>).']),

dict(id=54, title='What can be kept, and what it can and cannot show',
 lede='If it is safe to do so, a few things are worth keeping. They help an advocate, an employer or the police act. They rarely prove who placed a tag.',
 frames=['The alert: screenshot it and any map it shows; note the date and time.',
         'The tag’s identity: if you find it, tapping it with an NFC phone shows its serial number.',
         'Your own notes: where and when it appeared, and who has had access to your bag, car or coat.',
         'Your accounts, when it is safe: who sees your location or items, and your trusted devices — for example with Safety Check on iPhone.',
         'Vendor and police: police can ask the vendor for the account a tag is paired to. And the limits: a sighting is approximate, an alert can be wrong either way, and a serial number points to an account, not to a person.'],
 A=(['If something worries you, a grown-up can help keep notes.', 'They can take a picture of the phone’s warning.', 'They can write down when and where it happened.', 'Then they can ask people whose job is to help.'],
    'Writing down what happened helps the people whose job is to help you.'),
 B='''<p>Evidence here is mostly <strong>records you already have</strong>: the alert, the times and places, the tag’s serial number. The vendor holds the link from a tag to an account and can provide it to police through a valid request. Collect only what you can collect safely; do not put yourself at risk to get more.</p>
<p><strong>Where the analogy breaks:</strong> this is not a crime-scene kit. The records point to an <em>account</em>, and the place in a sighting is where a stranger’s phone was. Who placed a tag, and why, is a question for people with legal authority.</p>''',
 C='''<ul>
<li>Tapping a found AirTag with an NFC-capable phone opens a web page with its serial number; for an AirTag found moving with you, Apple shows part of the owner’s phone number. <span class="tag doc">documented</span> <span class="tag verify">check Apple’s current page</span></li>
<li>Apple says it can provide paired-account details in response to a valid request from law enforcement. <span class="tag doc">documented</span></li>
<li>Safety Check on iPhone reviews and stops sharing in one place. <span class="tag doc">documented</span> <span class="tag verify">check current version</span></li>
<li>Apple’s Find My privacy notice says a located device’s location is kept for up to 24 hours to provide the service. <span class="tag doc">documented</span> Retention elsewhere differs; ask early, through proper channels.</li>
</ul>''',
 D='''<p>Preservation is time-sensitive and person-centred: the person’s own screenshots and notes are durable; service-side data has retention limits and needs legal process. Advise a preservation request through counsel or police rather than self-help. Never route evidence-gathering through the person’s own account in a way that could alert the other party.</p>''',
 E='''<ul><li>Agree in advance with legal how the company supports an employee’s report: what you preserve, who requests vendor records, and what you never do (search, surveil, confront).</li>
<li>Record decisions and timestamps; they matter more than device forensics in most cases.</li></ul>''',
 eng='<p>The timeline cards follow published safety guidance; the evidence-limits panel is ours. No legal conclusions are drawn.</p>',
 test=['Does it suggest collecting evidence at personal risk? (No: only what is safe.)', 'Does it claim a serial number identifies the person who placed a tag? (No: an account, not a person.)', 'Is the safety banner always visible? (Yes, on every frame.)'],
 src=[AP_UPDATE, AP_UNWANTED, AP_PS_GUIDE, AP_PRIV, FTT + ', Part XI (<a href="/articles/from-tap-to-trace.html#p11-alert">“You received an unknown-tracker alert”</a>).']),

dict(id=55, title='Proportionate protection: who can do what',
 lede='Most protections have an owner: a person, a household, an employer, a vendor or a standards body. Putting each control in the right column avoids two failures — nobody doing it, or someone doing too much.',
 frames=['Consent before sharing a location, and regular reviews of who sees your location or items: mainly the person and their household, with vendor tools such as Safety Check.',
         'Hardening accounts — two-factor, trusted devices, recovery contacts: the person and, for work accounts, the employer.',
         'Anti-abuse controls in the product — alerts, a sound when moved, serial and NFC information, one account per tag: the vendor, supported by standards.',
         'Minimising metadata, and standards with responsible disclosure: vendors and standards bodies, with researchers reporting flaws privately first.',
         'Proportionate: the smallest control that addresses the risk, chosen with the person it protects.'],
 A=(['Keeping people safe is a team job.', 'You can ask before sharing where you are.', 'Families can check who sees what.', 'Companies that make tags build in warnings.', 'Everyone does their part.'],
    'Each person and company has its own job in keeping people safe, and nobody should spy on the people they protect.'),
 B='''<p>A good protection is <strong>proportionate</strong>: it fits the risk and respects the person it protects. Reviewing who can see your location once a year is proportionate. Secretly tracking a family member “for their safety” is not — it creates the very harm this module is about.</p>
<p><strong>Where the analogy breaks:</strong> a table makes responsibility look tidy. In a household or a workplace the columns overlap, and the person at risk should always be part of the decision.</p>''',
 C='''<ul>
<li>Safety Check (iPhone) reviews and resets sharing and access. <span class="tag doc">documented</span> <span class="tag verify">check current version</span></li>
<li>Anti-abuse controls: unwanted-tracking alerts, a sound when a separated tag moves, serial number and NFC information, one account per tag. <span class="tag doc">documented</span></li>
<li>Cross-platform alerts via a shared specification; IETF DULT drafts. <span class="tag doc">documented</span> <span class="tag verify">check status</span></li>
<li>The who-columns are an illustrative allocation. <span class="tag illus">illustrative</span></li>
</ul>''',
 D='''<p>Map each control to an owner and an evidence source: who implements it, and how you would know it is working. Controls without an owner decay; controls owned by the wrong party (an employer “protecting” staff by tracking them) become the threat.</p>''',
 E='''<ul><li>Write a short tracker policy: company devices on company accounts; no tracking of people; alerts left on; a named route for reports.</li>
<li>Review it with HR and legal once a year, and after any incident.</li></ul>''',
 eng='<p>Filled dot: implements. Ring: supports. Dash: not usually that party’s job. The allocation is ours, for teaching.</p>',
 test=['Does any control involve watching the person being protected? (No; the scene warns against it.)', 'Is each control given an owner? (Yes.)', 'Are standards described as drafts where they are drafts? (Yes.)'],
 src=[AP_PS_GUIDE, AP_DULT, IETF, G_AUP, FTT + ', Part X “The CISO’s view” and Part XI (<a href="/articles/from-tap-to-trace.html#p10">#p10</a>, <a href="/articles/from-tap-to-trace.html#p11">#p11</a>).']),
])

INSERTS = {50: DEMO_K}
SCRIPTS = ['/invisible-engine/demos/consent.js']
