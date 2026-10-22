from .inserts import DEMO_I

# Sources used across the module.
NC = 'M. A. Nielsen and I. L. Chuang, <em>Quantum Computation and Quantum Information</em>, 10th anniversary edition, Cambridge University Press, 2010.'
GROVER = 'L. K. Grover, “A fast quantum mechanical algorithm for database search”, STOC 1996 — <a href="https://arxiv.org/abs/quant-ph/9605043">arXiv:quant-ph/9605043</a>.'
SHOR = 'P. W. Shor, “Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms on a Quantum Computer”, SIAM J. Comput. 1997 (FOCS 1994) — <a href="https://arxiv.org/abs/quant-ph/9508027">arXiv:quant-ph/9508027</a>.'
FIPS = 'NIST, FIPS 203 (ML-KEM), FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA), August 2024 — <a href="https://csrc.nist.gov/projects/post-quantum-cryptography">csrc.nist.gov/projects/post-quantum-cryptography</a>.'
IR8547 = 'NIST IR 8547, “Transition to Post-Quantum Cryptography Standards” (initial public draft, November 2024) — <a href="https://csrc.nist.gov/pubs/ir/8547/ipd">csrc.nist.gov</a> (check current status).'
WILLOW = 'Google Quantum AI and collaborators, “Quantum error correction below the surface code threshold”, <em>Nature</em> (2024) — <a href="https://www.nature.com/articles/s41586-024-08449-y">nature.com</a> (verify).'
GE19 = 'C. Gidney and M. Ekerå, “How to factor 2048 bit RSA integers in 8 hours using 20 million noisy qubits”, 2019 — <a href="https://arxiv.org/abs/1905.09749">arXiv:1905.09749</a>.'
G25 = 'C. Gidney, “How to factor 2048 bit RSA integers with less than a million noisy qubits”, 2025 — <a href="https://arxiv.org/abs/2505.15917">arXiv:2505.15917</a> (verify).'
BELL = 'J. S. Bell, “On the Einstein Podolsky Rosen paradox”, Physics 1, 195 (1964); for no-signalling see Nielsen &amp; Chuang §2.6 and Box 2.7.'
FTT9 = '<a href="/articles/from-tap-to-trace.html#p9">From Tap to Trace, Part IX</a> (which locks might eventually fail).'
DEMO_H_LINK = '<a href="/invisible-engine/m08.html#demo-h">demo H in Module 8</a>'

M = dict(
    num=9, file='m09.html', title='Quantum computation, hardware and algorithms',
    kicker='Module 9 · What a quantum computer can and cannot do',
    dek='Two entangled qubits, four drawers searched in one round, a number factored by finding a rhythm, and the cold, noisy machines that would have to run it all at scale. Then the honest link to security: which locks would fail, which only weaken, and why none has failed yet.',
    prereq='Module 8 (amplitudes, the Born rule, the Hadamard and Z gates, and interference in H–Z–H).',
    scenes=[

dict(id=65, title='Entanglement: two qubits, one shared story',
 lede='Two qubits, two gates, and a state that cannot be described one qubit at a time. Measure one and you know the other — yet no message can travel this way.',
 frames=['The recipe: two qubits start at 0; a Hadamard on the first, then a CNOT with the first as control.',
         'After the Hadamard: amplitudes 0.707, 0, 0.707, 0 for 00, 01, 10, 11 — the qubits are not yet linked.',
         'After the CNOT: amplitudes 0.707 for 00 and 11, zero for 01 and 10; probabilities one half each. This is the Bell state (|00⟩ + |11⟩)/√2.',
         'Ten simulated runs of preparing and measuring it: the two results always agree, while each qubit on its own looks random.',
         'No faster-than-light messages: each side’s own results stay 50/50 whatever the other side does; the agreement shows only when the lists are compared over an ordinary channel.'],
 A=(['Two magic coins are made together.', 'You and a friend each take one far away.', 'You flip yours: heads! Your friend’s also says heads.', 'Every time, they match — but which side comes up is random.', 'So you cannot use them to send a secret message.'],
    'Entangled qubits always agree when measured, but because each result is random, they cannot carry a message on their own.'),
 B='''<p>A <strong>CNOT</strong> gate flips its second qubit only when the first is 1. Feed it a first qubit that is an even mix of 0 and 1 (made by H) and the pair ends up in a combined state: <em>both 0</em> or <em>both 1</em>, with equal amplitude. Neither qubit has its own value until measured; what is fixed is the relationship between them.</p>
<p><strong>Where the analogy breaks:</strong> magic coins suggest each coin secretly decided before it was flipped. Experiments that test Bell inequalities rule out that kind of hidden, pre-decided local explanation; the correlation is stronger than any such coins could give, which only shows when you measure in different bases.</p>''',
 C='''<p class="eq">CNOT · (H ⊗ I) |00⟩ = (|00⟩ + |11⟩) / √2</p>
<ul>
<li>P(00) = P(11) = |1/√2|² = 1/2; P(01) = P(10) = 0. Computed with a two-qubit statevector simulation for the scene. <span class="tag calc">computed</span></li>
<li>The reduced state of either qubit alone is maximally mixed: its own outcomes are 50/50 whatever operation is applied to the other qubit (no-signalling). <span class="tag spec">theorem</span></li>
<li>Entanglement is a resource for teleportation, superdense coding and many algorithms; it never transmits information without a classical channel. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>For security architecture the takeaway is narrow: entanglement does not create a covert faster-than-light channel, and quantum key distribution (a separate technology, not covered here) still needs an authenticated classical channel. Treat claims of “instant, untappable” links with the same scrutiny as any other channel claim.</p>''',
 E='''<ul><li>Vendor material that says entanglement “sends data instantly” is wrong; use it as a signal to scrutinise the rest of the claims.</li></ul>''',
 eng='<p>The ten runs are sampled from the computed probabilities with a fixed seed, so the picture is reproducible; a real device adds noise (Scene 70).</p>',
 test=['Does the scene say entanglement sends messages? (No; frame 5 states the no-signalling result.)', 'Are amplitudes and probabilities shown separately? (Yes, frame 3.)'],
 src=[NC, BELL]),

dict(id=66, title='Grover with four drawers: making the right answer loud',
 lede='Grover’s algorithm does not look in every drawer at once. It nudges amplitudes so that the right drawer’s grows and the others shrink. With four drawers, one round is enough.',
 frames=['Four drawers, one prize. The register starts with equal amplitudes of 0.5; each drawer has probability 0.25.',
         'The oracle marks the prize by flipping the sign of its amplitude to −0.5. The probabilities do not change yet.',
         'The mean amplitude is now 0.25. Each amplitude is reflected about the mean: a becomes 2 × mean − a.',
         'After one round the prize drawer’s amplitude is 1 and the others 0: measuring finds the prize with certainty.',
         'Scaling: about (π/4)√N rounds for N items, with the success probability shown, against N/2 looks on average for a classical search. Four items is a teaching case.'],
 A=(['There are four drawers and one has a prize.', 'A helper can only say “warmer” by flipping a sign.', 'A clever trick makes the prize drawer get louder.', 'After one go, only the prize drawer is loud.', 'With many more drawers you need more goes — but far fewer than looking in each one.'],
    'Grover makes the right answer louder step by step, so you need far fewer tries than opening every drawer.'),
 B='''<p>Two moves repeat. The <strong>oracle</strong> recognises the answer and flips the sign of its amplitude — invisible to a measurement, because probabilities are squares. The <strong>diffusion</strong> step reflects every amplitude about their average, which turns the hidden sign into a larger amplitude for the marked item. Repeat about (π/4)√N times and the marked item dominates.</p>
<p><strong>Where the analogy breaks:</strong> four drawers make it look like a one-step trick. For larger N it takes many rounds, overshooting is possible (too many rounds makes it worse), and the oracle must be built as a quantum circuit, which can be expensive.</p>''',
 C='''<p class="eq">a ↦ 2⟨a⟩ − a ; &nbsp; P(success after k rounds) = sin²((2k + 1)θ), sin θ = 1/√N</p>
<ul>
<li>N = 4: start 1/2 each; oracle gives (1/2, 1/2, −1/2, 1/2); mean 1/4; after diffusion (0, 0, 1, 0). <span class="tag calc">computed</span></li>
<li>Optimal number of rounds ≈ (π/4)√N; the quadratic speedup is provably optimal for unstructured search. <span class="tag spec">theorem</span></li>
<li>Table values (rounds and success probability for N = 64, 1,024 and 1,048,576) computed from the formula above. <span class="tag calc">computed</span></li>
</ul>''',
 D='''<p>Grover’s bound is why symmetric keys are not “broken” by quantum computing: brute force over a k-bit key drops, in an idealised count, from about 2<sup>k</sup> to about 2<sup>k/2</sup> sequential quantum operations, each a full error-corrected run of the cipher (Scene 72).</p>''',
 E='''<ul><li>For long-lived data, prefer 256-bit symmetric keys; there is no need to replace AES itself.</li></ul>''',
 eng='<p>The drawn values come from exact arithmetic in the scene generator; demo I lets you pick the marked drawer and step through the same two moves.</p>',
 test=['Is it claimed that all drawers are read at once? (No; the subtitle says the opposite.)', 'Are signed amplitudes and probabilities both shown? (Yes, in every stage.)', 'Is N = 4 called a teaching case? (Yes, frame 5.)'],
 src=[GROVER, NC]),

dict(id=67, title='Shor, intuitively: find the rhythm, then the factors',
 lede='Shor’s algorithm factors a number by finding the period of a simple sequence. A quantum computer finds the period; ordinary arithmetic turns it into factors. Here with N = 15.',
 frames=['The task: factor N = 15 using a = 7, which shares no factor with 15.',
         'The powers of 7 modulo 15 — 1, 7, 4, 13, 1, 7, 4, 13, … — repeat with period r = 4.',
         'After the quantum Fourier transform, a 4-qubit register gives only y = 0, 4, 8 or 12, each with probability 0.25: the transform concentrates information about the period.',
         'Ordinary arithmetic: y/16 approximates k/r; some outcomes reveal r = 4, others are useless and the run repeats. Then gcd(7² − 1, 15) = 3 and gcd(7² + 1, 15) = 5.',
         'What it is not: it does not try every factor at once; success is probabilistic; and real RSA keys need a large fault-tolerant quantum computer, which is not publicly known to exist.'],
 A=(['Some number patterns repeat like a song’s beat.', 'If you know the beat, you can split a big number into its parts.', 'A quantum computer is good at hearing the beat.', 'A normal computer then does easy sums to find the parts.', 'For the numbers that protect the internet, nobody has a big enough quantum computer yet.'],
    'Shor’s trick turns factoring into finding a repeating beat, which a big enough quantum computer could hear.'),
 B='''<p>Factoring is hard for ordinary computers. Shor noticed it can be turned into a different problem: find how often the sequence a<sup>x</sup> mod N repeats. A quantum computer can prepare a superposition over many x, compute the sequence, and then apply a <strong>quantum Fourier transform</strong>, which makes measurement outcomes cluster at multiples of 1/r. A few samples and some classical arithmetic give r, and from r the factors.</p>
<p><strong>Where the analogy breaks:</strong> “hearing the beat” makes it sound instant. Each run yields one sample; some samples are useless; and for a 2048-bit RSA key the circuit is enormous, which is why resource estimates matter (Scene 72).</p>''',
 C='''<p class="eq">f(x) = a<sup>x</sup> mod N, &nbsp; f(x + r) = f(x); &nbsp; N = gcd(a<sup>r/2</sup> − 1, N) · gcd(a<sup>r/2</sup> + 1, N) when r is even and a<sup>r/2</sup> ≢ −1</p>
<ul>
<li>7<sup>x</sup> mod 15 for x = 0…11 and the 16-point Fourier transform of the period-4 pattern are computed exactly by the scene generator. <span class="tag calc">computed</span></li>
<li>Outcomes y = 4 and 12 give r = 4 by continued fractions; y = 8 gives r = 2 (fails the check); y = 0 gives nothing — so runs repeat. <span class="tag calc">computed</span></li>
<li>The same period-finding solves discrete logarithms, including on elliptic curves. <span class="tag spec">Shor 1994/1997</span></li>
<li>Factoring 15 has been demonstrated on small devices with simplified (“compiled”) circuits; those demonstrations do not scale to cryptographic sizes. <span class="tag hist">historical</span></li>
</ul>''',
 D='''<p>Shor’s exponential speedup is what puts RSA and elliptic-curve cryptography on a migration plan. It applies to the public-key operations — key exchange and signatures — not to symmetric ciphers or hashes.</p>''',
 E='''<ul><li>Inventory where RSA and elliptic-curve keys protect data that must stay secret for many years; those are first in line for migration (Module 10).</li></ul>''',
 eng='<p>The QFT bars are computed for the post-measurement state with x ∈ {0, 4, 8, 12} in a 16-element register. A full implementation also needs the modular-exponentiation circuit, omitted here.</p>',
 test=['Does the scene say Shor tries all factors at once? (No.)', 'Is success presented as probabilistic, with repeats? (Yes, frames 4–5.)', 'Is anything described as already broken? (No.)'],
 src=[SHOR, NC, FTT9]),

dict(id=68, title='Gates and circuits: reversible steps, then one irreversible look',
 lede='A quantum program is a circuit: wires for qubits, boxes for gates, read left to right, ending in measurements. Every ideal gate can be undone. Measurement cannot.',
 frames=['A gallery of gates with their matrices: X swaps 0 and 1; Z flips the sign of the 1 part; H makes an even mix; CNOT flips a target when the control is 1; a controlled phase adds a phase when both are 1.',
         'Ideal gates are unitary, so they can be undone: H followed by H gives the identity (computed).',
         'A two-qubit circuit drawn on wires, read left to right: H, then CNOT, then Z.',
         'Measurement is separate: it turns each qubit into one classical bit (double lines) and cannot be undone.',
         'Try it yourself: demo H in Module 8 runs these gates and shows every amplitude after every step.'],
 A=(['A quantum program is like a recipe on lines.', 'Each box changes the qubits a little.', 'You can always undo a box by running it backwards.', 'At the end you peek, and the peek gives plain 0s and 1s.', 'Peeking cannot be undone.'],
    'Quantum gates are reversible steps, but looking at the result is a one-way door.'),
 B='''<p>Gates act on amplitudes. Because they preserve total probability and are reversible, they are described by <strong>unitary</strong> matrices. Measurement is a different kind of step: it samples an outcome with probability |amplitude|² and leaves the qubit in that outcome.</p>
<p><strong>Where the analogy breaks:</strong> “boxes on lines” looks like an electrical schematic. The wires are not conductors and the boxes are not components; on hardware, a gate is a timed pulse of microwaves or laser light (Scene 69).</p>''',
 C='''<p class="eq">U†U = I; &nbsp; H · H = I; &nbsp; HZH = X</p>
<ul>
<li>X, Z, H, CNOT and controlled phase are a standard teaching set; H plus CNOT plus a T (π/8) gate is universal for quantum computation. <span class="tag spec">textbook</span></li>
<li>H · H computed numerically by the scene generator. <span class="tag calc">computed</span></li>
<li>Measurement in the computational basis is irreversible and produces classical bits. <span class="tag spec">textbook</span></li>
</ul>''',
 D='''<p>Reversibility matters for cryptanalysis cost: quantum circuits for a cipher or for modular exponentiation must be built reversibly, which multiplies their size. That is one reason resource estimates are large.</p>''',
 E='''<ul><li>When a vendor quotes “qubits”, ask how many gates of what fidelity, at what depth: the circuit, not the qubit count, decides what can run.</li></ul>''',
 eng='<p>Circuit symbols follow common textbook notation. Classical wires after measurement are drawn as double lines.</p>',
 test=['Is measurement shown as separate and irreversible? (Yes, frame 4.)', 'Is the H·H identity computed rather than typed? (Yes.)'],
 src=[NC, 'See ' + DEMO_H_LINK + ' for the interactive simulator.']),

dict(id=69, title='What a quantum computer physically is',
 lede='There are no ripples in a tank. A quantum computer is either a very cold metal circuit steered by microwave pulses, or atoms held and steered by light — plus a lot of classical electronics.',
 frames=['A dilution refrigerator, drawn as its stack of gold plates, cooling from room temperature to about 10–20 millikelvin where the chip sits.',
         'A superconducting qubit: an aluminium loop interrupted by a Josephson junction, steered by microwave pulses of a few gigahertz and read out through a resonator.',
         'Trapped ions: a row of charged atoms held by electric fields in a vacuum, controlled and read with lasers.',
         'Other approaches: neutral atoms held in focused laser beams, and photons in optical chips.',
         'What is not inside: no water, no visible waves, no whirlpools. “Waves” in this lesson are mathematics about amplitudes.'],
 A=(['Some quantum computers live in a giant fridge.', 'It is colder than outer space at the bottom.', 'Tiny metal loops there become qubits.', 'Other quantum computers hold atoms still with light.', 'There is no water inside — the waves are maths.'],
    'Real quantum computers are very cold circuits or carefully held atoms, not tanks of rippling water.'),
 B='''<p>A qubit needs two well-defined states that can be put in superposition and kept isolated from the world. <strong>Superconducting</strong> qubits are tiny circuits whose energy levels become usable only near absolute zero; microwave pulses rotate their state. <strong>Trapped ions</strong> use two energy levels of an atom; lasers rotate them. Both need elaborate classical control and readout.</p>
<p><strong>Where the analogy breaks:</strong> drawings of “quantum waves” invite people to imagine water. The amplitudes are complex numbers describing probabilities, not physical ripples you could see.</p>''',
 C='''<ul>
<li>Dilution refrigerators reach base temperatures of around 10–20 mK; stage temperatures in the drawing are typical, not one machine’s specification. <span class="tag illus">illustrative</span></li>
<li>Transmon-style qubits: a Josephson junction (thin insulating barrier between superconductors) makes the circuit anharmonic, so the lowest two levels can be addressed; control pulses are typically a few GHz. <span class="tag concept">textbook</span></li>
<li>Trapped-ion qubits use hyperfine or optical transitions; gates are driven by lasers or microwaves. <span class="tag concept">textbook</span></li>
<li>Neutral-atom (optical tweezer) and photonic platforms are also under active development. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Hardware platforms differ in gate speed, connectivity and error type, which changes which algorithms are practical first. For threat timelines, track demonstrated logical-qubit error rates and scale, not marketing qubit counts.</p>''',
 E='''<ul><li>Build quantum risk on published, peer-reviewed milestones; treat roadmap slides as intentions.</li></ul>''',
 eng='<p>Drawings are schematic and not to scale; the chip, refrigerator and ion trap are generic.</p>',
 test=['Is any water or visible wave drawn inside the computer? (No; frame 5 says so explicitly.)', 'Are temperatures labelled typical? (Yes, in the footer.)'],
 src=[NC, 'For a platform overview, see the review literature on superconducting and trapped-ion qubits (e.g., Kjaergaard et al., Annu. Rev. Condens. Matter Phys. 2020; Bruzewicz et al., Appl. Phys. Rev. 2019).']),

dict(id=70, title='Noise: why qubits forget, and what error correction costs',
 lede='Qubits leak information to their surroundings. Errors pile up with every gate. Error correction can fix this, at the price of many physical qubits per reliable one.',
 frames=['Relaxation (T1): a qubit prepared in 1 decays towards 0; with an illustrative T1 of 100 µs, the chance it is still 1 is about 0.37 after one T1.',
         'Dephasing (T2): the relative phase that interference needs blurs out; illustrative T2 of 70 µs.',
         'Errors add up: with one error in 100 per gate, a 100-gate circuit succeeds about 37 % of the time; with one in 1,000, about 90 %. Readout can also be wrong.',
         'Error correction combines many physical qubits into one logical qubit; a distance-7 surface code uses about 97 physical qubits per logical qubit in a common layout.',
         'The goal is fault tolerance: logical errors that fall as the code grows. Google reported such “below threshold” behaviour in 2024 — still far from the scale cryptography would need.'],
 A=(['Qubits are very forgetful.', 'Heat and noise make them slip.', 'The more steps you do, the more mistakes creep in.', 'So scientists team up lots of qubits to act as one careful qubit.', 'That needs a lot of qubits.'],
    'Because qubits make mistakes, many of them must work together to act as one reliable qubit.'),
 B='''<p>Two clocks matter. <strong>T1</strong> measures how long a 1 stays a 1 before energy leaks away. <strong>T2</strong> measures how long the phase between 0 and 1 stays well defined; without it, no interference. Every gate also has a small error rate, and errors multiply with circuit depth. <strong>Quantum error correction</strong> spreads one logical qubit across many physical ones and repeatedly checks for errors without measuring the data directly.</p>
<p><strong>Where the analogy breaks:</strong> “forgetful” suggests a qubit simply loses its value. Dephasing can leave the probabilities of 0 and 1 unchanged while destroying the phase — the part interference depends on.</p>''',
 C='''<p class="eq">P<sub>1</sub>(t) = e<sup>−t/T1</sup>; &nbsp; P(no error in d gates) ≈ (1 − ε)<sup>d</sup>; &nbsp; surface code ≈ 2d² − 1 physical qubits per logical qubit</p>
<ul>
<li>T1 = 100 µs and T2 = 70 µs are illustrative; real values vary widely by platform and device. <span class="tag illus">illustrative</span></li>
<li>The success table assumes independent errors and is computed from ε. <span class="tag calc">computed</span></li>
<li>2d² − 1 is one common surface-code layout (data plus measurement qubits); overheads for useful algorithms are typically far larger once logical operations are included. <span class="tag concept">conceptual</span></li>
<li>Google reported logical error rates falling as the surface-code distance grew, on its “Willow” processor (2024). <span class="tag research">research</span> <span class="tag verify">verify</span></li>
</ul>''',
 D='''<p>The relevant milestone for cryptographic risk is sustained, low-error logical qubits at scale, plus fast logical operations. Below-threshold demonstrations are necessary steps, not evidence that a cryptographically relevant machine exists.</p>''',
 E='''<ul><li>Watch logical-qubit counts and logical error rates in peer-reviewed work; adjust migration urgency when those move, not when physical qubit counts are announced.</li></ul>''',
 eng='<p>Both decay curves and the table are computed from the stated illustrative parameters; the qubit grid is schematic.</p>',
 test=['Are T1 and T2 labelled illustrative? (Yes.)', 'Is the 2024 result labelled research, not proof of a cryptographic machine? (Yes, frame 5.)'],
 src=[NC, WILLOW]),

dict(id=71, title='Where quantum helps, and where it does not',
 lede='Quantum computers are not faster at everything. They help where a problem has a structure that interference can exploit — and only once the machine is good enough.',
 frames=['A table of problems: factoring and discrete logarithms (Shor, exponential, needs fault tolerance); unstructured search (Grover, quadratic); simulating molecules and materials (problem-dependent); NP-complete problems in general (no known way to make them easy); everyday computing (no help).',
         'Steps against problem size on logarithmic axes: N for looking one by one, √N for Grover. A quadratic gain grows, but slowly.',
         'Hybrid computing: an ordinary computer prepares a short circuit, a quantum processor runs it, results come back and are checked.',
         'Honest feasibility: error-correction overhead, loading data and slow gate rates can cancel a speedup; claims are checked one problem at a time.'],
 A=(['A quantum computer is like a special tool.', 'It is brilliant at a few puzzles.', 'For most jobs, like games and email, a normal computer is better.', 'The two often work together.'],
    'Quantum computers help with a few special kinds of problem, not with everything.'),
 B='''<p>The known big wins come from <strong>structure</strong>: periodicity in factoring, the physics of molecules in simulation. Unstructured search gets only a square-root speedup. For broad classes of hard problems (NP-complete), there is no known quantum algorithm that makes them easy, and most researchers do not expect one.</p>
<p><strong>Where the analogy breaks:</strong> a “special tool” sounds ready to use. Most of the wins in the table need a fault-tolerant machine; today’s devices are used mainly for research and small experiments.</p>''',
 C='''<ul>
<li>Shor: polynomial-time factoring and discrete logarithms on a quantum computer, versus sub-exponential best known classical algorithms. <span class="tag spec">theorem</span></li>
<li>Grover: Θ(√N) queries for unstructured search, which is optimal. <span class="tag spec">theorem</span></li>
<li>No known efficient quantum algorithm for NP-complete problems; BQP is not believed to contain NP. <span class="tag concept">complexity theory</span></li>
<li>The N and √N curves are computed for N = 10 to 10<sup>12</sup>. <span class="tag calc">computed</span></li>
</ul>''',
 D='''<p>For security, the structured wins are exactly the bad news: factoring and discrete logs underpin today’s public-key cryptography. Everything else in the table is largely irrelevant to cryptographic risk.</p>''',
 E='''<ul><li>Separate quantum computing as an innovation topic (simulation, optimisation research) from quantum computing as a cryptographic risk; they have different owners and timelines.</li></ul>''',
 eng='<p>The chart’s axes are logarithmic; it shows scaling, not measured runtimes.</p>',
 test=['Does the scene claim a universal speedup? (No.)', 'Is the NP-complete row stated as “no known way”? (Yes.)'],
 src=[NC, GROVER, SHOR]),

dict(id=72, title='Quantum and security: which locks, and when',
 lede='The bridge to the rest of the lesson. Public-key locks would fail on a large enough fault-tolerant machine; symmetric locks only weaken; and the replacements are already standardised.',
 frames=['Public keys: RSA and elliptic curves underpin key exchange and signatures; Shor would break them on a large fault-tolerant quantum computer, which is not publicly known to exist.',
         'Symmetric keys and hashes: an idealised Grover search halves the exponent — AES-128 from 2^128 to 2^64, AES-256 to 2^128, SHA-256 preimages to 2^128 — and splits poorly across machines.',
         'Published resource estimates for breaking RSA-2048 have fallen: about 20 million noisy qubits in 2019, under a million in 2025, each under stated assumptions.',
         'Harvest now, decrypt later matters only when long-lived secret data is protected by quantum-vulnerable key exchange and someone captures and keeps it.',
         'NIST published post-quantum standards in August 2024 — ML-KEM, ML-DSA and SLH-DSA (FIPS 203, 204, 205) — which run on ordinary chips. Module 10 covers migration.'],
 A=(['Some locks on the internet use maths puzzles.', 'A huge future quantum computer could solve some of those puzzles.', 'That computer does not exist yet.', 'Other locks just need longer keys.', 'New locks are already ready.'],
    'Some digital locks would need replacing if big quantum computers arrive, and the replacements already exist.'),
 B='''<p><strong>Public-key</strong> cryptography (RSA, elliptic curves) is the vulnerable part: Shor’s algorithm would recover private keys. <strong>Symmetric</strong> ciphers and hashes face only Grover’s square-root speedup, answered by longer keys. The open question is timing, and published estimates of what an attack would need have come down over the years — the reason to migrate early, not evidence of a current break.</p>
<p><strong>Where the analogy breaks:</strong> “locks failing” suggests every encrypted thing at once. Each system needs its own analysis: what is encrypted with what, for how long it must stay secret, and whether anyone could have captured it (see the location-report analysis in <a href="/articles/from-tap-to-trace.html#p9">From Tap to Trace, Part IX</a>).</p>''',
 C='''<ul>
<li>Shor breaks factoring and discrete logarithms, including elliptic-curve, on a cryptographically relevant quantum computer; none is publicly known to exist. <span class="tag spec">Shor 1994/1997</span></li>
<li>Grover against a k-bit key: about 2<sup>k/2</sup> sequential operations in an idealised count; k-way parallelism saves only √k. <span class="tag spec">theorem</span> Collision search on hashes gains little in practice. <span class="tag concept">conceptual</span></li>
<li>RSA-2048 resource estimates: ~20 million noisy qubits for ~8 hours (Gidney &amp; Ekerå, 2019); under a million noisy qubits in under a week (Gidney, 2025), each under stated hardware assumptions. <span class="tag research">research</span> Estimates change.</li>
<li>FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA), August 2024; post-quantum cryptography runs on classical hardware. <span class="tag spec">standard</span></li>
<li>NIST’s draft transition timeline proposes deprecating and then disallowing quantum-vulnerable public-key algorithms over the next decade. <span class="tag verify">verify current status</span></li>
</ul>''',
 D='''<p>Prioritise by data lifetime × exposure: long-lived confidential data exchanged with RSA or elliptic-curve key exchange today is the harvest-now risk; signatures matter for anything that must stay authentic for years (firmware, documents). Short-lived session data matters least.</p>''',
 E='''<ul><li>Start a cryptographic inventory now; it is the prerequisite for every migration decision in Module 10.</li>
<li>Use 256-bit symmetric keys for long-lived secrets; do not replace AES itself.</li>
<li>Ask vendors for post-quantum migration plans with dates, not for claims of being “quantum-proof”.</li></ul>''',
 eng='<p>Exponents in the table are idealised counts. Estimate bars use a logarithmic scale; their labels give the published figures.</p>',
 test=['Is anything described as already broken by a quantum computer? (No; the footer says so.)', 'Are resource estimates dated and labelled research? (Yes, frame 3.)', 'Is PQC described as running on ordinary chips? (Yes, frame 5.)'],
 src=[SHOR, GROVER, GE19, G25, FIPS, IR8547, FTT9]),
])

INSERTS = {66: DEMO_I}
SCRIPTS = ['/invisible-engine/demos/qsim.js', '/invisible-engine/demos/grover.js']
