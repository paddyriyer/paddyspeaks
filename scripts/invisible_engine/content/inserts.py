OVERVIEW = '''
<figure class="overview" id="overview">
  <a href="/invisible-engine/art/contactless-power.webp"><img src="/invisible-engine/art/contactless-power.webp" width="1448" height="1086" loading="lazy" alt="Illustration: How a contactless card gets power. 1, the payment terminal drives its reader coil at 13.56 MHz, creating an alternating magnetic near field. 2, the card's antenna coil, embedded around its edge, harvests energy: the changing field induces a small AC voltage. 3, a rectifier and power-management block turns the AC into regulated DC that powers the chip. 4, the secure chip wakes and processes the payment data. 5, the card replies by modulating the load on its coil, which the terminal detects as data. A footer notes that it works over only a few centimetres because the field weakens very quickly with distance."></a>
  <figcaption>
    <p><strong>The whole module in one picture.</strong> Illustration by Paddy Iyer. Scenes 09–17 take each numbered step apart.</p>
    <details><summary>Reading notes on this illustration</summary>
      <ul class="fix">
        <li>“Load modulation (backscatter)”: at 13.56 MHz this lesson says <em>load modulation</em>; backscatter strictly describes far-field UHF tags (Scene 13).</li>
        <li>The 1.8–3.3 V supply range is illustrative; chip supply voltages vary by design.</li>
        <li>“Authenticates with the terminal”: the card proves itself mainly to the <em>issuer</em>, through the cryptogram (Scene 15); terminals may also check the card offline.</li>
        <li>“Short range… helps keep transactions secure”: short range is a property of the radio, not an authorisation control — see relay in Scene 17.</li>
      </ul>
    </details>
  </figcaption>
</figure>
'''

DEMO_A = '''
<section class="demo" id="demo-a" aria-labelledby="demo-a-h">
  <header><span class="scene-n">Interactive demo A</span><h2 id="demo-a-h">Coil powers chip</h2></header>
  <div class="body">
    <noscript><p>This demo needs JavaScript. Scenes 11–13 show the same steps as still frames.</p></noscript>
    <div class="row" data-js hidden>
      <label class="ctl" for="da-dist">Card distance from the reader</label>
      <input type="range" id="da-dist" min="0" max="100" step="1" value="70" aria-describedby="da-read">
      <output id="da-d" for="da-dist">7.0 cm</output>
    </div>
    <div class="row" data-js hidden>
      <div class="seg" role="group" aria-label="What to show">
        <button type="button" data-view="energy" aria-pressed="true">Energy</button>
        <button type="button" data-view="data" aria-pressed="false">Data</button>
        <button type="button" data-view="security" aria-pressed="false">Security</button>
      </div>
    </div>
    <div class="stage" id="da-stage" data-js hidden></div>
    <p class="readout" id="da-read" aria-live="polite" data-js hidden></p>
    <p class="assume"><strong>Model, and its limits.</strong> Relative coupling is the on-axis field of a single circular loop of radius R = 3 cm, normalised to 1 at the reader: <code>k(d) = (R² / (R² + d²))^{3/2}</code>. The chip is drawn as “powered” above an illustrative threshold of 0.3. Not calibrated: real readers, cards, angles, metal and detuning change everything, and very close placement can detune both coils. The card has no battery in any state.</p>
  </div>
</section>
'''

DEMO_B = '''
<section class="demo" id="demo-b" aria-labelledby="demo-b-h">
  <header><span class="scene-n">Interactive demo B</span><h2 id="demo-b-h">Physical card or phone wallet?</h2></header>
  <div class="body">
    <div class="row" data-js hidden>
      <div class="seg" role="group" aria-label="Credential">
        <button type="button" data-cred="card" aria-pressed="true">Plastic card</button>
        <button type="button" data-cred="wallet" aria-pressed="false">Phone wallet</button>
      </div>
    </div>
    <div class="tbl"><table class="cmp" id="db-table">
      <caption class="sr">Plastic contactless card compared with a phone wallet</caption>
      <thead><tr><th scope="col">Question</th><th scope="col" data-col="card">Plastic card</th><th scope="col" data-col="wallet">Phone wallet (Apple Pay documented)</th></tr></thead>
      <tbody id="db-body"><tr><th scope="row">Number the terminal receives</th><td data-col="card">The card number (PAN)</td><td data-col="wallet">A device token (Apple: Device Account Number), not the card number</td></tr><tr><th scope="row">Where the keys live</th><td data-col="card">The card chip’s secure memory</td><td data-col="wallet">The phone’s secure element</td></tr><tr><th scope="row">Fresh cryptogram each payment?</th><td data-col="card">Yes</td><td data-col="wallet">Yes</td></tr><tr><th scope="row">Who must approve the payment on the device?</th><td data-col="card">No one, for small payments below a regional limit; a PIN above it</td><td data-col="wallet">You, every time: face, finger or passcode (Secure Enclave)</td></tr><tr><th scope="row">If the merchant’s records leak</th><td data-col="card">The card number is exposed; the cryptogram cannot be reused</td><td data-col="wallet">The token is exposed; it is bound to that one device</td></tr><tr><th scope="row">If the card or phone is lost</th><td data-col="card">Cancel and reissue the card</td><td data-col="wallet">Suspend that device’s token; the card itself stays valid</td></tr><tr><th scope="row">Anonymous to the payment chain?</th><td data-col="card">No</td><td data-col="wallet">No</td></tr></tbody>
    </table></div>
    <div class="views" id="db-views" data-js hidden></div>
    <p class="assume">Wallet facts are Apple’s documented design; other wallets differ in detail. Tokenisation applies to supported wallets, not to every plastic card. Neither credential makes a payment anonymous to the merchant, network or issuer.</p>
  </div>
</section>
'''

# ── Phase 2 demos ──────────────────────────────────────────────────
# C is a pure model in invisible-engine/demos/whisper.js. D and E read their facts from
# invisible-engine/demos/lost.json and connections.json: the static HTML below (which works
# without JavaScript) is written from the same JSON the scripts and tests use.
import html as _html
import json as _json
import pathlib as _pathlib

_DEMOS = _pathlib.Path(__file__).resolve().parents[3] / 'invisible-engine' / 'demos'


def _slider(i, label, lo, hi, step, val, out):
    return (f'    <div class="row" data-js hidden><label class="ctl" for="{i}">{label}</label>'
            f'<input type="range" id="{i}" min="{lo}" max="{hi}" step="{step}" value="{val}">'
            f'<output id="{i}-o" for="{i}">{out}</output></div>\n')


DEMO_C = ('''
<section class="demo" id="demo-c" aria-labelledby="demo-c-h">
  <header><span class="scene-n">Interactive demo C</span><h2 id="demo-c-h">The BLE whisper: battery against being heard</h2></header>
  <div class="body">
    <noscript><p>This demo needs JavaScript. Scenes 24 and 29 show the same trade-off as still frames.</p></noscript>
''' + _slider('dc-int', 'Advertising interval', 0, 7, 1, 5, '2 s')
      + _slider('dc-on', 'Radio on per event', 1, 10, 1, 3, '3 ms')
      + _slider('dc-tx', 'Current while transmitting', 2, 15, 1, 6, '6 mA')
      + _slider('dc-sleep', 'Sleep current', 0.5, 20, 0.5, 2, '2 µA')
      + _slider('dc-other', 'Everything else (sensors, clock, leakage)', 0, 20, 1, 3, '3 µA')
      + _slider('dc-phones', 'Phones listening nearby', 1, 5, 1, 1, '1')
      + _slider('dc-duty', 'How much of the time each phone listens', 5, 100, 5, 30, '30 %') + '''
    <div class="stage" id="dc-stage" data-js hidden></div>
    <p class="readout" id="dc-read" aria-live="polite" data-js hidden></p>
    <p class="assume"><strong>Model, and its limits.</strong> Every value is illustrative, not a measurement of any product. Average current is <code>(I_tx·t_on + I_sleep·(T − t_on)) / T + I_other</code>; battery life is a 220 mAh coin cell divided by it, before the derating that pulse loads, cold and age cause. A phone hears one advertising event with chance <em>listening share × 0.8</em> (the 0.8 stands for walls, bodies and interference); events are treated as independent. Bluetooth allows advertising intervals from 20 ms to 10.24 s. No phone pairs with the tag to hear it.</p>
  </div>
</section>
''')


def _lost():
    d = _json.loads((_DEMOS / 'lost.json').read_text(encoding='utf-8'))
    e = _html.escape
    steps = ''.join(f'<li data-step="{x["n"]}"><strong>{e(x["title"])}.</strong> {e(x["text"])}</li>' for x in d['steps'])
    word = {'yes': 'Yes', 'no': 'No', 'meta': 'Metadata only'}
    head = ''.join(f'<th scope="col" data-actor="{a["id"]}">{e(a["label"])}</th>' for a in d['actors'])
    rows = ''
    for it in d['items']:
        cells = ''.join(f'<td data-actor="{a["id"]}" class="v-{it["see"][a["id"]]}">{word[it["see"][a["id"]]]}</td>' for a in d['actors'])
        rows += f'<tr data-item="{it["id"]}" data-from="{it["step"]}"><th scope="row">{e(it["label"])}<span class="why">{e(it["note"])}</span></th>{cells}</tr>'
    btns = ''.join(f'<button type="button" data-pick="{a["id"]}" aria-pressed="false">{e(a["label"])}</button>' for a in d['actors'])
    return f'''
<section class="demo" id="demo-d" aria-labelledby="demo-d-h">
  <header><span class="scene-n">Interactive demo D</span><h2 id="demo-d-h">How a lost tag is found</h2></header>
  <div class="body">
    <div class="row" data-js hidden>
      <label class="ctl" for="dd-step">Step</label>
      <input type="range" id="dd-step" min="1" max="{len(d["steps"])}" step="1" value="1" aria-describedby="dd-read">
      <output id="dd-step-o" for="dd-step">1 of {len(d["steps"])}</output>
    </div>
    <div class="stage" id="dd-stage" data-js hidden></div>
    <p class="readout" id="dd-read" aria-live="polite" data-js hidden></p>
    <ol class="dd-steps" id="dd-steps">{steps}</ol>
    <div class="row" data-js hidden><div class="seg" role="group" aria-label="Show one party’s view">{btns}</div></div>
    <div class="tbl" tabindex="0" role="region" aria-label="Who can see what (scrolls sideways on small screens)"><table class="cmp vis" id="dd-table">
      <caption>Who can see what. “Metadata only” means the service sees that something happened, never the location inside the sealed report.</caption>
      <thead><tr><th scope="col">Information</th>{head}</tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
    <p class="assume">Follows Apple’s documented Find My network design (Apple Platform Security guide). Simplified: one finder, one report. The tag never receives a location from satellites or from the finder. Unwanted-tracking alerts, which protect people carrying a tag that is not theirs, are covered in Module 7.</p>
  </div>
</section>
'''


def _connections():
    d = _json.loads((_DEMOS / 'connections.json').read_text(encoding='utf-8'))
    e = _html.escape
    tabs = ''.join(f'<button type="button" role="tab" id="de-tab-{t["id"]}" aria-controls="de-{t["id"]}" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}">{e(t["label"])}</button>'
                   for i, t in enumerate(d['tabs']))
    panels = ''
    for t in d['tabs']:
        rows = ''.join(f'<dt>{e(lbl)}</dt><dd>{e(t[k])}</dd>' for k, lbl in d['fields'])
        panels += (f'<section class="de-panel" id="de-{t["id"]}" role="tabpanel" aria-labelledby="de-tab-{t["id"]}" data-tab="{t["id"]}">'
                   f'<h3>{e(t["label"])} <span class="tag {t["tag"]}">{"documented" if t["tag"] == "doc" else t["tag"]}</span></h3>'
                   f'<dl>{rows}</dl><p class="src">Source: {e(t["source"])}</p></section>')
    return f'''
<section class="demo" id="demo-e" aria-labelledby="demo-e-h">
  <header><span class="scene-n">Interactive demo E</span><h2 id="demo-e-h">Four different connections, not one</h2></header>
  <div class="body">
    <p>Setting a tag up, a stranger’s phone overhearing it, finding it in the room and tapping it with a phone are four different conversations, with different radios, distances and listeners.</p>
    <div class="de-tabs" role="tablist" aria-label="Connection" data-js hidden>{tabs}</div>
    <div class="de-panels">{panels}</div>
  </div>
</section>
'''


DEMO_D = _lost()
DEMO_E = _connections()
