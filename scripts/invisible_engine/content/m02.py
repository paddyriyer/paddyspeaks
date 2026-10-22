from .inserts import OVERVIEW, DEMO_A, DEMO_B

M = dict(
    num=2, file='m02.html', title='Passive NFC and the anatomy of a contactless card',
    kicker='Module 2 · The card without a battery',
    dek='A child taps a card at a shop and asks how it works without a battery. The answer runs from a coil of copper to a cryptogram checked by a bank hundreds of kilometres away.',
    prereq='Module 1, especially Scenes 02 (energy vs information) and 04 (induction).',
    scenes=[
dict(id=9, title='Tap at checkout',
 lede='The everyday experience: a card that has no battery approaches a terminal and, a moment later, the screen says Approved.',
 frames=['The card arrives. It has no battery; its chip is inert until a reader is near.',
         'The terminal’s 13.56 MHz magnetic field reaches the card and induces power in its coil.',
         'The terminal sends commands and the card replies — only while the card stays in the field, a few centimetres away.',
         'Approved: usually a decision by the card’s issuer, reached over the payment network, not by the card or terminal alone.'],
 A=(['Mum taps her card on the shop’s machine.', 'The card has no battery inside!', 'The machine makes an invisible magnet that wakes the card up.', 'They talk for a moment.', 'The bank says yes, and the screen says Approved.'],
    'The machine powers the card with an invisible magnet, they talk, and the bank decides whether the payment can go ahead.'),
 B='''<p>Three things happen in the second or so of a tap. The terminal <strong>powers</strong> the card through its magnetic field (Scenes 11–12). Terminal and card <strong>exchange messages</strong>, including a one-time cryptographic value computed by the card (Scenes 13–15). And for most payments the terminal sends that value onward so the card’s issuer can <strong>decide</strong> (Scene 15).</p>
<p><strong>Where the analogy breaks:</strong> the screen’s “Approved” is the end of a chain involving the merchant, its bank (the acquirer), a payment network and the issuer. Some low-value payments can be approved offline by the terminal under rules set in the card; that is a policy choice, not the default picture.</p>''',
 C='''<ul>
<li>Carrier 13.56 MHz; proximity cards specified by ISO/IEC 14443. <span class="tag spec">specification</span></li>
<li>Payment terminals are tested to work reliably only within a few centimetres of the reader surface (EMV contactless test volume, commonly summarised as about 4 cm). <span class="tag verify">verify against EMVCo Book D</span></li>
<li>The exchange: field on → activation and anticollision (ISO/IEC 14443-3) → transport (14443-4) → EMV application selection and transaction (Scene 14).</li>
</ul>''',
 D='''<p>The trust decision is not at the terminal. The terminal is an untrusted relay for the card’s cryptogram; the issuer verifies it. The terminal does have its own security role (certified readers, unpredictable numbers, offline data authentication in some flows), but “Approved” is ultimately an issuer and network decision.</p>''',
 E='''<ul><li>For merchants: terminal certification and tamper protection are your responsibility; card authentication is the issuer’s. Map which party owns which control before an incident, not during it.</li></ul>''',
 eng='<p>Card and terminal are generic and fictional. “BANK” and “•••• 1234” are placeholders.</p>',
 test=['Does the scene suggest the card has a battery? (No.)', 'Is approval attributed to the issuer rather than the card? (Yes, with the offline caveat.)'],
 src=['EMVCo, “EMV Contactless Chip” overview — <a href="https://www.emvco.com/emv-technologies/emv-contactless-chip/">emvco.com</a>.', 'NFC Forum, “NFC technology”.']),

dict(id=10, title='Inside the card',
 lede='Open the card. Most of it is plastic; the working parts are a coil of fine wire or etched track near the edge and a chip module.',
 frames=['The antenna coil: a few turns running near the card’s edge (drawn heavier than real).',
         'The antenna terminals: the coil’s two ends join the chip module.',
         'The chip opened as a block diagram: rectifier and regulator (power), clock recovery, demodulator and load modulator (communication), processor, crypto engine and secure memory (logic and secrets).',
         'Layouts vary: some cards couple the module to the card’s coil through a small coil on the module instead of wires.'],
 A=(['Inside the card is a loop of very thin wire.', 'The loop is joined to a tiny chip.', 'The chip has parts that make power, parts that talk, and a secret locked box.', 'The secret never leaves the box.'],
    'A card is a loop of wire that catches power and a tiny chip that uses it to talk and keep a secret.'),
 B='''<p>The <strong>coil</strong> is the card’s antenna and its power supply: the reader’s field induces an alternating voltage in it. The <strong>chip</strong> turns that into a steady supply, recovers a clock from the 13.56 MHz carrier, listens for commands, answers by switching its load, and runs a small secure processor that holds the card’s keys and the payment application.</p>
<p><strong>Where the analogy breaks:</strong> the block names are generic. Real payment chips integrate these functions differently and add security sensors (light, voltage, clock) and countermeasures.</p>''',
 C='''<ul>
<li>Card format ID-1: 85.60 × 53.98 mm (ISO/IEC 7810). <span class="tag spec">specification</span></li>
<li>The coil and the chip’s input capacitance form a resonant circuit tuned near 13.56 MHz (often slightly above, to allow for detuning). <span class="tag concept">conceptual</span></li>
<li>Dual-interface cards also expose ISO/IEC 7816 contacts; the same secure element serves both interfaces.</li>
<li>Coil-on-module designs couple a small module coil inductively to a larger card coil, avoiding a soldered connection.</li>
</ul>''',
 D='''<p>The <strong>secure memory and crypto engine</strong> form the card’s trust anchor: keys are generated or injected at personalisation and are not meant to be exportable. Everything else on the chip — power, clock, communications — is attack surface for fault and side-channel attacks, which certified payment chips are evaluated against.</p>''',
 E='''<ul><li>For your own access or loyalty cards, ask whether the chip is a certified secure element and what evaluation it passed; a cheap memory tag with an ID is a different class of product.</li></ul>''',
 eng='<p>Not to scale. The chip contact plate is drawn to show position, not the ISO/IEC 7816 contact layout exactly.</p>',
 test=['Are block names marked generic? (Yes.)', 'Are layout variations acknowledged? (Yes, frame 4.)'],
 src=['ISO/IEC 7810 (card dimensions); ISO/IEC 7816 (contacts); ISO/IEC 14443 (contactless).']),

dict(id=11, title='The reader makes the field',
 lede='All the energy comes from the reader. Inside the terminal, an oscillator, a modulator, an amplifier and a matching network drive the reader’s coil.',
 frames=['Inside the reader: oscillator (13.56 MHz) → modulator (adds commands) → amplifier → matching network.',
         'An alternating current flows in the reader’s antenna coil, reversing 13.56 million times a second.',
         'The resulting magnetic field reaches a few centimetres; ISO/IEC 14443 sets it between about 1.5 and 7.5 A/m (unmodulated) for proximity cards.'],
 A=(['The machine has a tiny engine that wiggles electricity very fast.', 'The wiggling electricity goes round a loop of wire.', 'That makes an invisible magnet just above the machine.', 'A card in that spot can catch some of its energy.'],
    'The reader makes an invisible, fast-flipping magnet, and a card held close can catch its energy.'),
 B='''<p>A <strong>reader</strong> (a payment terminal, a door reader or a phone in reader mode) generates the 13.56 MHz carrier, amplifies it and drives its own coil. The changing current makes a changing magnetic field; that field is both the card’s power supply and the reader’s channel for commands. The card does not generate a carrier of its own.</p>''',
 C='''<ul>
<li>Field strength for ISO/IEC 14443 proximity coupling: H between about 1.5 A/m (minimum the card must work at) and 7.5 A/m (maximum the reader may produce), unmodulated. <span class="tag spec">specification, secondary summary</span></li>
<li>Matching network: transforms the antenna’s impedance to the amplifier’s and sets the antenna circuit’s Q (bandwidth vs efficiency).</li>
<li>Phones acting as readers produce weaker fields than countertop terminals, one reason phone-to-card distances are shorter.</li>
</ul>''',
 D='''<p>Any device that can generate a compliant field can power and interrogate a card. Readers are commodity hardware. The security of a contactless system therefore cannot depend on “only legitimate readers can talk to the card”.</p>''',
 E='''<ul><li>Physical controls on terminals (tamper evidence, certification, inventory) protect the merchant’s side; they do not stop other readers existing.</li></ul>''',
 eng='<p>Block diagram only; real reader ICs integrate oscillator, modulator, driver and receiver.</p>',
 test=['Does the card appear to transmit a carrier? (No.)', 'Is the field visual labelled illustrative? (Yes.)'],
 src=['ISO/IEC 14443-2 field-strength limits, as summarised by Rohde &amp; Schwarz application note 1MA113 and others.']),

dict(id=12, title='How the chip wakes up without a battery',
 lede='Follow the energy, stage by stage, from the reader’s field to a running chip.',
 frames=['A changing field from the reader passes through the card’s coil.',
         'The coil gets an induced alternating voltage: v = −N·dΦ/dt.',
         'A rectifier lets current through in one direction only, turning AC into pulsing DC.',
         'A storage capacitor smooths it and a regulator holds a steady supply rail, shunting the excess.',
         'The chip runs: clock, logic and cryptography. How much power arrives depends on distance, alignment, coil size, tuning and the chip’s own load.'],
 A=(['The magnet wiggles electricity in the card’s loop.', 'A one-way gate lets it flow only one way.', 'A tiny store smooths it out.', 'Now the chip has steady power and wakes up.'],
    'The card turns the reader’s wiggling magnet into steady electricity, and that wakes the chip.'),
 B='''<p>The coil’s voltage alternates; chips need steady DC. A <strong>rectifier</strong> (diodes or transistors acting as one-way valves) flips the negative half-cycles, a <strong>capacitor</strong> stores charge between peaks, and a <strong>regulator</strong> holds the voltage steady and throws away excess when the card is very close. The chip also recovers its clock from the carrier, so it runs in step with the reader.</p>
<p><strong>Where the analogy breaks:</strong> “closer is always better” is false. Very close coupling can detune both circuits; metal nearby, a second card or a phone case can absorb or distort the field. That is why the same card works at one angle and not another.</p>''',
 C='''<ul>
<li>Induced EMF: v = −N·dΦ/dt; for sinusoidal flux the amplitude is N·ω·Φ₀.</li>
<li>Available power depends on mutual coupling, Q of both circuits and the chip’s load; the chip’s current rises when it computes, which the reader sees as extra loading.</li>
<li>No calibrated watts are shown in this lesson: the figures vary by reader, card, position and chip activity. <span class="tag illus">qualitative</span></li>
<li>Demo A, below, lets you move a card and see coupling change qualitatively.</li>
</ul>''',
 D='''<p>Because power arrives only while the card is in the field, a card cannot run anything in the background; each transaction starts from a cold reset. That makes per-transaction counters (Scene 15) the card’s main memory of what has happened, and makes power-glitch fault injection a classic attack class that secure chips defend against.</p>''',
 E='''<ul><li>Physical attacks on cards require possession; treat lost or stolen card reporting as a security control in its own right.</li></ul>''',
 eng='<p>Waveforms are idealised. A real rectifier output has ripple and the regulator a dropout; these are not drawn to scale.</p>',
 test=['Is “closer is always better” refuted? (Yes.)', 'Are any calibrated power numbers shown? (No.)'],
 src=['Finkenzeller, <em>RFID Handbook</em> (power supply of passive transponders).']),

dict(id=13, title='How the reader talks — and how the card answers without a transmitter',
 lede='The reader speaks by dipping its field. The card answers by changing how much energy it absorbs.',
 frames=['Reader → card: the reader briefly reduces its field to send bits (amplitude-shift keying).',
         'The card’s demodulator turns those dips into command bits for its processor.',
         'Card → reader: the card switches an extra load on and off at an 847.5 kHz subcarrier, changing how much energy it absorbs. It never makes its own carrier.',
         'The reader sees tiny changes in its own coil, which appear as sidebands either side of the 13.56 MHz carrier.'],
 A=(['The reader talks by making its magnet weaker for tiny moments.', 'The card notices the blinks and reads them as a message.', 'To answer, the card takes a little more or a little less energy.', 'The reader feels the difference — like noticing someone tugging on a rope.'],
    'The reader blinks its magnet to talk, and the card answers by tugging on the energy in different rhythms.'),
 B='''<p><strong>Downlink:</strong> to send a 0 or 1, the reader modulates the amplitude of its field: Type A cards see short pauses (100 % amplitude-shift keying with modified Miller coding); Type B cards see a small dip of about 10 % (NRZ coding).</p>
<p><strong>Uplink:</strong> a passive card has no transmitter. It switches a resistor or capacitor in and out across its coil in a rhythm — <strong>load modulation</strong>. Because the card and reader coils are coupled, the reader’s coil voltage changes slightly in the same rhythm, and the reader decodes it.</p>
<p><strong>Where the analogy breaks:</strong> the effect is tiny compared with the carrier, which is why the card switches at a subcarrier frequency: it moves the answer away from the strong carrier so the reader can filter it out.</p>''',
 C='''<ul>
<li>Base data rate 106 kbit/s ≈ 13.56 MHz / 128; higher rates (212, 424, 848 kbit/s) exist. <span class="tag spec">specification</span></li>
<li>Subcarrier f_c / 16 = 847.5 kHz; the reader detects sidebands at 13.56 MHz ± 847.5 kHz.</li>
<li>Card-to-reader coding: Manchester on-off keying of the subcarrier (Type A, 106 kbit/s) and BPSK (Type B), as summarised by independent sources. <span class="tag verify">verify against ISO/IEC 14443-2</span></li>
<li>Some literature calls HF load modulation “backscatter”; strictly, backscatter describes reflected far-field UHF signals. This lesson keeps the terms apart.</li>
</ul>''',
 D='''<p>Load modulation is detectable by anyone close enough with a suitable antenna, not only by the reader, so the uplink must be treated as public. Anything confidential must be protected at a higher layer. Most payment data elements are not encrypted on the air; the cryptogram protects against copying, not against reading.</p>''',
 E='''<ul><li>Assume card-reader traffic can be recorded nearby. Controls should prevent it from being <em>reused</em>, rather than assume it cannot be heard.</li></ul>''',
 eng='<p>Waveform and spectrum are schematic; the sidebands are many orders of magnitude weaker than the carrier and their heights are not to scale.</p>',
 test=['Does the card appear to transmit a carrier? (No: stated in frame 3.)', 'Is “backscatter” distinguished from HF load modulation? (Yes, in C.)'],
 src=['ISO/IEC 14443-2 parameters as summarised by independent sources (e.g. Rohde &amp; Schwarz 1MA113); Finkenzeller, <em>RFID Handbook</em>.']),

dict(id=14, title='Layers of agreement: from radio to payment',
 lede='Contactless payment is a stack of standards. Each layer assumes the one beneath it works and adds one kind of agreement.',
 frames=['ISO/IEC 14443-2 radio: the field comes on, carrying power and modulation.',
         'ISO/IEC 14443-3 activation: the reader asks who is there (REQA/WUPA), a card answers (ATQA), anticollision selects one card by its identifier (SELECT/UID), and the card confirms (SAK). This is the Type A sequence.',
         'ISO/IEC 14443-4 transport: the reader requests and the card returns transport parameters (RATS/ATS); reliable message blocks follow.',
         'EMV application: the terminal selects the payment environment (PPSE) and an application (AID), sends terminal data including the amount and an unpredictable number (GET PROCESSING OPTIONS), and receives card data and a cryptogram.',
         'Illustrative, not a packet trace: Type B uses different activation commands, and the EMV steps depend on the payment network’s contactless kernel.'],
 A=(['First the reader and card agree how to talk.', 'Then the reader picks one card, even if two are near.', 'Then they agree how to send longer messages.', 'Finally they do the payment.'],
    'Like learning to speak, then saying hello, then holding a conversation, a card and reader agree on each step before paying.'),
 B='''<p>Standards are layered so that each can change independently. The radio layer (14443-2) does not know about payments; the activation layer (14443-3) makes sure exactly one card is talking; the transport layer (14443-4) carries larger messages reliably; and the EMV application layer, defined by EMVCo and the payment networks, runs the transaction.</p>
<p><strong>Where the analogy breaks:</strong> the sequence shown is a simplified Type A example. Real transactions differ by card type, network kernel and terminal configuration.</p>''',
 C='''<ul>
<li>Type A: REQA/WUPA → ATQA → anticollision loop over UID cascade levels → SELECT → SAK → RATS → ATS. <span class="tag spec">specification</span></li>
<li>EMV: SELECT “2PAY.SYS.DDF01” (PPSE) returns the list of payment applications; SELECT AID chooses one; GET PROCESSING OPTIONS passes data requested in the card’s PDOL (amount, currency, unpredictable number…); READ RECORD may follow; the cryptogram appears in the GPO response or a GENERATE AC response depending on the kernel (EMV Contactless Book C-x).</li>
<li>Messages above 14443-4 are APDUs (ISO/IEC 7816-4 format).</li>
</ul>''',
 D='''<p>The UID used for anticollision is a <strong>radio-layer identifier</strong>. Many payment cards use a random UID per session to avoid being a stable tracking identifier, but not every contactless card does; access badges and transit cards often expose a fixed UID. Never use the UID as an authenticator: it is broadcast in the clear and easily emulated.</p>''',
 E='''<ul><li>Audit any internal system that authorises on a card’s UID alone (common in older door systems). That is identification without authentication.</li></ul>''',
 eng='<p>Message names follow ISO/IEC 14443-3/-4 and EMV terminology. Arrow colours: energy (field on), radio-layer signalling, application data, cryptographic payload.</p>',
 test=['Is the sequence labelled illustrative and kernel-dependent? (Yes.)', 'Is UID-as-authenticator warned against? (Yes.)'],
 src=['ISO/IEC 14443-3 and -4; EMVCo Contactless Specifications (Book A, B and kernel books C-x) — see emvco.com.']),

dict(id=15, title='The cryptogram: a fresh proof for every payment',
 lede='The card proves it holds a secret key without ever revealing it, by computing a one-time value over this transaction’s data. The issuer checks it.',
 frames=['The terminal sends terminal data: amount, currency, date and an unpredictable number.',
         'Inside the card: terminal data + the card’s transaction counter (ATC) + its secret key → a cryptogram. The key never leaves the card.',
         'The cryptogram and transaction data travel from terminal to acquirer to payment network to issuer as an authorisation request.',
         'The issuer derives the same card key, recomputes the cryptogram, checks the counter, limits and risk, and returns approve or decline.',
         'Not a reusable password: a copied cryptogram fails the counter and unpredictable-number checks, and the merchant never learns the key.'],
 A=(['The shop machine tells the card about the payment and gives it a surprise number.', 'The card mixes these with its secret to make a special code.', 'The code travels to the card’s bank.', 'The bank, which knows the secret too, checks the code.', 'Next time the code will be different, so copying it is useless.'],
    'The card makes a new secret code for every payment, and only the bank can check it, so a copied code is useless.'),
 B='''<p>A <strong>cryptogram</strong> here is a short value computed with a secret key over the transaction’s details. Because it includes the amount, an unpredictable number from the terminal and a counter that increases every time, it is different for every payment. The issuer, which can derive the same key, recomputes it and compares.</p>
<p><strong>Where the analogy breaks:</strong> this proves the genuine card took part in <em>this</em> transaction; it does not make the payment private (Scene 17), and it does not prove the person holding the card is the cardholder unless a PIN or device authentication is also used.</p>''',
 C='''<ul>
<li>Cryptogram types: ARQC (authorisation request cryptogram, online), TC (transaction certificate), AAC (decline). <span class="tag spec">specification</span></li>
<li>Session key derived from a card master key (itself derived from an issuer master key and the card’s identity) and the ATC; algorithm historically 3DES, with AES supported in newer specifications.</li>
<li>Input data typically include amount, currency, country, date, transaction type, unpredictable number and ATC, as listed in the card’s data-object lists. <span class="tag spec">kernel-dependent</span></li>
<li>Offline data authentication (e.g. fDDA, CDA) uses RSA certificates so a terminal can check the card is genuine without going online.</li>
</ul>''',
 D='''<p>Trust boundaries: the <strong>card</strong> holds a symmetric key it shares (by derivation) with the <strong>issuer</strong>; the terminal, acquirer and network carry the cryptogram but cannot create one. The terminal’s <strong>unpredictable number</strong> is what prevents pre-computation; research has shown that terminals with weak random number generators enable “pre-play” attacks. Offline authentication rests on an RSA certificate chain — a classical public-key dependency relevant to Module 10.</p>''',
 E='''<ul>
<li>Merchants: keep terminals certified and patched; weak terminal randomness has been a real-world weakness (historical research).</li>
<li>Issuers: monitor counter anomalies and cryptogram failures; they are the signal of cloning or relay attempts.</li>
</ul>''',
 eng='<p>Party icons are generic. Arrows: plaintext terminal data (green), cryptographic payload (purple), plaintext response (green). The response may also carry an issuer cryptogram (ARPC) to the card; omitted for clarity.</p>',
 test=['Is the cryptogram described as symmetric (card–issuer), not public-key? (Yes.)', 'Is the acquirer shown? (Yes.)', 'Does it claim privacy? (No: Scene 17.)'],
 src=['EMVCo Book 2 (Security and Key Management) and contactless kernel specifications.', 'M. Bond et al., “Chip and Skim: cloning EMV cards with the pre-play attack”, IEEE S&amp;P 2014 (historical).']),

dict(id=16, title='A plastic card and a phone wallet are different credentials',
 lede='Tapping a phone and tapping a plastic card look the same at the till. Underneath, they present different credentials and protect them differently.',
 frames=['Plastic contactless card: the chip holds the card number (PAN) and the card’s keys; the terminal receives the card number and a fresh cryptogram.',
         'Phone wallet (Apple Pay as the documented example): the secure element holds a device token — Apple calls it the Device Account Number — and keys for per-transaction cryptograms, released only after the user authenticates.',
         'The payment network’s token service maps the token to the card account for the issuer, and can suspend one device’s token without replacing the card.',
         'Who still sees the payment, in both cases: the merchant sees amount, time and a card or token number; the network routes it; the issuer sees the full transaction. Contactless is not anonymous.'],
 A=(['A plastic card tells the shop its real card number, plus a fresh secret code.', 'A phone wallet uses a stand-in number instead of the real one.', 'And the phone only pays after you show your face, finger or passcode.', 'The bank still knows what you bought either way.'],
    'A phone wallet hides your real card number behind a stand-in and checks it is you, but the bank still sees the payment.'),
 B='''<p>Both credentials produce a fresh cryptogram for each payment. The differences are <strong>what number travels</strong> and <strong>what gates the key</strong>. A plastic card gives the terminal its real card number (PAN). A wallet gives a <strong>token</strong> bound to that phone, which is useless if copied to another device, and releases its cryptogram only after biometric or passcode authentication on the phone.</p>
<p><strong>Where the analogy breaks:</strong> tokenisation applies to supported wallets and some card-on-file services; it is not a property of every plastic card. Wallet designs differ by vendor; Apple’s is described here because it is documented.</p>''',
 C='''<ul>
<li>Apple documents that payment transactions from the secure element carry a Device Account Number and a payment cryptogram computed from a transaction counter and a key, and that the secure element releases them only after the Secure Enclave confirms user authentication. <span class="tag doc">manufacturer documented</span></li>
<li>Token service providers (typically the payment networks) map tokens to PANs under the EMV Payment Tokenisation framework.</li>
<li>Small plastic-card payments may not require cardholder verification below a regional limit; wallets verify the user on the device for every payment.</li>
</ul>''',
 D='''<p>Trust boundaries differ: for plastic, the card chip is the only secure component; for a wallet, the <strong>secure element</strong> holds keys and the <strong>Secure Enclave</strong> (or equivalent) authorises use, with the token service as an external dependency. A wallet token limits the damage of a merchant breach (the token is device-bound) but adds account and device lifecycle risks: lost phones, re-provisioning, account recovery.</p>''',
 E='''<ul>
<li>Corporate cards in employee wallets: include token suspension in the lost-device and offboarding process.</li>
<li>Do not describe either credential as anonymous in policy or customer communications.</li>
</ul>''',
 eng='<p>Phone and wallet drawing are generic. “SE” = secure element. The grey dashed arrow is an administrative mapping relationship, not a data path at tap time.</p>',
 test=['Is tokenisation scoped to wallets (not universal for plastic cards)? (Yes.)', 'Does the scene ever call a contactless payment private? (No: explicitly denied.)', 'Is Apple named as the documented example, with other wallets varying? (Yes.)'],
 src=['Apple Platform Security, “Apple Pay component security” — <a href="https://support.apple.com/guide/security/secc1f57e189/web">support.apple.com</a>.', 'EMVCo, EMV Payment Tokenisation framework — emvco.com.']),

dict(id=17, title='What contactless does not promise — and the layers that defend it',
 lede='Dynamic cryptograms solve one problem: copying. They do not make payments private, do not stop relays by themselves, and are unrelated to a different risk, malicious NFC tags.',
 frames=['Visible to the payment chain: merchant, acquirer, network and issuer see transaction data. Cryptograms stop copying; they do not make the payment private.',
         'Relay (hazard, conceptual): two devices forward the exchange between a card and a distant terminal so that “a few centimetres” stops being true. Defences: timing checks, limits, issuer risk scoring.',
         'Skimming at centimetres: a nearby reader can read some card data but cannot invent future cryptograms without the card’s key; weak terminal randomness was a past research finding.',
         'A different risk: a sticker’s NDEF record can send a phone to a fake web page. It targets the person tapping, not the card.',
         'Layered defences: keys and counters, phone authentication, certified terminals, issuer risk scoring and limits, token suspension, and prompt reporting of lost cards.'],
 A=(['The shop and the bank can see what you bought.', 'A trickster could try to pass a tap along a long way — banks check timing and limits.', 'Someone very close could read part of the card, but not its secret.', 'Sticky NFC labels can open fake websites — check before you type anything.', 'Lots of small protections work together.'],
    'Contactless payments are protected in several layers, but they are not secret from the shop and bank, and you should still be careful what you tap.'),
 B='''<p><strong>Privacy:</strong> a payment is a record shared by several organisations. Cryptograms stop a copied card from working; they do not hide who paid, where or for what.</p>
<p><strong>Relay:</strong> short range is a property of the radio, not a security check. An attacker with two linked devices can, in principle, stretch the exchange. Payment systems respond with transaction limits, issuer risk scoring and, in some specifications, timing checks that measure how long the card takes to reply.</p>
<p><strong>Malicious tags:</strong> an NFC sticker is a different object from a payment card. It cannot take money from a card; its risk is social engineering — a link that looks official.</p>''',
 C='''<ul>
<li>Mastercard specifies a Relay Resistance Protocol in which the reader times a nonce exchange with the card; independent researchers report it has been in the specifications since 2016 with limited deployment at the time of their work, and have analysed and implemented relay-resistant variants. <span class="tag demo">independently demonstrated</span></li>
<li>Pre-play attacks exploited predictable unpredictable numbers in some terminals (2014). <span class="tag hist">historical</span></li>
<li>NDEF (NFC Data Exchange Format) records can carry URIs that a phone offers to open; modern phones show the address first.</li>
</ul>''',
 D='''<p>Separate the threat classes: <strong>data visibility</strong> (governance, not cryptography), <strong>relay</strong> (distance assurance), <strong>skimming</strong> (static data exposure; dynamic data protected), <strong>malicious tags</strong> (phishing), <strong>stolen cards</strong> (cardholder verification and limits) and <strong>compromised terminals</strong> (merchant security). Each has a different owner.</p>''',
 E='''<ul>
<li>Owners: issuer (risk scoring, limits, monitoring), network (specifications, token service), merchant (terminal security), cardholder (reporting), employer (awareness about NFC phishing in the office).</li>
<li>Residual risk: limits cap damage; they do not remove it. Track contactless fraud as its own metric.</li>
</ul>''',
 eng='<p>Red dashed outlines mark hazard zones. No step in this scene is instructional.</p>',
 test=['Is relay described conceptually with no operational detail? (Yes.)', 'Is malicious-tag risk kept separate from payment card risk? (Yes.)', 'Is any vulnerability stated as current without patch status? (No: pre-play is labelled historical.)'],
 src=['I. Boureanu et al., “Security Analysis and Implementation of Relay-Resistant Contactless Payments”, ACM CCS 2020.', 'A. Radu et al., “Practical EMV Relay Protection”, IEEE S&amp;P 2022.', 'M. Bond et al., “Chip and Skim”, IEEE S&amp;P 2014.']),
])

BEFORE = OVERVIEW
INSERTS = {12: DEMO_A, 16: DEMO_B}
SCRIPTS = ['/invisible-engine/demos/coil.js', '/invisible-engine/demos/wallet.js']
