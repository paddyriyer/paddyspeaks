# Module 1 content. Each scene: id, title, lede, frames, A(story, why), B, C, D, E, notes(eng, test, src)
M = dict(
    num=1, file='m01.html', title='Classical electronics, power and wireless foundations',
    kicker='Module 1 · Foundations',
    dek='Before a card can pay or a tag can whisper, something has to move: charge, energy, a field, a wave. This module separates them so that later modules never have to fuse them into one glowing arrow.',
    prereq='None. Every symbol is explained where it first appears.',
    scenes=[
dict(id=1, title='From a switch to a transistor',
 lede='Every digital thing in this lesson rests on one idea: a switch that is either letting current through or not, and an agreement about which state we call 1.',
 frames=['Switch open: no current, the bulb is dark — we call that 0.',
         'Switch closed: current carries energy to the bulb, which lights — we call that 1.',
         'A transistor with its gate below the threshold voltage: no conducting channel, off.',
         'Gate above threshold: electrons gather under the gate and form a channel; current flows from source to drain, on.'],
 A=(['A torch has a switch.', 'Switch off: no light. We say 0.', 'Switch on: light. We say 1.', 'A computer chip has billions of tiny switches with no moving parts.', 'Each one is on or off, so the chip can count and remember.'],
    'A chip works by turning tiny switches on and off, and we agree that “off” means 0 and “on” means 1.'),
 B='''<p>A transistor is a switch with no moving parts. A small voltage on one terminal, the <strong>gate</strong>, decides whether current can flow between two others, the <strong>source</strong> and the <strong>drain</strong>. In the metal-oxide-semiconductor transistor (MOSFET) drawn here, the gate sits on a very thin insulating layer. Raise the gate voltage past a threshold and the electric field pulls electrons into a thin <em>channel</em> just under the insulator: the switch closes.</p>
<p><strong>Where the analogy breaks.</strong> A torch switch is either fully on or fully off. A transistor responds continuously: below threshold a tiny leakage current still flows, and near threshold it is partly on. Digital circuits work because designers keep transistors away from that in-between region and agree that, say, anything near the supply voltage is a 1 and anything near zero is a 0.</p>''',
 C='''<ul>
<li><strong>Logic levels are voltage ranges</strong>, set by the logic family and supply voltage (for example a 1.8 V or 3.3 V supply). Between the low and high ranges is a forbidden band where a reading is not guaranteed.</li>
<li><strong>Threshold voltage</strong> V<sub>th</sub> depends on the process; modern low-power processes are typically a few hundred millivolts. <span class="tag illus">illustrative</span></li>
<li><strong>Switching costs energy</strong>: each transition charges or discharges a capacitance C through a voltage V, about C·V² per full cycle; dynamic power is roughly <code>P ≈ α·C·V²·f</code> (α activity factor, f clock frequency). This is why low-power chips run slowly and sleep most of the time (Scene 06).</li>
<li><strong>Leakage</strong>: an “off” transistor still conducts a little; across billions of transistors that sets a floor on sleep current.</li>
</ul>
<p class="eq">P_dynamic ≈ α · C · V² · f</p>
<p class="eq-key">α fraction of nodes switching per cycle · C switched capacitance (farads) · V supply voltage (volts) · f clock frequency (hertz).</p>''',
 D='''<p>For a security architect the useful point is the <strong>separation between physics and meaning</strong>. A 1 is not a property of the electrons; it is an interpretation applied by circuits built to a specification. Attacks that push a circuit into the forbidden band — power glitches, clock glitches, electromagnetic or laser fault injection — can make a chip read a value its designers never intended. That is why secure elements and payment chips include sensors and countermeasures for voltage, clock and light (Module 2). Power consumption also varies with the data a chip processes, the basis of <strong>side-channel</strong> analysis; secure chips are designed to blur that link.</p>''',
 E='''<ul>
<li><strong>Question to ask a vendor:</strong> is the chip that holds our keys a certified secure element or a general-purpose microcontroller? Evaluated fault and side-channel resistance is a property of the former.</li>
<li><strong>Residual risk:</strong> physical attacks need possession and skill; they matter most for devices an attacker can buy, steal or borrow in quantity.</li>
<li><strong>Policy:</strong> treat “the key is in hardware” as a claim to verify by certification level, not as a guarantee.</li>
</ul>''',
 eng='<p>The MOSFET is drawn as an n-channel enhancement device in cross-section: n-type source and drain wells in a p-type body, a gate electrode on a thin oxide. The channel is an inversion layer, not a wire; its thickness is exaggerated. Logic families differ in exact thresholds and margins.</p>',
 test=['Does any frame suggest a transistor is purely binary? (No: B and C state leakage and the in-between region.)', 'Are the 0/1 labels described as interpretations, not physical properties? (Yes.)', 'Is any threshold voltage presented as universal? (No: marked illustrative.)'],
 src=['Sedra & Smith, <em>Microelectronic Circuits</em> (MOSFET operation) — standard textbook treatment.', 'Weste & Harris, <em>CMOS VLSI Design</em> (dynamic power P ≈ αCV²f).']),

dict(id=2, title='Energy and information are different things',
 lede='The most common mistake in explanations of contactless technology is drawing one arrow for “the signal”. Two different things travel, often on the same field: energy and information.',
 frames=['Energy: a battery delivers energy to a bulb. Energy is measured in joules; the rate of delivery, in watts.',
         'Information: one phone sends bits to another. Information is measured in bits; the rate, in bits per second.',
         'Both at once: a payment terminal sends energy to a card, and the card sends information back. Delivering energy proves nothing about whose chip it is.'],
 A=(['A battery can light a bulb. That is energy.', 'A phone can send a message. That is information.', 'A card reader does both: it gives the card energy…', '…and the card answers with a message.', 'Lighting the card up does not tell you whose card it is.'],
    'Energy makes things work; information tells you something; they are different, even when they travel together.'),
 B='''<p><strong>Energy</strong> is the capacity to do work: light a bulb, warm a room, run a chip. It is measured in joules (J). <strong>Power</strong> is how fast energy flows, in watts (W): one watt is one joule per second.</p>
<p><strong>Information</strong> is a reduction in uncertainty. The smallest unit is the bit: one answer to one yes-or-no question. A data rate, in bits per second, says how many such answers arrive each second.</p>
<p>A contactless card is the clearest case of both moving together. The terminal’s magnetic field carries energy into the card; the card answers by changing how much of that energy it absorbs (Scene 13). <strong>Where the analogy breaks:</strong> you cannot send information without spending some energy, but the amount of energy says almost nothing about the content. A very strong signal can carry a lie.</p>''',
 C='''<ul>
<li>Energy E [J] = power P [W] × time t [s]. A chip drawing 10 mW for 2 ms uses 20 µJ. <span class="tag illus">illustrative</span></li>
<li>Information rate R [bit/s]; ISO/IEC 14443 proximity cards start at 106 kbit/s. <span class="tag spec">specification</span></li>
<li>Shannon: the maximum error-free rate through a channel of bandwidth B with signal-to-noise ratio S/N is <code>C = B·log₂(1 + S/N)</code>. More bandwidth or a cleaner signal raises the ceiling; neither raises trust.</li>
</ul>
<p class="eq">E = P · t        C = B · log₂(1 + S/N)</p>
<p class="eq-key">E energy (J) · P power (W) · t time (s) · C channel capacity (bit/s) · B bandwidth (Hz) · S/N signal-to-noise power ratio.</p>''',
 D='''<p>Keep three flows apart on every architecture diagram: <strong>energy</strong> (who powers whom), <strong>data</strong> (who tells whom what) and <strong>trust</strong> (why the receiver should believe it). Proximity proves only that energy could reach a device; it is not authentication. Identity has to be established cryptographically — the subject of Scenes 15–16 — or it has not been established at all.</p>''',
 E='''<ul>
<li>When a vendor says “it only works at a few centimetres, so it’s secure”, ask which control actually authenticates the device. Range is a physical property, not an authorisation decision (Scene 17: relay).</li>
<li>Insist that architecture diagrams use distinct arrows for energy, data and authorisation; fused arrows hide where the trust decision is made.</li>
</ul>''',
 eng='<p>The bit row on the data arrow is decorative, not a protocol frame. Rates quoted are base rates from the standard; higher rates exist.</p>',
 test=['Is any arrow carrying both energy and data? (No: the payment row uses two arrows.)', 'Does the scene imply proximity equals identity? (No: stated explicitly.)'],
 src=['ISO/IEC 14443-2 (106 kbit/s base rate), as summarised by independent test-equipment notes.', 'C. E. Shannon, “A Mathematical Theory of Communication”, 1948.']),

dict(id=3, title='A changing current makes a changing magnetic field',
 lede='Contactless cards and trackers both use electromagnetism, but in very different regimes. The difference between the near field and the far field explains most of what each technology can and cannot do.',
 frames=['An alternating-current source drives a coil: the current reverses direction many times a second.',
         'The current creates a magnetic field around the coil that grows, shrinks and reverses with it (illustrative drawing).',
         'Near field versus far field: close to the coil, energy is stored and shared with nearby coils and falls very steeply with distance; far away, a wave detaches and travels on.',
         'Sizes: at 13.56 MHz the near-field boundary is about 3.5 m, so a card a few centimetres away is deep inside it; at 2.4 GHz it is about 2 cm, so a phone metres away is in the far field.'],
 A=(['Electricity flowing in a wire makes a magnet you cannot see.', 'If the electricity keeps changing direction, the magnet keeps flipping.', 'Very close to the wire, that magnet can push on another wire.', 'Far away, some of the energy flies off as a radio wave.'],
    'A wire with changing electricity in it makes an invisible changing magnet, which can reach a nearby wire or send a wave far away.'),
 B='''<p>Every current makes a magnetic field. An <strong>alternating</strong> current — one that reverses many times a second — makes a field that keeps changing. Close to the coil, that changing field mostly stores energy and hands it back; a second coil placed nearby can capture some of it (Scene 04). Far from the coil, part of the energy breaks away as an electromagnetic wave that carries on travelling.</p>
<p>The distance at which the picture changes scales with the wavelength. A rough rule of thumb is λ/2π. <strong>Where the analogy breaks:</strong> the dashed rings are a drawing aid. Real fields are invisible, fill space continuously, and the near/far transition is gradual, not a line.</p>''',
 C='''<p class="eq">λ = c / f        r_boundary ≈ λ / 2π</p>
<p class="eq-key">λ wavelength (m) · c speed of light ≈ 3.00 × 10⁸ m/s · f frequency (Hz) · r_boundary rough near/far transition for a small antenna.</p>
<ul>
<li>13.56 MHz: λ ≈ 22.1 m, λ/2π ≈ 3.5 m. NFC operates at centimetres, well inside. <span class="tag calc">calculation</span></li>
<li>2.4 GHz: λ ≈ 12.5 cm, λ/2π ≈ 2 cm. Bluetooth links are far-field. <span class="tag calc">calculation</span></li>
<li>In the near field of a small loop, the magnetic field on its axis falls roughly as 1/d³ once d is larger than the loop radius; the radiated far field falls as 1/d (power density as 1/d²).</li>
<li>Do not infer range from frequency alone: transmit power, antenna size and efficiency, receiver sensitivity, noise and regulation all matter.</li>
</ul>''',
 D='''<p>The near-field regime is what makes NFC <em>short-range by physics</em>: an eavesdropper must overcome a field that collapses steeply. But “steeply” is not “impossible”: with larger antennas and sensitive receivers, listening and reading distances can exceed the normal working distance. Treat the working range as a usability property and design authentication as if the attacker were closer than you would like.</p>''',
 E='''<ul>
<li>Do not accept “near-field, therefore private” in a risk assessment. Ask what an adversary with better antennas could do, and what cryptography prevents it.</li>
<li>For far-field technologies (Bluetooth, Wi-Fi) assume broadcasts are receivable well beyond a room.</li>
</ul>''',
 eng='<p>The field drawing is an illustrative visualisation. The λ/2π figure is a conventional rule of thumb for electrically small antennas; real boundaries depend on antenna geometry.</p>',
 test=['Is the field drawing labelled as illustrative? (Yes.)', 'Does the scene claim range follows from frequency alone? (No: explicitly denied.)'],
 src=['Standard antenna theory (e.g. Balanis, <em>Antenna Theory</em>) for the λ/2π near/far rule of thumb.', 'NFC Forum, “NFC technology” — 13.56 MHz operation.']),

dict(id=4, title='Induction: a changing field pushes current around a coil',
 lede='Induction is how a card with no battery gets power. The key word is <em>changing</em>: a steady magnetic field does nothing.',
 frames=['A magnet moving into a coil makes the meter needle swing.',
         'When the magnet stops, the needle returns to zero: only a changing field induces a voltage. The induced current opposes the change (Lenz’s law).',
         'Drive one coil with alternating current and the field keeps changing, so a nearby second coil gets an alternating voltage — energy crosses the gap with no wire.',
         'Three ways a device can get energy: a battery (stored inside), near-field induction (from a nearby coil, useful only at centimetres) and far-field radio harvesting (from a passing wave, typically far weaker).'],
 A=(['Push a magnet into a coil of wire: a needle wiggles.', 'Hold the magnet still: the needle stops.', 'Make the magnet flip again and again: electricity keeps flowing in the coil.', 'That is how a card gets power from a reader without a battery.'],
    'Moving or flipping a magnet near a coil pushes electricity around it, so a reader can power a card without touching it.'),
 B='''<p>Faraday discovered that a <strong>changing</strong> magnetic field through a loop of wire pushes current around it. Move a magnet and you get a pulse; stop it and the pulse ends. Drive one coil with alternating current and its field never stops changing, so a second coil nearby gets a steady alternating voltage. That is a transformer — and a contactless card is the secondary winding of a very loose, air-cored transformer whose primary is in the terminal.</p>
<p><strong>Where the analogy breaks:</strong> in a power transformer almost all the field passes through both coils. Between a terminal and a card only a small fraction does, and that fraction changes as the card moves, tilts or meets metal (Scene 12).</p>''',
 C='''<p class="eq">v = −N · dΦ/dt        Φ = ∫ B · dA</p>
<p class="eq-key">v induced voltage (V) · N number of turns · Φ magnetic flux through one turn (Wb) · B magnetic flux density (T) · A loop area (m²). The minus sign is Lenz’s law: the induced current opposes the change.</p>
<ul>
<li>For a sinusoidal flux Φ(t) = Φ₀ sin(ωt), the induced amplitude is N·ω·Φ₀ — proportional to frequency, which is one reason HF (13.56 MHz) coupling delivers useful power to small coils.</li>
<li>Coupling between two coils is described by mutual inductance M and coupling coefficient k = M / √(L₁L₂), usually well below 0.1 at card distances. <span class="tag illus">illustrative</span></li>
<li>Far-field RF harvesting (as in passive UHF RFID) works from radiated power density, which falls as 1/d²; it is not the same mechanism.</li>
</ul>''',
 D='''<p>Induction means a passive card can be <strong>powered by anyone’s reader</strong>, not just a legitimate terminal. The card cannot know who woke it. Everything it answers at that point must either be harmless to disclose or be protected cryptographically. This is the root of skimming and relay discussions in Scene 17.</p>''',
 E='''<ul>
<li>Inventory which badges and cards in your estate answer any reader with a fixed identifier: they can be read by unauthorised readers within range.</li>
<li>Prefer credentials that perform mutual or cryptographic authentication over ones that only present a number.</li>
</ul>''',
 eng='<p>Meter and magnet are schematic. The three energy-source cards compare mechanisms, not calibrated power levels.</p>',
 test=['Is the induced effect tied to change, not presence? (Yes: frame 2.)', 'Is far-field harvesting distinguished from induction? (Yes: frame 4 and C.)'],
 src=['M. Faraday (1831); standard electromagnetism texts (e.g. Griffiths, <em>Introduction to Electrodynamics</em>).']),

dict(id=5, title='Three antennas, three jobs',
 lede='“Antenna” covers very different objects. A card’s coil couples; a Bluetooth trace radiates; a UWB array times and points.',
 frames=['A loop or coil antenna in a card: a few turns near the edge, tuned near 13.56 MHz, built to couple to a reader’s coil through the magnetic near field.',
         'A small Bluetooth antenna: a printed trace roughly a quarter wavelength long at 2.4 GHz (about 3 cm, often folded), built to radiate a wave that phones metres away can hear.',
         'An Ultra Wideband module with several antennas: built for very wide bandwidth and, by comparing arrival at each antenna, for direction.'],
 A=(['A card has a loop of wire around its edge.', 'A tracker has a tiny wiggly line printed on its board.', 'Some phones have several small antennas side by side.', 'Each shape is good at a different job.'],
    'Antennas come in different shapes because some must catch a nearby magnet, some must throw a wave far, and some must measure exactly when a wave arrives.'),
 B='''<p>A <strong>loop</strong> is a coil designed to link magnetic flux with another coil nearby; its job is coupling, so area and number of turns matter. A <strong>small radiator</strong>, like a Bluetooth trace, is designed to launch a wave; its size is set by the wavelength (around 12.5 cm at 2.4 GHz), so a quarter-wave element is about 3 cm and is often meandered to fit. <strong>UWB antennas</strong> must work across hundreds of megahertz at once; several of them let a device compare when a pulse arrives at each and estimate direction.</p>
<p><strong>Where the analogy breaks:</strong> real antennas are tuned systems including the circuit board, the case and the hand holding the device; the drawings show the idea, not a product layout.</p>''',
 C='''<ul>
<li>Loop: resonant tank with the chip’s capacitance near 13.56 MHz; quality factor Q trades bandwidth (needed for data) against voltage gain (needed for power).</li>
<li>Quarter-wave monopole at 2.4 GHz: λ/4 ≈ 3.1 cm in free space, shorter on a substrate; efficiency drops as it is shrunk.</li>
<li>UWB (IEEE 802.15.4z): channels around 6.5 and 8 GHz with ≥ 500 MHz bandwidth; time resolution ~ 1/bandwidth ≈ 2 ns; angle of arrival from phase difference Δφ = 2π·d·sin(θ)/λ between antennas spaced d apart.</li>
</ul>
<p class="eq">θ = arcsin( Δφ · λ / (2π · d) )</p>
<p class="eq-key">θ angle of arrival · Δφ measured phase difference (rad) · λ wavelength · d antenna spacing (typically ≤ λ/2 to avoid ambiguity).</p>''',
 D='''<p>Antenna choice sets the <strong>observability</strong> of a device. A loop is hard to hear from afar; a radiating Bluetooth antenna is meant to be heard across a room — so anything it broadcasts must assume strangers are listening (Module 4). UWB adds precise relative position, which is valuable to the owner and, if misused, to whoever is authorised to range.</p>''',
 E='''<ul><li>When assessing a device, ask: what does it emit, how far can that be received with better equipment than a phone, and what identifiers does it contain?</li></ul>''',
 eng='<p>Drawings are schematic; geometries vary by product. The UWB module layout is generic, not a specific phone or tag.</p>',
 test=['Are product-specific PCB layouts claimed? (No.)', 'Is the quarter-wave length tied to 2.4 GHz with a free-space caveat? (Yes.)'],
 src=['ISO/IEC 7810 (ID-1 card dimensions).', 'IEEE 802.15.4z-2020 (UWB enhanced ranging).']),

dict(id=6, title='An energy budget: sleep, a short burst, sleep again',
 lede='A tracker can run for about a year on a coin cell not because its radio is frugal while on, but because it is off almost all the time.',
 frames=['Current against time: a low sleep current interrupted by short radio bursts.',
         'Duty cycle D: active time divided by the period between bursts.',
         'Average current: D × active current + (1 − D) × sleep current.',
         'An illustrative lifetime: 8 mA for 2 ms every second plus 2 µA asleep averages about 18 µA; a 220 mAh coin cell would last about 1.4 years before real-world losses. Not a product measurement.'],
 A=(['A tiny tracker sleeps almost all the time.', 'Every so often it wakes and whispers for a moment.', 'Then it sleeps again.', 'Because it sleeps so much, a little coin battery lasts a long time.'],
    'A tiny battery lasts long because the device is asleep almost all the time and only wakes for a moment.'),
 B='''<p>Battery life depends on <strong>average</strong> current, not peak current. A radio might draw thousands of times more current while transmitting than while asleep, but if it transmits for only a fraction of a percent of the time, the average stays tiny. The fraction of time spent active is the <strong>duty cycle</strong>.</p>
<p><strong>Where the analogy breaks:</strong> real devices also spend energy waking up, running sensors and timers, and coin cells deliver less than their label when asked for short high-current pulses or when cold.</p>''',
 C='''<p class="eq">D = t_on / T
I_avg ≈ D · I_active + (1 − D) · I_sleep
t_life ≈ C_usable / I_avg</p>
<p class="eq-key">t_on active time per period · T period · I currents (A) · C_usable usable battery capacity (A·h) at the device’s voltage and pulse profile.</p>
<ul>
<li>Worked example <span class="tag illus">illustrative</span>: t_on = 2 ms, T = 1 s → D = 0.002. I_active = 8 mA, I_sleep = 2 µA → I_avg ≈ 16 µA + 2 µA = 18 µA. With 220 mAh nominal: 220 / 0.018 ≈ 12,200 h ≈ 1.4 years.</li>
<li>Corrections in practice: wake-up and crystal start-up energy, multiple radio events per period, temperature, self-discharge, pulse capacity derating, end-of-life voltage cut-off.</li>
<li>The interactive demo for Module 4 (C, “The BLE whisper”) lets you vary these numbers.</li>
</ul>''',
 D='''<p>Duty cycle is a <strong>privacy and detectability</strong> parameter as much as a battery parameter. How often a device broadcasts determines how often it can be observed and correlated (Module 4) and how quickly an unwanted-tracking alert can accumulate evidence (Module 7). Vendors rarely document these intervals; treat any number you see quoted as unverified unless it names a model and firmware.</p>''',
 E='''<ul><li>When a product’s advertising interval or battery life matters to a risk decision, ask the vendor for the documented figure and firmware version, not a marketing summary.</li></ul>''',
 eng='<p>All numbers in this scene are illustrative, chosen to make the arithmetic easy. They are not measurements of any product. 220 mAh is a typical nominal CR2032 rating at low drain.</p>',
 test=['Is every number labelled illustrative? (Yes: subtitle, callout and footnote.)', 'Is lifetime presented with its assumptions? (Yes.)'],
 src=['Coin-cell manufacturers’ datasheets (CR2032 nominal ~220–240 mAh at low drain; pulse derating) — values vary by maker.']),

dict(id=7, title='Four different questions: who, near, where, which way',
 lede='Identity, proximity, location and direction are four separate questions. Most confusion about trackers comes from treating them as one.',
 frames=['Identity: a tag broadcasts an identifier that a phone can hear. That says which object (or which rotating code), not where.',
         'Proximity: received signal strength (RSSI) jumps about with bodies, walls and orientation — a noisy “warmer or colder” clue.',
         'Location: a phone computes its own coordinates from satellite signals and network databases. A tag without such a receiver cannot.',
         'Distance and direction: two compatible devices exchange timed Ultra Wideband messages to measure distance (d = c·t) and, with several antennas, direction. Local and short-range, not a map position.'],
 A=(['A tag can say “I’m here!” like a whistle.', 'A phone can tell if the whistle is loud or soft — but it jumps around.', 'Only the phone knows where it is on a map, using satellites.', 'With special radios, a phone can point an arrow at the tag when it is close.'],
    'Hearing a tag, knowing it is near, knowing where on a map, and knowing which way to walk are four different things.'),
 B='''<p>A broadcasting tag answers “what is this?” for anyone listening. Signal strength gives a rough “is it near?” but is unreliable, because the same distance can give very different readings depending on what is in the way. Only a device with a satellite or network positioning system can answer “where on Earth?”, and it answers for <em>itself</em>. Ultra Wideband answers “how far and which way?” between two cooperating devices at short range.</p>
<p>This is why a tag without GPS can still appear on a map: a passing phone that <em>does</em> know where it is reports that it heard the tag (Module 5).</p>''',
 C='''<p class="eq">RSSI(d) ≈ RSSI(d₀) − 10 · n · log₁₀(d / d₀) + X_σ        d_UWB = c · t_ToF</p>
<p class="eq-key">RSSI received power (dBm) · d₀ reference distance · n path-loss exponent (≈ 2 free space, larger indoors) · X_σ random variation of several dB · t_ToF one-way time of flight; 1 ns ≈ 30 cm.</p>
<ul><li>Satellite positioning solves for x, y, z and receiver clock bias from at least four satellites’ pseudoranges.</li><li>UWB two-way ranging: t_ToF = (t_round − t_reply)/2.</li></ul>''',
 D='''<p>Each question has a different <strong>trust boundary</strong>. Identity is whatever the broadcaster claims (and can be replayed). Proximity from RSSI is trivially distorted. Location is the finder’s own estimate, which can be wrong or spoofed. UWB ranging can be protected against distance manipulation (802.15.4z secure ranging), but only between devices that already trust each other.</p>''',
 E='''<ul><li>When a report says a device “was at” a place, ask which of the four questions was actually answered, by whom, and how it could be wrong.</li></ul>''',
 eng='<p>The satellites and bars are pictograms. RSSI bars are not calibrated.</p>',
 test=['Does any frame show a tag computing its own map position? (No.)', 'Is UWB described as local, not a map position? (Yes.)'],
 src=['IEEE 802.15.4z-2020 (UWB ranging).', 'Standard GNSS texts (four-satellite pseudorange solution).']),

dict(id=8, title='The wireless map: what each technology is for',
 lede='A single table that later modules keep returning to: power source, band, job, typical range and the privacy note that follows from it.',
 frames=['RFID families: low- and high-frequency RFID identify at a reader; passive UHF RFID inventories at portals; active RFID beacons on site.',
         'NFC, Bluetooth LE and UWB: tap-range transactions, room-range presence and data, and short-range distance and direction.',
         'Wi-Fi/cellular positioning and satellite navigation: the only technologies here that answer “where on Earth?” — for the device doing the receiving.'],
 A=(['Some tags only answer a reader right next to them.', 'Some whisper across a room.', 'Some measure distance very precisely, but only nearby.', 'Only satellite and phone-network positioning can find a place on a map.'],
    'Each wireless technology is good at one job, and only a few can tell where on Earth something is.'),
 B='''<p>Use this map whenever a story fuses technologies together. A card does not “use GPS”; a tracker does not “use NFC to find you across town”; a badge reader does not know where you are except that you were at its door.</p>''',
 C='''<p>Ranges are typical working distances under ordinary conditions, not limits. Each row’s band is approximate; regional regulations differ. See From Tap to Trace, Table 1, for a longer version with common attacks.</p>''',
 D='''<p>The privacy column is the security architect’s summary: <strong>fixed identifiers</strong> are trackable, <strong>radiated broadcasts</strong> are receivable by strangers, <strong>precise local ranging</strong> is powerful for whoever is authorised, and <strong>positioning databases</strong> are built from people’s phones.</p>''',
 E='''<ul><li>Use the map to classify every wireless technology in your estate by what it reveals and to whom, before debating controls.</li></ul>''',
 eng='<p>Bands: LF 125–134 kHz, HF 13.56 MHz, UHF ~860–960 MHz (regional), BLE 2.4 GHz ISM, UWB channels ~6.5/8 GHz, GNSS ~1.2–1.6 GHz.</p>',
 test=['Are ranges labelled typical, not limits? (Yes.)', 'Do only GNSS and network positioning answer “where on Earth”? (Yes.)'],
 src=['<a href="/articles/from-tap-to-trace.html#p2">From Tap to Trace, Part II</a> (sources listed there).']),
])
