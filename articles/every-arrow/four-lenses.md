# Every Arrow Is a Decision — the four-lens review

From *Every Arrow Is a Decision*, edition 4.0 (6 October 2026), by Paddy Iyer.
https://paddyspeaks.com/articles/every-arrow-is-a-decision.html

Four questions for every arrow a product draws:

- **Security.** Can the wrong actor get at it?
- **Privacy.** Should it exist, move, combine, persist or be inferred?
- **QA.** How would anyone outside know it works as promised?
- **Data governance.** Who holds it, how long does it live, and can it really go?

## Forty-four questions for any product

### Security

- [ ] What stops a look-alike site, a stolen session or a replayed request?
- [ ] Where does the key live, and what hardware protects it?
- [ ] Who can restore access when every device is lost, and how are guesses limited?
- [ ] What is sent before the person acts: before the wake word, before the tap, before opening?
- [ ] What happens on a compromised or second-hand device?
- [ ] If recovery is required, who controls the key or the mapping?
- [ ] Are the links kept for security (phone number, recovery email, devices, IP address) used for nothing else?
- [ ] Can an unauthorised person activate or access this sensor?
- [ ] Can a stolen session or device retrieve earlier captures?

### Privacy

- [ ] What leaves the device, and could it have been computed on the device?
- [ ] Which identifier links this activity to other activity, and is it scoped?
- [ ] What metadata remains after the content is encrypted?
- [ ] Is it used for training, ads or personalisation, and what is the default?
- [ ] Could the purpose be met by proving an attribute instead of revealing the data?
- [ ] Should the original remain recoverable, or would a pseudonymous or irreversible representation meet the purpose?
- [ ] What can be inferred when this activity is joined with other activity, on this device and on the person’s other devices?
- [ ] Whose data is being sensed, and is that person the device owner?
- [ ] What incidental information enters the frame or the microphone?
- [ ] Can filtering or minimisation happen before transmission?
- [ ] Does a bystander understand that capture is happening?
- [ ] If it can locate an object, how is a person told that the object is travelling with them, and on which phones?

### QA

- [ ] What would an outsider need to verify the claim: source, logs, an audit, a research environment?
- [ ] Is the default state tested, not only the configured one?
- [ ] Is every fallback tested: to SMS, to an unencrypted channel, to a password?
- [ ] Is deletion tested end to end, including derived data and backups?
- [ ] Is the test re-run after every release and every policy change?
- [ ] Can we restore and interpret an old protected record using the documented recovery path?
- [ ] When a connection is scoped, shortened or separated, does the inference it enabled really stop?
- [ ] Does sensor activation match the indicator the person sees?
- [ ] Does a do-not-save setting prevent both raw and derived records from persisting?
- [ ] What happens during a false activation?
- [ ] Do the settings survive an update?
- [ ] Does the safeguard reach people who use a different platform from the owner?

### Data governance

- [ ] Who holds the key, and who could be compelled to use it?
- [ ] How long does each copy live: active, backup, reviewed, derived?
- [ ] Can the person export it, and in what format?
- [ ] Does deletion in one place reach every other place?
- [ ] Which controls can the vendor or a government withdraw, and who would be told?
- [ ] Does a preservation hold include the keys, mappings, schemas, metadata and derived copies needed to make the record meaningful?
- [ ] Which connections changed since the last review (a new receiver, identifier, processor, purpose or retention period), and did each go through review?
- [ ] What retention applies to raw media, and what to transcripts and derivatives?
- [ ] Can the device owner delete data about another person?
- [ ] What can a non-user whose data was captured do about it?
- [ ] What happens to captures and derivatives when the account is deleted?

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
| Ambient & wearable | Meta | The arrow from the glasses to the cloud: what is sent (a frame, audio, or only what was asked), how long it is kept, and whether the people in it know. |
| Item trackers | Apple, Google, Samsung | The arrow from the owner’s map back to the person carrying the tag: whether that person is told, how soon, and on which phone. |

Claims in the essay describe what each company documents, as reviewed on 30 September 2026, with citations. The tests are recommendations. Nothing here is a score or legal advice.
