from .inserts import DEMO_G, DEMO_H, FIG_QUANTUM

# Sources used across the module.
NC = 'M. A. Nielsen and I. L. Chuang, <em>Quantum Computation and Quantum Information</em>, 10th anniversary edition, Cambridge University Press, 2010.'
FEYN3 = 'R. P. Feynman, R. B. Leighton and M. Sands, <em>The Feynman Lectures on Physics</em>, Vol. III, ch. 1 “Quantum Behavior” — <a href="https://www.feynmanlectures.caltech.edu/III_01.html">feynmanlectures.caltech.edu</a>.'
FEYN1 = 'R. P. Feynman, R. B. Leighton and M. Sands, <em>The Feynman Lectures on Physics</em>, Vol. I, ch. 29 “Interference” — <a href="https://www.feynmanlectures.caltech.edu/I_29.html">feynmanlectures.caltech.edu</a>.'
HH = 'P. Horowitz and W. Hill, <em>The Art of Electronics</em>, 3rd edition, Cambridge University Press, 2015 (logic levels and the transistor as a switch).'
NOCLONE = 'W. K. Wootters and W. H. Zurek, “A single quantum cannot be cloned”, <em>Nature</em> 299, 802 (1982).'
TONO = 'A. Tonomura, J. Endo, T. Matsuda, T. Kawasaki and H. Ezawa, “Demonstration of single-electron buildup of an interference pattern”, <em>Am. J. Phys.</em> 57, 117 (1989).'
ARNDT = 'M. Arndt, O. Nairz, J. Vos-Andreae, C. Keller, G. van der Zouw and A. Zeilinger, “Wave–particle duality of C<sub>60</sub> molecules”, <em>Nature</em> 401, 680 (1999).'
ZUREK = 'W. H. Zurek, “Decoherence, einselection, and the quantum origins of the classical”, <em>Rev. Mod. Phys.</em> 75, 715 (2003).'
SEW = 'M. O. Scully, B.-G. Englert and H. Walther, “Quantum optical tests of complementarity”, <em>Nature</em> 351, 111 (1991).'
FTT9 = '<a href="/articles/from-tap-to-trace.html#p9">From Tap to Trace, Part IX</a> (what quantum computing does and does not threaten).'

M = dict(
    num=8, file='m08.html', title='Quantum from switches to interference',
    kicker='Module 8 · Before anyone says “quantum computer”',
    dek='Every claim about quantum computers rests on one idea: amplitudes that add and cancel. This module builds it from a light switch, through water waves and arrows on a circle, to a three-gate circuit that always gives the same answer, and says plainly where each picture stops being true.',
    prereq='None beyond school algebra. Complex numbers are introduced in Scene 59. Module 1 (energy versus information) helps but is not required.',
    scenes=[

dict(id=56, title='A bit is a switch that is either on or off',
 lede='Start with what a classical computer is made of: switches. Each one is a bit, definitely 0 or definitely 1, readable as often as you like, and copyable.',
 frames=['A transistor used as a switch: a high voltage is read as 1, a low voltage as 0 (the voltages are ranges, shown as lamps).',
         'Three bits make a register that could hold any of eight strings, 000 to 111.',
         'It actually holds exactly one of them, here 101. Reading it does not change it.',
         'Bits can be read and copied freely. n bits have 2ⁿ possible strings but hold one at a time; qubits will differ on every one of these points.'],
 A=(['A light switch is on or off.', 'Inside a computer, tiny switches do the same.', 'On means 1, off means 0.', 'Three switches can make eight patterns.', 'But they show only one pattern at a time.'],
    'A computer stores everything as switches that are either on or off, and you can look at them without changing them.'),
 B='''<p>A transistor in a chip works as an electrically controlled switch. Circuits treat a voltage near the supply as <strong>1</strong> and a voltage near zero as <strong>0</strong>. Group three of them and you have a register with eight possible patterns; group 64 and there are about eighteen billion billion. But the register holds one pattern at any moment, and you can read it, copy it and read it again without disturbing it.</p>
<p><strong>Where the analogy breaks:</strong> a real transistor is not a light switch: it has thresholds, noise margins and a time to switch. “On” and “off” are bands of voltage that circuit designers keep well apart so that the logic stays definite.</p>''',
 C='''<ul>
<li>Digital logic maps voltage <em>ranges</em> to 0 and 1, with a forbidden band between them (noise margin). <span class="tag spec">logic-family specifications</span></li>
<li><p class="eq">n bits → 2ⁿ distinct states; a register holds exactly one of them at a time.</p> <span class="tag calc">calculated</span></li>
<li>Reading a classical bit is non-destructive and copying it is exact. The quantum no-cloning theorem says an unknown quantum state cannot be copied. <span class="tag spec">theorem (Wootters and Zurek, 1982)</span></li>
</ul>''',
 D='''<p>Everything a security architect protects today, keys included, is stored as definite, copyable bits. That is what makes key backup, escrow and exfiltration possible. A quantum state behaves differently: it cannot be copied unread. That property is the basis of quantum key distribution, a separate topic from quantum <em>computing</em> and from post-quantum cryptography.</p>''',
 E='''<ul><li>Post-quantum cryptography (Module 10) still runs on ordinary bits, on ordinary chips. “Quantum-safe” does not mean “quantum hardware”.</li></ul>''',
 eng='<p>Lamps stand for transistor states. The 64-bit count is exact: 2⁶⁴ = 18,446,744,073,709,551,616.</p>',
 test=['Does the scene suggest a register can hold several values at once? (No: frame 4 says one at a time.)', 'Are voltages presented as exact values? (No: ranges, labelled illustrative.)', 'Is the no-cloning statement attributed? (Yes, Wootters and Zurek 1982.)'],
 src=[HH, NOCLONE, NC]),

dict(id=57, title='Waves that add and waves that cancel',
 lede='Before any quantum idea, borrow a picture from water: two sets of ripples meeting. Where crests meet, the water rises twice as high; where a crest meets a trough, it stays flat. The scene is labelled as an analogy because it is one.',
 frames=['A pond from above: two stones send out rings (solid crests, dashed troughs); one point where crest meets crest, one where crest meets trough.',
         'Crest meets crest: +1 + (+1) = +2. Two equal waves and their sum, twice as tall.',
         'Crest meets trough: +1 + (−1) = 0. The waves cancel and the sum is flat at every point.',
         'An analogy: here, heights of water add. In quantum mechanics it is amplitudes that add — numbers, not heights of anything (Scene 59).'],
 A=(['Throw two stones into a pond.', 'Each makes rings of little waves.', 'Where two bumps meet, the water jumps higher.', 'Where a bump meets a dip, the water stays flat.', 'Remember this; we will use it as a picture, not as the real thing.'],
    'Waves can add up to something bigger or cancel to nothing, depending on how they line up.'),
 B='''<p>Superposition, in ordinary physics, just means that when two waves overlap the displacements add, point by point. Line up two crests and you get a crest twice as tall. Line up a crest with a trough and they cancel: that spot stays still. This adding and cancelling is called <strong>interference</strong>.</p>
<p><strong>Where the analogy breaks:</strong> water is a substance and its height is something you can see. In quantum mechanics what adds are <em>amplitudes</em>, mathematical numbers that set the odds of an outcome. Nothing is rippling. Keep the arithmetic; drop the water.</p>''',
 C='''<ul>
<li><p class="eq">y(t) = A·sin(ωt) + A·sin(ωt + φ)</p> In phase (φ = 0): amplitude 2A. Opposite phase (φ = 180°): 0. <span class="tag calc">calculated</span></li>
<li>Linear superposition holds for small water waves, sound and light; real water waves become non-linear when steep. <span class="tag concept">conceptual</span></li>
<li>The pond diagram is a schematic top view; ring spacing is illustrative. <span class="tag illus">illustrative</span></li>
</ul>''',
 D='''<p>The analogy is a good teaching tool and a frequent source of bad claims. Watch for vendor or press language that treats qubits as “waves inside the chip” or interference as something that happens to data. In a quantum computer, interference is a property of how amplitudes combine in a computation; the hardware does not contain ripples.</p>''',
 E='''<ul><li>When a briefing leans on a wave picture, ask what adds: heights of something physical, or amplitudes in a calculation. The answer tells you whether the claim is about physics or about marketing.</li></ul>''',
 eng='<p>All curves are computed: the dark sum is the point-by-point sum of the two blue inputs. The two marked pond points are found as true intersections of a crest ring and a crest or trough ring.</p>',
 test=['Is the scene labelled as an analogy? (Yes: pill and frame 4.)', 'Does the sum in frame 3 equal the sum of the plotted inputs? (Yes: computed, flat.)', 'Does it suggest qubits are ripples? (No: frame 4 says the opposite.)'],
 src=[FEYN1, FEYN3]),

dict(id=58, title='Frequency, wavelength and phase',
 lede='Three words do most of the work in any wave story. Frequency is how fast it repeats, wavelength how far apart its crests are, and phase where in its cycle it is. Shift one wave’s phase against another and their sum grows, shrinks or vanishes.',
 frames=['One wave: wavelength is crest to crest, amplitude is height; frequency is cycles per second, phase is where in the cycle a wave is.',
         'Second wave shifted by φ = 0°: the sum has amplitude 2.00 A; intensity ∝ 4.00.',
         'φ = 90°: the sum has amplitude 1.41 A; intensity ∝ 2.00.',
         'φ = 180°: the waves cancel; amplitude 0.00, intensity 0.00.',
         'φ = 270°: amplitude 1.41 A again. Amplitude is height; the energy a wave carries goes as amplitude squared.'],
 A=(['A wave goes up and down again and again.', 'How fast it repeats is its frequency.', 'Where it is in its up-and-down is its phase.', 'Two waves in step make a big wave.', 'Two waves out of step cancel out.'],
    'Whether two waves add or cancel depends on how far one is shifted against the other.'),
 B='''<p>Slide one wave along relative to the other and watch the sum. In step (0°) they make a wave twice as tall. A quarter-cycle apart (90°) they make a wave about 1.41 times as tall. Half a cycle apart (180°) they cancel completely. Energy follows the <em>square</em> of the height, so doubling the height quadruples the energy.</p>
<p><strong>Where the analogy breaks:</strong> where two waves cancel in a pond, the energy does not vanish; it appears at the loud spots instead. Quantum amplitudes are not energy either: their squares are probabilities, which is the next big step (Scene 60).</p>''',
 C='''<ul>
<li><p class="eq">A sin(ωt) + A sin(ωt + φ) = 2A cos(φ/2) · sin(ωt + φ/2)</p> so the sum amplitude is 2A·|cos(φ/2)|. <span class="tag calc">calculated</span></li>
<li><p class="eq">λ = v / f &nbsp;&nbsp;&nbsp; intensity ∝ amplitude²</p> <span class="tag spec">standard physics</span></li>
<li>Sum amplitudes for φ = 0°, 90°, 180°, 270°: 2.00, 1.41, 0.00, 1.41 (× A). <span class="tag calc">calculated</span></li>
</ul>''',
 D='''<p>Phase is the parameter that will matter most in Modules 8 and 9: quantum algorithms work by arranging phases so that unwanted outcomes cancel. Any claim of a quantum speed-up should be able to say which interference does the work; if it cannot, treat it with suspicion.</p>''',
 E='''<ul><li>No action here; this is vocabulary. It is enough to know that “phase” decides whether things add or cancel.</li></ul>''',
 eng='<p>Each panel plots both inputs and their computed sum over 1.5 cycles; the sum amplitude and intensity printed under each are computed from 2A·|cos(φ/2)| and its square.</p>',
 test=['Does every plotted sum equal the sum of its two inputs? (Yes: computed point by point.)', 'Is amplitude distinguished from energy or intensity? (Yes: frame 5 and each panel.)', 'Is the scene labelled classical? (Yes: pill.)'],
 src=[FEYN1]),

dict(id=59, title='Complex amplitudes: arrows with a length and an angle',
 lede='The quantum version of a wave’s height is an amplitude, and amplitudes are complex numbers: arrows with a length and an angle. The angle is the phase. Two kinds of phase need to be told apart, because only one of them changes anything.',
 frames=['The complex plane: an arrow of length 1 at angle φ is e^(iφ) = cos φ + i·sin φ.',
         'At 0°, 90°, 180° and 270° the arrow is 1, i, −1 and −i: same length, different directions.',
         'Measuring as 0 or 1 gives probabilities equal to each amplitude’s squared length; the angle alone does not show up in that measurement.',
         'Global phase (both parts turn together) changes nothing any experiment can detect; relative phase (one part turns against the other) changes what interference does next.'],
 A=(['Think of a clock hand that can point anywhere.', 'Its length says how likely something is.', 'Its direction is called its phase.', 'Turning every hand together changes nothing you can notice.', 'Turning one hand against another changes what happens next.'],
    'In quantum maths, each possibility is an arrow, and how the arrows point decides whether they add up or cancel later.'),
 B='''<p>A quantum system with two possible outcomes is described by two amplitudes, one for each. Each amplitude is a complex number, which you can picture as an arrow: its length sets how likely that outcome is, and its angle is its phase. When two arrows are added they can reinforce or cancel, just like waves, depending on how they point.</p>
<p>Turn <em>both</em> arrows by the same angle and nothing observable changes: that is <strong>global phase</strong>. Turn one against the other and the next step can come out differently: that is <strong>relative phase</strong>, the quantity Scenes 62 and 63 put to work.</p>
<p><strong>Where the analogy breaks:</strong> the arrows are a way to picture numbers in a calculation. You cannot point a camera at a qubit and see its arrow.</p>''',
 C='''<ul>
<li><p class="eq">e^(iφ) = cos φ + i·sin φ &nbsp;&nbsp;&nbsp; |e^(iφ)| = 1</p> <span class="tag spec">Euler’s formula</span></li>
<li>Global phase: e^(iθ)|ψ⟩ gives the same probabilities for every measurement, so states that differ only by global phase are physically identical. <span class="tag spec">standard quantum mechanics</span></li>
<li>Relative phase: (|0⟩ + e^(iφ)|1⟩)/√2 for different φ are different states; φ shows up after a further gate (Scene 63, demo G). <span class="tag calc">calculated</span></li>
</ul>''',
 D='''<p>“Phase” in quantum computing is a property of the mathematical state, controlled by gates and destroyed by noise. It is not a hidden channel and not something an eavesdropper reads off a device. Keeping relative phase intact long enough to use it is the central engineering problem (Module 9, Scene 70).</p>''',
 E='''<ul><li>Vocabulary only. The point to keep: quantum advantage depends on fragile relative phases, which is why error correction, not raw qubit count, sets the pace (Module 9).</li></ul>''',
 eng='<p>Arrows are drawn from computed angles. Purple marks quantum amplitudes throughout Modules 8 and 9; blue was kept for classical waves.</p>',
 test=['Is phase presented as directly observable in a 0/1 measurement? (No: frame 3 says the opposite.)', 'Are global and relative phase distinguished? (Yes: frame 4.)', 'Is the label switch from analogy to mathematics visible? (Yes: pill on this scene; Scene 57 frame 4.)'],
 src=[NC, FEYN3]),

dict(id=60, title='A qubit, and the rule that turns amplitudes into odds',
 lede='A qubit is described by two amplitudes, one for 0 and one for 1. Measure it and you always get a definite 0 or 1; the squares of the amplitudes are the odds. That rule, the Born rule, is the bridge from the arrows to anything you can observe.',
 frames=['A prepared qubit α|0⟩ + β|1⟩ with α = 0.866 and β = 0.5: probabilities 0.75 and 0.25.',
         'A different state, +0.707 and −0.707: the minus sign shows in the amplitudes but not in the probabilities, 0.50 and 0.50.',
         'A hundred identically prepared copies, each measured once: every result is a definite bit; 75 read 0 and 25 read 1.',
         'A fair coin and |+⟩ both give 50:50 when measured directly; after an H gate, |+⟩ always reads 0 while the coin stays 50:50.'],
 A=(['A qubit is like a special coin that has not landed yet.', 'Two numbers say how likely heads (0) or tails (1) are.', 'When you look, it always shows a definite 0 or 1.', 'Do it many times and you see the odds.', 'But unlike a coin, a qubit can be steered before you look.'],
    'Squaring the qubit’s numbers gives the odds of seeing 0 or 1 when you finally look.'),
 B='''<p>Write a qubit as <em>α</em>|0⟩ + <em>β</em>|1⟩. The numbers α and β are amplitudes. Measure it and you get 0 with probability |α|² and 1 with probability |β|², and the two always add to 1. Each measurement gives one whole answer; the odds only show up if you prepare and measure the same state many times.</p>
<p>Two states can have identical odds and still be different, because amplitudes can be negative (or, generally, complex). A coin flip and a qubit in superposition both look like 50:50 at first; one more gate tells them apart, because amplitudes can cancel and a coin’s odds cannot.</p>
<p><strong>Where the analogy breaks:</strong> “a coin that has not landed” suggests the qubit secretly is heads or tails already. Experiments rule out that simple picture; the amplitudes are not a hidden answer.</p>''',
 C='''<ul>
<li><p class="eq">|ψ⟩ = α|0⟩ + β|1⟩, &nbsp;&nbsp; |α|² + |β|² = 1, &nbsp;&nbsp; P(0) = |α|², P(1) = |β|²</p> <span class="tag spec">Born rule</span></li>
<li>Frame 1: α = √3/2 ≈ 0.866, β = 1/2 → P = 0.75, 0.25. Frame 2: ±1/√2 → 0.50, 0.50. <span class="tag calc">calculated</span></li>
<li>The 100 outcomes are a fixed illustrative sample with exactly 75 zeros; real runs fluctuate around 75 (standard deviation √(100·0.75·0.25) ≈ 4.3). <span class="tag illus">illustrative</span></li>
<li>A classical 50:50 mixture and |+⟩ have the same Z-basis statistics but different X-basis statistics. <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>Measurement gives one sample per run. Any algorithm that relies on a quantum computer must therefore make the answer likely enough to show up in a few runs, which is what interference is for. A device that merely produces random-looking bits is not computing anything quantum-mechanically useful; randomness alone is cheap.</p>''',
 E='''<ul><li>When a quantum result is quoted, ask how many runs (shots) it took and with what success probability. A single sample proves little.</li></ul>''',
 eng='<p>Bars are computed from the amplitudes. The 100-dot grid uses a fixed random sample of 25 ones so the picture is reproducible.</p>',
 test=['Are probabilities ever drawn negative? (No: teal bars are |amplitude|².)', 'Is the 75/25 sample labelled as an illustration of statistics, not an exact law for 100 runs? (Yes, level C.)', 'Is classical randomness distinguished from superposition? (Yes: frame 4.)'],
 src=[NC, FEYN3]),

dict(id=61, title='The Hadamard gate: even odds, not half a particle',
 lede='The Hadamard gate, H, is the workhorse of quantum circuits. It turns a definite 0 into equal odds of 0 and 1, and a definite 1 into the same odds with a minus sign. Applied twice, it undoes itself, which is the first sign of interference.',
 frames=['|0⟩ through H: amplitudes +0.707 and +0.707, odds 0.50 and 0.50.',
         '|1⟩ through H: +0.707 and −0.707, also 0.50 and 0.50.',
         'The rule as a matrix: H = (1/√2)·[[1, 1], [1, −1]]. Ideal gates are reversible.',
         'Not half a particle: every measurement finds a whole 0 or 1, a whole photon or electron. “Half” is a probability.',
         'H twice gives back |0⟩: the two contributions to 1 cancel (0.5 − 0.5 = 0).'],
 A=(['A special step called H mixes a qubit.', 'Start with a sure 0, and after H it is 50:50.', 'Start with a sure 1, and it is also 50:50, with a hidden minus sign.', 'It never makes half a thing; you always see a whole 0 or 1.', 'Do H twice and you are back where you started.'],
    'The H step spreads a qubit evenly between 0 and 1, and doing it twice brings it back because the in-between parts cancel.'),
 B='''<p>H takes |0⟩ to an equal mixture of amplitudes for 0 and 1, and |1⟩ to the same mixture with the sign of the 1-part flipped. Measured straight away, both give 50:50 odds. But they are different states, and that difference becomes visible if you apply H again: |0⟩ → H → H gives |0⟩ every time, because the two routes to 1 have opposite signs and cancel.</p>
<p><strong>Where the analogy breaks:</strong> it is tempting to say the particle is “half 0 and half 1”. Nothing is split: every detection finds a whole particle, and the halves are odds. The state is a list of amplitudes, not a mixture of two half-objects.</p>''',
 C='''<ul>
<li><p class="eq">H = (1/√2) [[1, 1], [1, −1]] &nbsp;&nbsp; H|0⟩ = |+⟩ = (|0⟩ + |1⟩)/√2 &nbsp;&nbsp; H|1⟩ = |−⟩ = (|0⟩ − |1⟩)/√2</p> <span class="tag spec">standard definition</span></li>
<li><p class="eq">H·H = I</p> so H|+⟩ = |0⟩: amplitude to 1 is (1/√2)(1/√2) + (1/√2)(−1/√2) = 0. <span class="tag calc">calculated</span></li>
<li>Ideal gates are unitary (reversible, length-preserving); real gates add errors (Module 9, Scene 70). <span class="tag concept">conceptual</span></li>
</ul>''',
 D='''<p>H is how circuits create the even superpositions that algorithms such as Grover’s start from (Module 9, Scene 66). Its reversibility matters: quantum gates do not discard information until a measurement or noise does.</p>''',
 E='''<ul><li>Vocabulary. If a briefing says a quantum computer “stores every value at once”, translate it to “prepares amplitudes over many values, of which one is read”.</li></ul>''',
 eng='<p>Amplitudes shown to three places; 0.707 is 1/√2. Gates are ideal.</p>',
 test=['Does the scene say “half a particle” as fact? (No: frame 4 rejects it.)', 'Do the bars add to probability 1? (Yes: 0.5 + 0.5.)', 'Is H·H = I shown with the cancelling term? (Yes: frame 5.)'],
 src=[NC]),

dict(id=62, title='The Z gate changes a phase you cannot see directly',
 lede='The Z gate leaves the odds exactly as they were. All it does is flip the sign of the 1-part. Measured straight away, nothing seems to have happened; one more gate later, everything has.',
 frames=['Before: |+⟩ with amplitudes +0.707 and +0.707, odds 0.50 and 0.50.',
         'The Z gate: matrix [[1, 0], [0, −1]], which flips the sign of the |1⟩ part.',
         'After: |−⟩ with +0.707 and −0.707, exactly the same odds, 0.50 and 0.50.',
         'As arrows: the |1⟩ part turns by 180° while the |0⟩ part stays — a relative phase.',
         'Measured right now, |+⟩ and |−⟩ cannot be told apart; one more H turns them into 0 and 1 every time (Scene 63).'],
 A=(['Z is a step that changes a hidden sign.', 'Before and after, the odds are still 50:50.', 'So if you look right away, nothing seems different.', 'But the hidden sign changes what the next step does.'],
    'Some changes cannot be seen straight away but decide what happens next.'),
 B='''<p>Z multiplies the amplitude of 1 by −1. On |+⟩ it produces |−⟩. If you measure either one directly, you get 0 or 1 with equal odds; no single reading can tell which state you had. The difference is a <strong>relative phase</strong> of 180° between the two parts.</p>
<p>That invisible difference becomes decisive as soon as another gate mixes the parts again: H turns |+⟩ into 0 every time and |−⟩ into 1 every time. Phase is information you cannot read directly but can convert into something you can.</p>
<p><strong>Where the analogy breaks:</strong> the arrows suggest the |1⟩ part “points left”. They are a picture of a sign in a calculation, not a direction in space.</p>''',
 C='''<ul>
<li><p class="eq">Z = [[1, 0], [0, −1]] &nbsp;&nbsp; Z|+⟩ = |−⟩ &nbsp;&nbsp; P(0) = P(1) = 1/2 before and after</p> <span class="tag calc">calculated</span></li>
<li>Z is a phase gate with φ = π; the general phase gate is diag(1, e^(iφ)). <span class="tag spec">standard definition</span></li>
<li>|+⟩ and |−⟩ are orthogonal: a measurement in the X basis (H, then measure) distinguishes them perfectly. <span class="tag spec">standard quantum mechanics</span></li>
</ul>''',
 D='''<p>Phase errors are a large share of real qubit errors (dephasing, Module 9 Scene 70). They are dangerous precisely because they do not show up in a direct measurement: a qubit can look fine and still have lost the relative phase an algorithm needs.</p>''',
 E='''<ul><li>When a vendor quotes only “readout accuracy”, ask about phase coherence (often reported as T2). Both matter.</li></ul>''',
 eng='<p>Bars and arrows computed from the amplitudes; ideal gates.</p>',
 test=['Do the probability bars change between before and after? (No: equal, as they should be.)', 'Is the phase change shown as relative, not global? (Yes: only the |1⟩ part turns.)', 'Is the consequence shown? (Yes: frame 5 points to Scene 63.)'],
 src=[NC]),

dict(id=63, title='Interference: H, then Z, then H always gives 1',
 lede='Put the pieces together. Three gates turn a definite 0 into a definite 1, not because anything is “tried”, but because the routes to 0 cancel and the routes to 1 add. Change the phase in the middle and the odds follow a smooth curve.',
 frames=['The circuit: start in |0⟩, apply H, then Z, then H, then measure.',
         'Amplitudes after each step: (1, 0) → (+0.707, +0.707) → (+0.707, −0.707) → (0, 1).',
         'The last H path by path: to output 0, +0.5 and −0.5 cancel to 0; to output 1, +0.5 and +0.5 add to 1.',
         'For any phase φ in the middle: P(0) = cos²(φ/2) and P(1) = sin²(φ/2); at 0°, 90°, 180°, 270° and 360°, P(0) = 1, 0.5, 0, 0.5 and 1.',
         'φ = 180° is the Z gate, so this circuit reads 1 every time.'],
 A=(['Start with a qubit that says 0.', 'Step H spreads it out evenly.', 'Step Z flips a hidden sign.', 'Step H brings the parts back together.', 'The parts that lead to 0 cancel, so you always get 1.'],
    'When hidden signs line up just right, the wrong answers cancel and only the right answer is left.'),
 B='''<p>Follow the amplitudes, not the qubit. After the first H there are two parts of equal size. Z flips the sign of one. The last H sends each part towards both outputs: towards 0, the contributions are +0.5 and −0.5, which cancel; towards 1, they are +0.5 and +0.5, which add to 1. The result is certain.</p>
<p>Replace Z with a general phase φ and the odds become cos²(φ/2) for 0 and sin²(φ/2) for 1. At φ = 0 the circuit always returns 0, at 180° always 1, and in between the odds slide smoothly. This is the whole trick behind quantum algorithms: arrange the phases so that wrong answers cancel.</p>
<p><strong>Where the analogy breaks:</strong> “paths” is bookkeeping in a calculation, not a qubit travelling two routes in space.</p>''',
 C='''<ul>
<li><p class="eq">H Z H = X &nbsp;&nbsp; so H Z H |0⟩ = |1⟩</p> <span class="tag calc">calculated</span></li>
<li><p class="eq">H · (|0⟩ + e^(iφ)|1⟩)/√2 = ((1 + e^(iφ))/2)|0⟩ + ((1 − e^(iφ))/2)|1⟩</p> <p class="eq">P(0) = |1 + e^(iφ)|²/4 = cos²(φ/2), &nbsp; P(1) = sin²(φ/2)</p> <span class="tag calc">calculated</span></li>
<li>Endpoints: φ = 0°, 90°, 180°, 270°, 360° → P(0) = 1, 0.5, 0, 0.5, 1 (as plotted). <span class="tag calc">calculated</span></li>
</ul>''',
 D='''<p>This three-gate circuit is the smallest honest example of interference doing work. Every quantum speed-up claim should reduce, on inspection, to a larger version of this pattern. Noise that randomises φ flattens the curve towards 50:50 and destroys the advantage, which is why phase coherence is the resource to watch.</p>''',
 E='''<ul><li>The question to ask of any claimed quantum advantage: which wrong answers cancel, and how is the phase kept intact long enough for them to cancel?</li></ul>''',
 eng='<p>The curve and the dots are computed from cos²(φ/2) and sin²(φ/2). Path contributions are products of amplitude and the H matrix entry, 1/√2 · 1/√2 = 0.5.</p>',
 test=['Does the scene say the qubit “tries” both answers? (No: it follows amplitudes.)', 'Do the plotted endpoints match the formula? (Yes: 1, 0.5, 0, 0.5, 1.)', 'Do the path contributions add to the final amplitudes? (Yes: 0 and 1.)'],
 src=[NC, FEYN3]),

dict(id=64, title='The double slit: stripes made of single dots',
 lede='Interference is not only arithmetic in a circuit; nature does it. Send electrons, photons or even large molecules through two slits, one at a time, and stripes build up dot by dot. Ask which slit each one went through and the stripes disappear.',
 frames=['A source sends particles one at a time towards two slits; the screen shows a striped pattern of where they land.',
         'Each particle lands as a single dot; the stripes appear only after many dots.',
         'Record which slit each particle passed and the stripes vanish: only a smooth, stripe-free spread remains.',
         'The environment can carry away the same which-path information (stray light, heat, gas molecules), washing the stripes out: decoherence.',
         'The stripes are probabilities of where whole particles land; circuit interference is amplitudes adding in a calculation the hardware carries out.'],
 A=(['Shoot tiny particles at a wall with two gaps.', 'Each one makes a single dot on a screen.', 'After many dots, stripes appear.', 'If you peek at which gap each one used, the stripes go away.', 'So looking changes what you get.'],
    'Tiny particles land in stripes only when nobody can tell which way they went.'),
 B='''<p>This is the experiment Feynman called the heart of quantum mechanics. Particles arrive one at a time and each lands as a whole dot. Yet after thousands of dots, the pattern shows stripes that only make sense if the amplitudes for the two slits interfere. It has been done with photons, electrons (Tonomura’s 1989 film of single electrons building up the pattern) and molecules of sixty carbon atoms (Arndt and colleagues, 1999).</p>
<p>If anything records which slit a particle used, a detector or merely stray light and heat, the two possibilities no longer interfere and the stripes go. That loss is <strong>decoherence</strong>, and it is why quantum computers are cooled and shielded.</p>
<p><strong>Where the analogy breaks:</strong> particles are not little ripples, and the stripes are not a substance on the screen. They are a pattern in the <em>probabilities</em> of where whole particles land.</p>''',
 C='''<ul>
<li>Two-slit pattern with slit separation d, slit width a, wavelength λ, screen angle θ: <p class="eq">I(θ) ∝ cos²(π d sin θ / λ) · sinc²(π a sin θ / λ)</p> <span class="tag spec">standard optics</span> The drawn curve uses this shape with illustrative values. <span class="tag illus">illustrative</span></li>
<li>Single-electron buildup observed (Tonomura et al. 1989); C<sub>60</sub> interference observed (Arndt et al. 1999). <span class="tag hist">historical experiment</span></li>
<li>Which-path information, whether read or merely available to the environment, suppresses interference (complementarity; decoherence). <span class="tag spec">established physics</span></li>
</ul>''',
 D='''<p>For engineers the lesson is environmental: any unintended coupling that could reveal a qubit’s state destroys the interference an algorithm needs. Isolation, cooling and error correction (Module 9) exist to stop the environment from “asking which slit”.</p>''',
 E='''<ul><li>Decoherence is why practical, large quantum computers are hard and slow to arrive. Plan cryptographic migration on standards and inventories (Module 10), not on headlines about qubit counts.</li></ul>''',
 eng='<p>Fringe and envelope shapes are computed; the dot panel is a reproducible random sample drawn from the same pattern. Not to scale. The grey arrow is a particle beam, not a lesson-legend radio signal.</p>',
 test=['Does the scene claim particles are ripples? (No: frame 5 says the opposite.)', 'Are the experiments cited with dates? (Yes: 1989, 1999.)', 'Is the toy circuit distinguished from physical interference? (Yes: frame 5.)'],
 src=[FEYN3, TONO, ARNDT, SEW, ZUREK, FTT9]),

])

BEFORE = FIG_QUANTUM
INSERTS = {59: DEMO_G, 63: DEMO_H}
SCRIPTS = ['/invisible-engine/demos/qsim.js', '/invisible-engine/demos/phase.js', '/invisible-engine/demos/circuit.js']
