# LinkedIn post draft — Privacy Console

_Short-form post. Fill in the bracketed numbers from your own first scan before
posting — do not guess them. The whole argument below is about not overstating
what a tool found, and inventing a figure to make the post land better would be
the exact thing it criticises._

---

I spent a weekend building an AI that finds everywhere on the internet my personal information is published, and files the removals.

The hard part wasn't finding my data.

It was proving it was mine.

---

**Here's what nobody tells you about data broker removal.**

Search your own name and you'll get pages of results. Most of them are not you.

There are hundreds of people who share my name. Data brokers publish a page for every one of them. So the naive version of this tool — search the name, file the removal — doesn't protect your privacy.

It files legal requests to delete a stranger's record.

So the interesting engineering problem turned out to be identity, not search. My tool refuses to confirm a match on a name alone, no matter how perfect the name is. It needs corroboration: an address, a phone number, a relative, an age within a few years.

One rule took me three attempts to get right: **absence is not evidence.** A listing that simply doesn't print a phone number is not a mismatch. Score it as one and you reject the sparse pages that genuinely are you.

---

**The second thing I learned is worse.**

The industry quietly conflates two different words.

"Removal request submitted" is not "removed."

One is an email you sent. The other is a fact about the world. Between them sits a verification step that most services never show you, because the gap is where the business model lives.

My version can't collapse them. Going from *submitted* to *removed* requires actually re-fetching the page and confirming the record is gone. If it's still there, it says so.

---

**What surprised me**

Not the search. The arithmetic.

Your home address is a nuisance. Your address *plus* your phone *plus* two relatives' names is enough to pass most banks' identity verification — that combination is a SIM-swap starter kit, and every piece of it is published for free.

Risk isn't additive. It's combinatorial. [X of the sites I found] were publishing that exact set.

---

**The numbers**

🔍 [X] searches run
📄 [X] exposures confirmed as me
🚫 [X] same-name strangers correctly rejected
🧠 152 tests, zero dependencies
💰 $0 — runs in your browser

---

The thing I'm proudest of isn't a feature. It's a refusal.

There's no hardcoded list of data brokers anywhere in it, and a test that fails if someone adds one. Hardcoding the famous sites finds the famous sites. The exposure that actually surprises you is on a regional directory, a church newsletter PDF, an HOA roster nobody's heard of.

Build the thing that finds those, or don't bother.

→ paddyspeaks.com/privacy

---

#AI #Privacy #DataBrokers #Claude #OSINT #Engineering #BuildInPublic
