# Module 4 content. Each scene: id, title, lede, frames, A(story, why), B, C, D, E, notes(eng, test, src)
from .inserts import DEMO_C

M = dict(
    num=4, file='m04.html', title='Bluetooth LE and the AirTag whisper',
    kicker='Module 4 · The whisper',
    dek='A tracker smaller than a coin has no map and no phone line. It whispers a short radio message every so often, and anyone nearby who is listening can hear it. What is in the whisper, why it is so quiet, and why its name keeps changing.',
    prereq='Module 1, especially Scenes 05 (antennas) and 06 (energy budget); Module 3, Scene 22 (how RFID, NFC, BLE and GPS differ).',
    scenes=[
dict(id=23, title='Inside a tiny tracker',
 lede='Open a small item tracker of the AirTag class. There is no GPS receiver, no SIM card and no screen: a coin cell, a few radios, a speaker and a motion sensor.',
 frames=['The outside: a round tracker about 3 cm across, with no screen, no GPS and no SIM card.',
         'Opened into three illustrative layers: a top cover with a speaker, a circuit board, and a coin cell under a cover.',
         'The power parts: a CR2032-class coin cell and power management, feeding the circuit board.',
         'The radio parts: a microcontroller, a Bluetooth LE radio and its 2.4 GHz antenna, an ultra-wideband radio and an NFC interface.',
         'The rest: a speaker and an accelerometer. Apple documents these parts; the layout drawn here is illustrative, not a teardown.'],
 A=(['Inside the little round tag is a flat battery, like a watch battery.', 'There are tiny radios that can whisper.', 'There is a speaker so it can beep.', 'There is no map and no phone inside.'],
    'A tracker is a battery, a few tiny radios and a speaker — it cannot see where it is, it can only whisper and beep.'),
 B='''<p>Apple lists what is inside an AirTag: a <strong>Bluetooth LE</strong> radio for being heard nearby, Apple’s <strong>U1 chip</strong> for ultra-wideband ranging (Precision Finding, Module 5), <strong>NFC</strong> so a phone can tap it for Lost Mode information, a <strong>speaker</strong>, an <strong>accelerometer</strong>, and a user-replaceable <strong>CR2032</strong> coin cell. What is missing matters as much: no GPS receiver and no cellular modem, so it never knows its own coordinates and cannot phone home by itself.</p>
<p><strong>Where the analogy breaks:</strong> the three neat layers in the drawing are a teaching device. The real board, its chips, their placement and the firmware are not published, and this lesson does not guess them.</p>''',
 C='''<ul>
<li>AirTag (first generation, 2021): 31.9 mm diameter, 8.0 mm high, 11 g; Bluetooth LE, U1 (UWB), NFC, speaker, accelerometer, CR2032. <span class="tag doc">Apple tech specs</span></li>
<li>CR2032: 3 V lithium manganese dioxide coin cell, nominal capacity about 220–240 mAh depending on manufacturer and cut-off voltage. <span class="tag spec">datasheet</span></li>
<li>Power management keeps the microcontroller in deep sleep between radio events (Scene 24); the radios, speaker and sensors are switched on only when needed. <span class="tag concept">conceptual</span></li>
<li>Board layout, chip part numbers, firmware and timing are not published by Apple. <span class="tag undisclosed">not publicly disclosed</span></li>
</ul>''',
 D='''<p>Three radios means three separate interfaces, each with its own reach and purpose: BLE (metres, broadcast to anyone), UWB (metres, ranging with the owner’s phone), NFC (centimetres, tap to read limited information). Threat-model them separately; a weakness in one does not imply the others. Firmware is updatable over the air from the owner’s phone, which is both a fix path and part of the attack surface.</p>''',
 E='''<ul><li>When staff or vendors propose “tracker” products, ask first what radios are inside and whether the device knows its own location. A BLE tag and a GPS tracker need different policies (Scene 30).</li></ul>''',
 eng='<p>Generic round tag; no Apple logo. Layer drawing and block grid are illustrative, chosen to name the documented parts.</p>',
 test=['Is a PCB, chip part number or firmware detail invented? (No; layout labelled illustrative, firmware marked not disclosed.)', 'Does the scene imply GPS or cellular inside? (No; frame 1 says neither is present.)'],
 src=['Apple, “AirTag — Technical Specifications” (support.apple.com).', 'Apple, <a href="https://www.apple.com/airtag/">AirTag product page</a>.', 'Coin-cell manufacturer datasheets for CR2032 (e.g. Energizer, Panasonic, Renata).']),

dict(id=24, title='The whisper is a pulse, not a stream',
 lede='Most of the time the tracker is asleep. Every so often it wakes for a few milliseconds, sends one short packet on three channels, and sleeps again.',
 frames=['Sleep: the supply current is a few microamps (illustrative).',
         'An advertising event: the radio sends the same short packet on channels 37, 38 and 39, a few milliamps for a few milliseconds in total (illustrative).',
         'Events repeat after an advertising interval plus a random delay of 0–10 ms, which stops two devices colliding every time.',
         'The average current, a dashed line only just above sleep, is set mostly by how often the tracker speaks.',
         'Worked example with illustrative values: 6 mA for 3 ms every 2 s plus 2 µA sleep gives about 11 µA, or about 33 µW at 3 V.'],
 A=(['The tag sleeps almost all the time.', 'Every little while it wakes up.', 'It whispers a tiny message, very fast.', 'Then it goes back to sleep.'],
    'Because it whispers for only a blink and sleeps the rest of the time, one small battery lasts a long time.'),
 B='''<p>Battery life is not about how strong the radio is while it is on; it is about how <strong>rarely</strong> it is on. An advertising event takes a few milliseconds. If it happens every couple of seconds, the radio is on less than one part in five hundred of the time, and the sleep current and other parts of the device start to matter as much as the radio.</p>
<p><strong>Where the analogy breaks:</strong> the numbers here are illustrative. Apple does not publish AirTag’s advertising interval or currents; independent research has measured some behaviour, and it can change with firmware and with whether the tag is near its owner.</p>''',
 C='''<ul>
<li>Advertising interval: 20 ms to 10.24 s in 0.625 ms steps, plus a pseudo-random <code>advDelay</code> of 0–10 ms added to every event. <span class="tag spec">Bluetooth Core Spec</span></li>
<li>An advertising event normally transmits on all three primary advertising channels (37, 38, 39). A legacy packet of ~40 bytes at 1 Mbit/s lasts roughly 0.3 ms on air; radio start-up and channel hops make the whole event a few ms. <span class="tag calc">calculated</span> <span class="tag illus">illustrative</span></li>
</ul>
<p class="eq">I_avg = (I_tx · t_on + I_sleep · (T − t_on)) / T</p>
<p class="eq">Example: (6 mA · 3 ms + 2 µA · 1.997 s) / 2 s ≈ (18 + 4) µA·s / 2 s ≈ 11 µA → P ≈ 3 V · 11 µA ≈ 33 µW</p>
<p>All inputs illustrative. <span class="tag illus">illustrative</span></p>''',
 D='''<p>The interval is a security and privacy parameter as well as a power one: more frequent advertising means more chances to be detected, both by the owner’s crowd of finders and by anyone else scanning. Behaviour that changes when a tag is away from its owner (documented by independent research for Find My accessories) is a deliberate trade between findability and battery.</p>''',
 E='''<ul><li>Vendor claims of “years of battery” depend on an advertising interval you rarely see. Ask for the interval and the assumptions behind any battery-life figure.</li></ul>''',
 eng='<p>Spike widths and heights are not to scale; the current axis is broken between µA and mA.</p>',
 test=['Are the interval and currents presented as AirTag measurements? (No; labelled illustrative.)', 'Is the random advDelay shown? (Yes, frame 3.)'],
 src=['Bluetooth SIG, <a href="https://www.bluetooth.com/specifications/specs/core-specification/">Bluetooth Core Specification</a>, Vol 6 Part B (Link Layer): advertising events and advDelay.']),

dict(id=25, title='A whisper anyone nearby can hear',
 lede='Advertising is a broadcast. A passer-by’s phone that happens to be listening on the right channel at the right moment receives it — no pairing, no connection, no reply.',
 frames=['One packet, three channels: the tracker repeats the same advertising packet on channels 37 (2402 MHz), 38 (2426 MHz) and 39 (2480 MHz), out of forty 2 MHz channels.',
         'A passer-by’s phone, scanning, receives one copy.',
         'No pairing, no connection and no reply are needed. The tracker never learns who heard it.',
         'Hearing is a matter of chance: the tracker’s events and the phone’s scan windows must overlap, and walls, bodies and other radios interfere.',
         'The phone checks the CRC and the data format, and acts only on packets its software is built to recognise (Module 5).'],
 A=(['The tag whispers into the air.', 'A stranger walks past with a phone.', 'The phone is listening and hears the whisper.', 'Nobody had to say hello first.'],
    'A whisper can be heard by anyone nearby who is listening, without the tag and the phone ever being introduced.'),
 B='''<p>Bluetooth LE has two ways to talk. <strong>Advertising</strong> is shouting into a room: short packets on three fixed channels, receivable by anything in range. A <strong>connection</strong> is a private conversation that both sides agree to (Scene 26). Trackers mostly advertise, which is why a stranger’s phone can help find your keys without ever being paired with them.</p>
<p><strong>Where the analogy breaks:</strong> “hearing” is not certain. A phone scans in windows, not continuously; packets collide; 2.4 GHz is crowded with Wi-Fi and other Bluetooth devices. A tag in range may be heard several times a minute or not at all.</p>''',
 C='''<ul>
<li>2.4 GHz ISM band, 2400–2483.5 MHz; 40 channels of 2 MHz; primary advertising channels 37, 38, 39 at 2402, 2426 and 2480 MHz, chosen to avoid the busiest Wi-Fi channels. <span class="tag spec">Bluetooth Core Spec</span></li>
<li>Passive scanning: the scanner only listens, controlled by <code>scanInterval</code> and <code>scanWindow</code>; no packets are sent to the advertiser. <span class="tag spec">specification</span></li>
<li>Rough chance of catching one event on one channel ≈ scanWindow / scanInterval, reduced by collisions and fading. <span class="tag concept">conceptual</span></li>
</ul>
<p class="eq">P(heard at least once in N events) ≈ 1 − (1 − p)^N</p>''',
 D='''<p>Because broadcasts need no pairing, <strong>anyone</strong> with a scanner receives them — the owner’s helpers and everyone else. The design question is therefore not “who can receive the whisper?” (everyone nearby) but “what can a receiver learn from it?”: Scene 26 (what is in it), Scene 28 (rotating identifiers) and Module 5 (encryption of the reported location).</p>''',
 E='''<ul><li>Assume every BLE broadcast from staff devices and assets can be received by anyone nearby. Policies should cover what those broadcasts reveal, not whether they can be heard.</li></ul>''',
 eng='<p>Channel positions are drawn to scale across the band; timing strips are not to scale.</p>',
 test=['Does any frame suggest the finder pairs or connects with the tag? (No; frame 3 says the opposite.)', 'Is reception presented as guaranteed? (No; frame 4.)'],
 src=['Bluetooth SIG, <a href="https://www.bluetooth.com/specifications/specs/core-specification/">Bluetooth Core Specification</a>, Vol 6 Part B: physical channels, advertising and scanning.']),

dict(id=26, title='What is in an advertising packet',
 lede='A legacy advertising packet is a few dozen bytes: a synchronisation pattern, a fixed address that marks it as advertising, a short header, the advertiser’s address, up to 31 bytes of data and an error check.',
 frames=['The packet on the LE 1M PHY: preamble 1 byte, access address 4 bytes, header 2 bytes, advertiser address 6 bytes, advertising data up to 31 bytes, CRC 3 bytes.',
         'What each field is for: the preamble syncs bit timing; the access address 0x8E89BED6 marks advertising; the header gives type and length; the CRC catches errors, not attackers.',
         'Advertising data is a list of length–type–value structures; an ecosystem can carry its own short-lived identifier in one of them (shown conceptually, not as real bytes).',
         'Advertising is one-way and anyone can hear it; a connection (GATT) is agreed between two devices and can be encrypted after pairing.',
         'Addresses that change: Bluetooth privacy uses a resolvable private address that changes every so often; bonded devices can recognise it and strangers see an unrelated value.'],
 A=(['The whisper is a tiny message.', 'It starts with a beat so the phone can tune in.', 'It says “this is an announcement”.', 'It carries a short name and a few words.', 'It ends with a check that nothing got garbled.'],
    'The whisper is a short, well-ordered message, so any phone can tell where it starts, what it is and whether it arrived intact.'),
 B='''<p>The structure is public and the same for every Bluetooth LE device, which is what lets any phone understand any beacon. What differs between products is the <strong>advertising data</strong>: a list of small labelled pieces (“flags”, “name”, “manufacturer data”…). A tracking ecosystem puts its own identifier there in its own format.</p>
<p><strong>Where the analogy breaks:</strong> this lesson shows the field layout from the specification, not a capture of an AirTag. Independent researchers have published what Find My accessories broadcast; Apple has not, and the exact bytes are not reproduced here.</p>''',
 C='''<ul>
<li>LE 1M PHY legacy advertising: preamble (1 B, 0xAA or 0x55), access address (4 B, 0x8E89BED6 for advertising channels), PDU header (2 B: PDU type, TxAdd/RxAdd, length), payload (AdvA 6 B + AdvData 0–31 B), CRC (3 B). <span class="tag spec">Bluetooth Core Spec</span></li>
<li>AdvData is a sequence of AD structures: <code>length | AD type | data</code>. Manufacturer Specific Data begins with a 16-bit company identifier. <span class="tag spec">Core Spec Supplement</span></li>
<li>Extended advertising (Bluetooth 5) allows larger payloads on secondary channels; not needed for this picture.</li>
<li>Find My accessory payload format: published by independent research, not by Apple. <span class="tag research">independent research</span></li>
</ul>
<p class="eq">Longest legacy packet: 1 + 4 + 2 + 37 + 3 = 47 bytes → 376 µs at 1 Mbit/s</p>''',
 D='''<ul>
<li>The <strong>CRC is not security</strong>: anyone can compute it. Integrity and confidentiality, where they exist, come from the application layer (Module 5) or from an encrypted connection.</li>
<li><strong>Advertising is plaintext</strong> at the radio layer. Whatever an ecosystem broadcasts — even an identifier derived from a public key — is visible to every scanner; the protection is in what that value lets a scanner do, not in hiding it.</li>
<li>Resolvable private addresses are resolved with an Identity Resolving Key shared only with bonded peers.</li>
</ul>''',
 E='''<ul><li>When a vendor says a beacon is “encrypted”, ask which layer: the broadcast itself, an identifier derived from a key, or a later connection. They protect different things.</li></ul>''',
 eng='<p>Field widths are not proportional to byte counts. Identifier box is dashed: conceptual.</p>',
 test=['Does the scene claim specific AirTag bytes? (No.)', 'Does it describe the CRC as a security control? (No; “catches errors, not attackers”.)'],
 src=['Bluetooth SIG, <a href="https://www.bluetooth.com/specifications/specs/core-specification/">Bluetooth Core Specification</a>, Vol 6 Part B §2 (packet format) and Vol 3 Part C (privacy, resolvable private addresses).', 'Bluetooth SIG, Core Specification Supplement (AD types).', 'A. Heinrich, M. Stute, T. Kornhuber, M. Hollick, “Who Can Find My Devices? Security and Privacy of Apple’s Crowd-Sourced Bluetooth Location Tracking System”, PETS 2021 — <a href="https://arxiv.org/abs/2103.02282">arXiv:2103.02282</a>.']),

dict(id=27, title='Why a tiny antenna is enough — and when it is not',
 lede='At 2.4 GHz the radio wave is about 12 cm long, so a quarter-wave antenna is about 3 cm — roughly the size of the tag. Small antennas still pay a price, and bodies and walls take their share.',
 frames=['Wavelength at 2.44 GHz: λ = c / f ≈ 12.3 cm; a quarter wavelength is about 3.1 cm, about the size of the tag.',
         'Small antennas compromise: less efficient, narrower in frequency, and detuned by a hand, a bag or metal nearby.',
         'A link budget with illustrative values: 0 dBm transmitted, about 60 dB lost over 10 m of free space, 15 dB through a body, still above a −95 dBm receiver sensitivity, leaving about 20 dB of margin.',
         'A body in the direct path absorbs much of the signal, mostly because it is water; a bounce off the floor may still arrive.',
         'Range is a probability: the same tag and phone may connect at several metres one moment and not at all the next.'],
 A=(['Radio waves at this speed are about as long as your hand.', 'A quarter of a wave fits inside the tag.', 'Your body soaks up these waves, like a sponge.', 'Sometimes the whisper bounces off the floor and still gets there.'],
    'The tag’s antenna is small but just big enough for its wave, so it can whisper a few metres — less through people, sometimes more by bouncing.'),
 B='''<p>Antennas work best when they are a sizeable fraction of the wavelength. At 2.4 GHz that fraction is a few centimetres, which is why Bluetooth fits in earbuds and tags. Making an antenna even smaller, or putting it next to a battery and a speaker, costs efficiency.</p>
<p>Between the tag and a phone, the signal weakens with distance, loses more through bodies and furniture, and arrives along several paths that can add or cancel. That is why Bluetooth range is quoted as “up to” and why the same tag is heard sometimes and not others.</p>
<p><strong>Where the analogy breaks:</strong> “a quarter of the wave fits inside” is a rule of thumb. Real small antennas use matching networks, ground planes and clever shapes; their performance is measured, not deduced from size.</p>''',
 C='''<p class="eq">λ = c / f = 3×10⁸ / 2.44×10⁹ ≈ 0.123 m</p>
<p class="eq">FSPL(dB) = 20·log₁₀(d) + 20·log₁₀(f) − 147.55 → at 10 m, 2.44 GHz ≈ 60.2 dB</p>
<p class="eq">P_rx = P_tx + G_tx + G_rx − FSPL − losses</p>
<ul>
<li>FSPL value calculated <span class="tag calc">calculated</span>; 0 dBm transmit power, 15 dB body loss and −95 dBm sensitivity are typical-order illustrative values <span class="tag illus">illustrative</span>.</li>
<li>Electrically small antennas (dimension ≪ λ/2π) have fundamentally limited bandwidth and efficiency (Chu–Wheeler limit). <span class="tag concept">conceptual</span></li>
<li>Water strongly absorbs at 2.4 GHz; the human body attenuates by several to tens of dB depending on posture and path. <span class="tag illus">illustrative range</span></li>
</ul>''',
 D='''<p>Short range limits who hears a broadcast but is not an access control: a better antenna and a more sensitive receiver extend reception beyond what a phone achieves. Treat “only works a few metres away” as a usability property, never as a security boundary.</p>''',
 E='''<ul><li>Do not accept “range is only a few metres” as the privacy argument for any broadcasting device; ask what a receiver learns, not how close it must be.</li></ul>''',
 eng='<p>Wave drawn as one cycle; λ/4 bracket to scale with it. Link-budget bars to scale in dB.</p>',
 test=['Is the free-space loss computed correctly? (≈60.2 dB at 10 m, 2.44 GHz.)', 'Is range presented as fixed? (No; frame 5.)'],
 src=['H. T. Friis, “A Note on a Simple Transmission Formula”, Proc. IRE, 1946.', 'L. J. Chu, “Physical Limitations of Omni-Directional Antennas”, J. Appl. Phys., 1948.', 'Bluetooth SIG, “Understanding Bluetooth Range” (bluetooth.com).']),

dict(id=28, title='Changing names: why a rotating identifier protects privacy',
 lede='If a tracker shouted the same name everywhere, anyone with a scanner could follow it. Changing the name every so often stops that casual linking — but not every kind.',
 frames=['A fixed identifier: the same value at a café, a station and an office, so anyone with a scanner can link the sightings into a path.',
         'A rotating identifier: a passer-by sees three unrelated values.',
         'Only the owner, who holds the key the identifiers come from, can link them.',
         'What rotation does not stop: radio fingerprinting, one moving thing seen again and again along a route, long intervals between changes, and implementation flaws.',
         'Find My, as documented: Apple says identifiers come from rotating public keys and change about every 15 minutes; how a tag behaves while separated from its owner comes from independent research.'],
 A=(['Imagine a dog wearing a name tag that never changes.', 'Anyone could follow “Rex” from street to street.', 'Now the tag shows a new secret name every so often.', 'Only the owner knows all the names belong to the same dog.'],
    'Changing the name stops strangers joining the dots, while the owner, who knows the secret, can still find the dog.'),
 B='''<p>A fixed identifier turns every Bluetooth scanner into a potential tracking device. Rotating identifiers make each sighting look unrelated to the last, unless you hold the key that generated them. Apple’s Find My, Google’s Find Hub and others all use some form of rotation.</p>
<p><strong>Where the analogy breaks:</strong> a changing name is not invisibility. If one tag is the only thing moving along a quiet road, an observer can still link sightings by time and place; radios have physical quirks that can be fingerprinted; and how often the name changes matters. Rotation raises the cost of tracking, it does not remove it.</p>''',
 C='''<ul>
<li>Bluetooth LE privacy: resolvable private address (RPA) generated from an Identity Resolving Key; regenerated on a timer set by the host (commonly ~15 min). <span class="tag spec">Bluetooth Core Spec</span> <span class="tag illus">interval typical</span></li>
<li>Find My: the accessory derives a sequence of public keys (NIST P-224) from a key pair and shared secret, and advertises the current one; the owner’s devices can compute the same sequence. <span class="tag doc">Apple Platform Security</span></li>
<li>Apple documents that the key a Find My accessory broadcasts changes about every 15 minutes. <span class="tag doc">documented</span> Longer intervals while a tag is separated from its owner were measured by independent researchers and may change with firmware. <span class="tag research">independent research</span></li>
</ul>''',
 D='''<ul>
<li>Correlation channels outside the identifier: RF fingerprinting (carrier-frequency offset, transient shape), co-location with another device that does not rotate, rotation boundaries that are predictable, and motion patterns.</li>
<li>Long rotation intervals while separated from the owner are a deliberate trade for findability and battery; they lengthen the window an observer can follow one identifier. This is a known design tension, discussed further in Module 7.</li>
</ul>''',
 E='''<ul><li>For BLE assets you deploy, ask whether identifiers rotate, how often, and who can link them. A fixed-ID beacon on a laptop bag is a tracking beacon for anyone who cares to scan.</li></ul>''',
 eng='<p>Identifier values are made up. Shops are generic places, not a real route.</p>',
 test=['Does the scene say rotation makes correlation impossible? (No; frame 4 lists what remains.)', 'Is each interval labelled by its source? (Yes: ~15 minutes is Apple-documented; separated-state behaviour is independent research.)'],
 src=['Apple Platform Security, <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">“Find My security”</a>.', 'Heinrich et al., PETS 2021 — <a href="https://arxiv.org/abs/2103.02282">arXiv:2103.02282</a>.', 'Bluetooth SIG, Core Specification, Vol 3 Part C §10.7 (privacy feature).']),

dict(id=29, title='Battery life is a budget',
 lede='Battery life is a sum: radio events, sleep, sensors, the occasional sound or ranging session, and the battery’s own slow self-discharge, set against a capacity that shrinks in the cold.',
 frames=['The battery: a CR2032-class coin cell, 3 V and about 225 mAh nominal; usable capacity is less with pulses, cold and age.',
         'The radio’s duty cycle: speaking 3 ms every 2 s means on about 0.15% of the time, about 11 µA on average including sleep (illustrative).',
         'The whole budget as a stacked bar, adding motion sensing, averaged sound, UWB and NFC sessions, and self-discharge: about 14 µA (illustrative).',
         'Estimated life ≈ usable capacity ÷ average current ≈ 180 mAh ÷ 0.014 mA ≈ 12,600 hours ≈ 1.4 years with these assumptions; Apple states “more than a year” for AirTag.',
         'The levers trade against each other: speaking less often lasts longer but gives fewer chances to be heard; quieter means shorter range; cold means less capacity.'],
 A=(['The battery is like a jar of sweets.', 'Every whisper takes one tiny sweet.', 'Sleeping takes even tinier crumbs.', 'Beeping takes a few more.', 'Whisper less often and the jar lasts longer.'],
    'The battery lasts longer the less often the tag whispers, but then it is heard less often too.'),
 B='''<p>A coin cell holds roughly 225 milliamp-hours. Divide by the average current and you get hours of life. The radio is usually the biggest single item, but at microamp averages everything counts: the sleeping microcontroller, the motion sensor, every time the owner plays a sound or uses Precision Finding.</p>
<p><strong>Where the analogy breaks:</strong> a coin cell is not a jar with a fixed number of sweets. High pulse currents and cold temperatures reduce the usable capacity, and voltage sag near the end of life can stop the radio working before the cell is “empty”. Every number in this scene is illustrative; demo C below lets you change them.</p>''',
 C='''<p class="eq">life (h) ≈ C_usable (mAh) / I_avg (mA)</p>
<p class="eq">I_avg ≈ 9 (advertising) + 2 (sleep) + 1.5 (motion) + 1.5 (sound, UWB, NFC averaged) + 0.3 (self-discharge) ≈ 14.3 µA</p>
<p class="eq">180 mAh / 0.0143 mA ≈ 12,600 h ≈ 1.4 years</p>
<ul>
<li>Self-discharge of ~1% per year on 225 mAh ≈ 2.25 mAh/year ≈ 0.26 µA equivalent. <span class="tag calc">calculated</span></li>
<li>Derating from 225 to 180 mAh for pulse load and temperature is an assumption. <span class="tag illus">illustrative</span></li>
<li>Apple: AirTag battery lasts “more than a year” with everyday use. <span class="tag doc">Apple documented</span></li>
</ul>''',
 D='''<p>Battery-driven design choices have privacy consequences: longer advertising intervals and longer identifier rotation periods save energy and make devices harder to find, both for owners and for people checking for unwanted trackers. Some anti-stalking features (sounds, alerts) also cost energy; removing a battery stops all of them.</p>''',
 E='''<ul><li>For fleets of battery-powered tags, require vendors to state battery-life assumptions (interval, temperature, events per day) and how the device behaves as the battery fails.</li></ul>''',
 eng='<p>Stacked bar to scale in µA; labels moved apart where segments are thin.</p>',
 test=['Is the life estimate presented as Apple’s? (No; Apple’s “more than a year” is quoted separately.)', 'Are non-radio loads included? (Yes, frame 3.)'],
 src=['Coin-cell manufacturer datasheets for CR2032 (capacity, pulse derating, self-discharge).', 'Apple, “AirTag — Technical Specifications” and AirTag product page (battery statement).']),

dict(id=30, title='Three “trackers” that work in completely different ways',
 lede='“Tracker” covers three very different machines: a tag that whispers to strangers’ phones, a beacon that tells nearby apps where they are, and a GPS device that knows its own coordinates.',
 frames=['An item tracker (AirTag-class) does not know where it is: it whispers, a stranger’s phone adds its own location and sends an encrypted report that only the owner can read.',
         'A BLE beacon fixed to a wall broadcasts the same identifier so apps on nearby phones can react; it has no network of its own.',
         'A GPS + cellular tracker computes its own coordinates from satellite signals and sends them over a cellular network to a service.',
         'Comparison: which one knows its location, how the location reaches anyone, and typical power.'],
 A=(['A tag whispers, and a stranger’s phone helps.', 'A beacon on a wall says “you are here” to phones nearby.', 'A GPS box listens to satellites and phones its position home.', 'Only the GPS box knows where it is.'],
    'Three gadgets called trackers do three different jobs, and only one of them can work out where it is on its own.'),
 B='''<p>The differences matter for battery, cost and privacy. A <strong>GPS tracker</strong> works anywhere it can see the sky and reach a mobile network, but needs a bigger battery and usually a subscription. An <strong>item tracker</strong> works only where participating phones pass by, but runs for a year or more on a coin cell. A <strong>beacon</strong> is the reverse of a tracker: it stays put and helps phones know where <em>they</em> are.</p>
<p><strong>Where the analogy breaks:</strong> hybrids exist — some GPS trackers also use Wi-Fi or Bluetooth, and some item trackers support more than one ecosystem. Classify a product by what it actually contains (Scene 23), not by its marketing name.</p>''',
 C='''<ul>
<li>GNSS receivers compute position from satellite time signals; a cellular modem (for example LTE-M or NB-IoT) reports it. Power: tens of mA while acquiring; days to weeks between charges is typical. <span class="tag illus">illustrative</span></li>
<li>BLE beacon formats (Apple iBeacon, Google Eddystone): a fixed identifier advertised for proximity apps. <span class="tag spec">published formats</span></li>
<li>Crowdsourced item finding: the tag never computes coordinates; finder devices supply their own location (Module 5). <span class="tag doc">Apple documented</span></li>
</ul>''',
 D='''<ul>
<li>A GPS tracker’s location history lives with its service provider; protections are whatever that service offers.</li>
<li>A fixed-ID beacon carried by a person is trackable by any scanner; a beacon fixed to a wall reveals only that a phone came near it — but the app that hears it may report that onward.</li>
<li>Crowdsourced trackers depend on strangers’ devices; their privacy rests on encryption and rotating identifiers (Scene 28, Module 5).</li>
</ul>''',
 E='''<ul><li>Write separate rules for GPS trackers, item trackers and beacons in asset and travel policies; one “tracker policy” will be wrong for at least two of them.</li></ul>''',
 eng='<p>Generic devices. Radio arcs illustrative. Cellular reports drawn purple because such services normally use encrypted transport.</p>',
 test=['Does the scene say an item tracker knows its location? (No.)', 'Is any brand logo shown? (No.)'],
 src=['Apple Platform Security, <a href="https://support.apple.com/guide/security/find-my-security-sec6cbc80fd0/web">“Find My security”</a>.', 'Apple, iBeacon developer documentation; Google, Eddystone format specification (GitHub, google/eddystone).']),
])

INSERTS = {29: DEMO_C}
SCRIPTS = ['/invisible-engine/demos/whisper.js']
