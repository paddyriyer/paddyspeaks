# Every Arrow Is a Decision — the four-lens review

From *Every Arrow Is a Decision*, edition 4.0 (30 September 2026), by Paddy Iyer.
https://paddyspeaks.com/articles/every-arrow-is-a-decision.html

Four questions for every arrow a product draws:

- **Security.** Can the wrong actor get at it?
- **Privacy.** Should it exist, move, combine, persist or be inferred?
- **QA.** How would anyone outside know it works as promised?
- **Data governance.** Who holds it, how long does it live, and can it really go?

## Twenty questions for any product

### Security

- [ ] What stops a look-alike site, a stolen session or a replayed request?
- [ ] Where does the key live, and what hardware protects it?
- [ ] Who can restore access when every device is lost, and how are guesses limited?
- [ ] What is sent before the person acts: before the wake word, before the tap, before opening?
- [ ] What happens on a compromised or second-hand device?

### Privacy

- [ ] What leaves the device, and could it have been computed on the device?
- [ ] Which identifier links this activity to other activity, and is it scoped?
- [ ] What metadata remains after the content is encrypted?
- [ ] Is it used for training, ads or personalisation, and what is the default?
- [ ] Could the purpose be met by proving an attribute instead of revealing the data?

### QA

- [ ] What would an outsider need to verify the claim: source, logs, an audit, a research environment?
- [ ] Is the default state tested, not only the configured one?
- [ ] Is every fallback tested: to SMS, to an unencrypted channel, to a password?
- [ ] Is deletion tested end to end, including derived data and backups?
- [ ] Is the test re-run after every release and every policy change?

### Data governance

- [ ] Who holds the key, and who could be compelled to use it?
- [ ] How long does each copy live: active, backup, reviewed, derived?
- [ ] Can the person export it, and in what format?
- [ ] Does deletion in one place reach every other place?
- [ ] Which controls can the vendor or a government withdraw, and who would be told?

A question nobody can answer is a finding.

## The arrow to watch, product by product

| Product | Compared | The arrow to watch |
|---|---|---|
| Sign-in | Apple, Google, Microsoft | The recovery path. It is where an end-to-end encrypted key is restored or lost for good, and where deleting on the phone and deleting at the site fall out of step. |
| Browser | Apple, Google, Mozilla | Third-party requests in a normal tab. That is where the default decides who else learns what you read. |
| Mail | Apple, Google, Proton | The pixel fetch. When it happens and whose IP address it comes from can be tested directly, and it is the whole of the privacy claim. |
| Messages | Apple, Google, Meta | The backup. In transit the message is encrypted by default everywhere; the backup copy is where defaults decide who holds the key. |
| Wallet & ID | Apple, Google, Samsung | Transaction data flowing from the wallet to the wallet maker. The token hides the card from the merchant; it says nothing about what the platform keeps. |
| Cloud backup | Apple, Google, Microsoft | Key custody. Whoever holds the key — provider, user or recovery contact — decides who can be compelled to open it. |
| AI assistant | Apple, Google, Microsoft | The arrow from device to cloud tier, and what is retained after the answer. “Verifiable” and “we promise” are different kinds of control. |
| Home & voice | Apple, Google, Amazon | The arrow from the speaker to the cloud, now that generative assistants need it — and whether deletion covers the transcripts made from the audio. |

Claims in the essay describe what each company documents, as reviewed on 30 September 2026, with citations. The tests are recommendations. Nothing here is a score or legal advice.
