/* Every Arrow Is a Decision, edition 4 — the comparison.
 *
 * Nine everyday products, up to three companies each, four lenses. Every claim is
 * what the company's OWN documentation says, cited, as reviewed on EA_CMP.asOf.
 * Nothing here is a score, a rank or a verdict on a company.
 *
 * Item = [kind, headline, detail, 'source keys'] where kind is
 *   doc   Documented — the company says so in its own documentation
 *   set   Setting    — configurable; the default is stated when documented
 *   lim   Limit      — a limitation the company itself documents
 *   test  Test       — OUR recommendation for what QA should check. Not a vendor
 *                      claim, so it carries no source.
 * The build (scripts/every_arrow/edition4.mjs) renders every table from this
 * file, and tests/edition4.mjs checks that every cell is filled and cited.
 */
(function (root) {
  var d = function (h, x, s) { return ['doc', h, x, s]; };
  var s = function (h, x, k) { return ['set', h, x, k]; };
  var l = function (h, x, k) { return ['lim', h, x, k]; };
  var t = function (h, x) { return ['test', h, x, '']; };

  var C = root.EA_CMP = {
    asOf: '30 September 2026',
    lenses: [
      { id: 'sec', t: 'Security', q: 'Can the wrong actor get at it?' },
      { id: 'pri', t: 'Privacy', q: 'Should it exist, move, combine, persist or be inferred?' },
      { id: 'qa', t: 'QA', q: 'How would anyone outside know it works as promised?' },
      { id: 'gov', t: 'Data governance', q: 'Who holds it, how long does it live, and can it really go?' }
    ],
    kinds: { doc: 'Documented', set: 'Setting', lim: 'Limit', test: 'Test' },
    companies: { apple: 'Apple', google: 'Google', microsoft: 'Microsoft', mozilla: 'Mozilla', proton: 'Proton', meta: 'Meta', samsung: 'Samsung', amazon: 'Amazon' },
    products: []
  };
  var P = function (o) { C.products.push(o); };

  /* ── 1 · sign-in ─────────────────────────────────────────── */
  P({ id: 'passkeys', n: 'Sign-in', t: 'Who proves you are you?',
    lede: 'A passkey replaces the password with a key pair: the private half stays in your devices, the website keeps the public half, and your face or PIN only unlocks the key. All three companies now sync passkeys between your devices. The questions move from “can someone steal the password?” to “who can restore the key when every device is lost?”',
    arrow: ['Face or PIN', 'Secure chip', 'Passkey', 'Cloud sync', 'Website'], hot: 3,
    cos: ['apple', 'google', 'microsoft'],
    names: { apple: 'Passkeys in iCloud Keychain', google: 'Passkeys in Google Password Manager', microsoft: 'Passkeys and Windows Hello' },
    cells: {
      apple: {
        sec: [d('Synced end-to-end encrypted', 'Apple documents that iCloud Keychain is end-to-end encrypted with keys Apple does not know, and that recovery is rate-limited against brute force even from a privileged position on its own cloud.', 'apPasskeySec')],
        pri: [d('A new key pair for every account', 'The site never receives the private key, and Face ID or Touch ID only authorises its use; the biometric is not sent anywhere.', 'apPasskeySec apKeychain')],
        qa: [d('Published design, paid bounty', 'The Apple Platform Security guide describes keychain sync, and the Apple Security Bounty pays for breaking it.', 'apPlatformSec apBounty'),
          t('Delete at the site, then look on the phone', 'Remove a passkey at a test site and confirm the Passwords app stops offering it once the site signals the change. Confirm a look-alike domain is never offered the credential.')],
        gov: [d('Recovery contact or recovery key', 'Account recovery uses a trusted Recovery Contact or an optional 28-character recovery key. Deleted passkeys can be recovered for 30 days.', 'apRecoveryContact apRecentlyDeleted'),
          d('Passkeys can move between managers', 'In the 2025 releases a user can move passkeys to another credential manager, gated by Face ID or Touch ID and using a FIDO Alliance format, with no unencrypted file.', 'apWwdcPasskeys')]
      },
      google: {
        sec: [d('Synced end-to-end encrypted', 'Google documents that passkeys in Google Password Manager are end-to-end encrypted, and that adding a new device needs your screen lock or a Password Manager PIN.', 'gPasskeyE2E')],
        pri: [d('Biometrics stay on the device', 'Google states that fingerprint and face data stay on the device and are never shared with Google.', 'gPasskeysAbout')],
        qa: [d('Open code, paid bounty', 'Chromium is public source, and Chrome security bugs are paid through Google’s vulnerability reward programme.', 'gChromeVrp'),
          t('Forget the PIN on a new laptop', 'Enter a wrong Password Manager PIN until it locks, then follow the documented reset and confirm what it deletes.')],
        gov: [l('Forgetting the PIN can cost every passkey', 'If the PIN cannot be recovered from any device, the documented last resort is resetting passkeys, which deletes them.', 'gPinManage'),
          l('Removing it from the account is only half', 'Google’s passkey guidance notes that removing a passkey from the account removes the server’s public key; the private key stays in the credential manager until the user deletes it there.', 'gPasskeyJourneys')]
      },
      microsoft: {
        sec: [d('Phishing-resistant by design', 'Microsoft describes passkeys as a standards-based, phishing-resistant method and reports far higher sign-in success with passkeys than with passwords.', 'msPasskeys2025')],
        pri: [d('Windows Hello data does not roam', 'Microsoft documents that the Windows Hello PIN and biometric data stay on the device, protected by the TPM, and are not synced.', 'msHelloBook')],
        qa: [d('Certified, and in the identity bounty', 'Windows Hello received FIDO2 certification in 2019, and Microsoft’s identity bounty covers Microsoft accounts.', 'fidoHello msIdBounty'),
          t('Delete in one place, check the other two', 'Remove a passkey in Windows settings and confirm the site still lists it until it is removed from the account too.')],
        gov: [d('Passwordless by default for new accounts', 'Since May 2025, new Microsoft accounts are created without a password by default.', 'msPasskeys2025'),
          l('Three places to delete', 'Microsoft documents separate removal on the account, on the device and in the syncing provider.', 'msManagePasskeys')]
      }
    },
    read: {
      agree: 'All three keep the biometric on the device, give each site its own public key, and sync the private keys end-to-end encrypted. The phishing arrow is closed the same way everywhere.',
      differ: 'What happens when you lose everything differs: Apple offers a recovery contact or key, Google’s documented fallback is a reset that deletes passkeys, and Microsoft splits deletion across the account, the device and the sync provider.',
      watch: 'The recovery path. It is where an end-to-end encrypted key is restored or lost for good, and where deleting on the phone and deleting at the site fall out of step.'
    }
  });

  /* ── 2 · browser ─────────────────────────────────────────── */
  P({ id: 'browser', n: 'Browser', t: 'Who else is on the page?',
    lede: 'The page you see is one arrow. The scripts, cookies and requests you do not see are dozens more, each going to a party you did not visit. A browser decides by default which of those arrows fire, and each of these three decides differently.',
    arrow: ['You', 'Browser', 'The site', 'Embedded third parties'], hot: 3,
    cos: ['apple', 'google', 'mozilla'],
    names: { apple: 'Safari', google: 'Chrome', mozilla: 'Firefox' },
    cells: {
      apple: {
        sec: [d('Browser escapes are paid for', 'The Apple Security Bounty pays for WebKit sandbox escapes.', 'apBounty')],
        pri: [d('Fingerprinting limits in every tab', 'In Safari 26, Advanced Fingerprinting Protection is on by default for all browsing, restricting known fingerprinting scripts’ access to APIs such as canvas, audio and screen.', 'wkSafari26'),
          s('Private Relay hides your IP address', 'With iCloud+, Private Relay sends Safari traffic through two relays so no single party sees both your IP address and the site. It is off unless you subscribe and turn it on.', 'apPrivateRelay')],
        qa: [d('The engine is open source', 'WebKit is open source and its changes are published.', 'wkSafari26'),
          t('Read the canvas twice', 'In a normal (not private) tab, run a fingerprinting test page and compare canvas and audio readbacks across reloads.')],
        gov: [l('Bookmarks follow your iCloud setting', 'Apple lists Safari Tab Groups as end-to-end encrypted; bookmarks are end-to-end encrypted only with Advanced Data Protection on.', 'apIcloudSec')]
      },
      google: {
        sec: [d('Each site in its own process', 'Chrome’s Site Isolation puts sites in separate sandboxed renderer processes.', 'crSiteIsolation'),
          s('Safe Browsing has two levels', 'Standard protection checks a local list and sends a partial, obfuscated URL through a privacy server. Enhanced protection is opt-in and sends more, including URLs and downloads, to Google.', 'gSafeBrowsing')],
        pri: [s('Third-party cookies stay on', 'Chrome allows third-party cookies by default in normal browsing and blocks them by default in Incognito.', 'gBlock3pc'),
          d('The replacement plan was retired', 'Google said in April 2025 it would keep third-party cookies, and in October 2025 retired most Privacy Sandbox APIs, keeping CHIPS, FedCM and Private State Tokens.', 'gSandboxUpdate')],
        qa: [d('Open code, paid bounty', 'Chromium is public source, with a vulnerability reward programme.', 'gChromeVrp'),
          t('Diff what leaves', 'Capture traffic with Safe Browsing on Standard, then Enhanced, and compare what reaches Google with the documented lists.')],
        gov: [s('Administrators control sign-in and sync', 'Enterprise policies can force or disable browser sign-in and restrict which data types sync.', 'gBrowserSignin')]
      },
      mozilla: {
        sec: [d('Sync is end-to-end encrypted', 'Mozilla documents that Firefox Sync data is encrypted before it leaves the browser and the password that unlocks it is never sent to Mozilla.', 'mzSync')],
        pri: [d('One cookie jar per site, by default', 'Total Cookie Protection has been on by default for desktop users since June 2022.', 'mzTcp'),
          s('Standard blocks known trackers', 'Enhanced Tracking Protection “Standard” blocks social-media trackers, cross-site cookies, cryptominers and known fingerprinters; newer fingerprinting defences started in private windows and Strict mode.', 'mzEtp mzFingerprint')],
        qa: [d('Open source, with a client bounty', 'Firefox is open source and Mozilla’s client bug bounty pays for critical and high-severity flaws.', 'mzBounty'),
          t('Two sites, one iframe', 'Embed the same third-party frame in two sites, write a cookie in one and confirm the other cannot read it in Standard mode.')],
        gov: [l('Forget the password, lose the synced data', 'Because Mozilla never has the key, it cannot recover synced data if you forget your account password.', 'mzSync'),
          d('Terms rewritten in public', 'In 2025 Mozilla introduced terms of use for Firefox and revised them after criticism, tying its rights to the privacy notice.', 'mzTerms')]
      }
    },
    read: {
      agree: 'All three isolate or partition something by default and run public bug bounties. All three let organisations manage the browser by policy.',
      differ: 'Defaults diverge: Safari restricts known fingerprinting scripts in every tab, Firefox partitions cookies per site, and Chrome keeps third-party cookies on in normal browsing after retiring its replacement plan.',
      watch: 'Third-party requests in a normal tab. That is where the default decides who else learns what you read.'
    }
  });

  /* ── 3 · mail ────────────────────────────────────────────── */
  P({ id: 'mail', n: 'Mail', t: 'Does the email read you back?',
    lede: 'An email can carry a one-pixel image. When your app fetches it, the sender learns that you opened the message, when, and from which IP address. Mail providers now step between the pixel and the reader, but none end-to-end encrypts the subject line or the envelope of ordinary email.',
    arrow: ['Sender', 'Mail server', 'Your inbox', 'Remote image', 'Sender again'], hot: 3,
    cos: ['apple', 'google', 'proton'],
    names: { apple: 'Mail and iCloud Mail', google: 'Gmail', proton: 'Proton Mail' },
    cells: {
      apple: {
        sec: [l('Stored mail is not end-to-end encrypted', 'Apple lists iCloud Mail among the categories that stay outside end-to-end encryption even with Advanced Data Protection, because mail must interoperate with the global email system.', 'apIcloudSec')],
        pri: [s('Mail Privacy Protection', 'With Protect Mail Activity on, your IP address is hidden from senders and remote content is downloaded privately in the background when a message arrives, not when you open it.', 'apMpp'),
          d('A different address for every sender', 'Hide My Email in iCloud+ creates unique, random addresses that forward to your inbox.', 'apHme')],
        qa: [d('Closed app, paid bounty', 'The Apple Security Bounty includes unauthorised access to iCloud account data.', 'apBounty'),
          t('Fire a pixel you control', 'Log the image fetch: with protection on, it should come at delivery from a relay address, never at opening from the reader’s own IP.')],
        gov: [d('A copy on request, requests counted', 'Apple’s Data and Privacy portal returns a copy of account data, and a twice-yearly Transparency Report counts government requests.', 'apDataCopy apTransparency')]
      },
      google: {
        sec: [l('Confidential mode is not encryption', 'Google documents that confidential mode blocks forwarding, copying, printing and downloading and lets the sender revoke access, but cannot stop screenshots or photos.', 'gConfidential')],
        pri: [d('Mail is not used for ads', 'Google stopped using consumer Gmail content for ads personalisation in 2017.', 'gGmailAds'),
          s('Images arrive through Google’s proxy', 'Gmail serves message images through Google’s own proxy servers; showing external images automatically is a setting.', 'gImages')],
        qa: [d('Covered by Google’s rewards', 'Google’s vulnerability reward programme covers issues that substantially affect the confidentiality or integrity of user data.', 'gVrp'),
          t('When, and from where, does the pixel load?', 'Log the fetch with external images on and off; revoke a confidential-mode message and confirm it is unreadable on web and mobile.')],
        gov: [s('Customer-held keys for some Workspace editions', 'Client-side encryption encrypts body and attachments with keys the organisation holds; headers, subject, recipients and timestamps are not encrypted. It is off by default.', 'gCse'),
          d('A warrant for content, requests counted', 'Google says it requires a search warrant for Gmail content in criminal cases and publishes request statistics every six months.', 'gRequestsFaq')]
      },
      proton: {
        sec: [d('End-to-end between Proton users', 'Proton documents end-to-end encryption for bodies and attachments between Proton users and for password-protected mail; mail from other providers arrives over TLS and is then stored with zero-access encryption.', 'prEnc')],
        pri: [l('Subjects and addresses are not end-to-end', 'Proton states that subject lines and sender and recipient addresses are encrypted, but not end-to-end, for compatibility with email standards.', 'prWhat'),
          s('Tracker protection', 'Proton blocks known tracking pixels, loads remote images through its proxy and cleans tracking links on the web client.', 'prTracker')],
        qa: [d('Open-source, audited apps', 'Proton publishes its app source code and independent audit reports, and runs a public bug bounty.', 'prOss prBounty'),
          t('Read what the server can read', 'Send from the open-source client to an outside address and confirm the server sees the subject and addresses, as documented, but never a Proton-to-Proton body.')],
        gov: [d('Swiss orders, published', 'Proton’s transparency report counts the legally binding orders it receives under Swiss law.', 'prTransparency'),
          d('Your mail, out', 'A free, open-source export tool downloads decrypted mail with its metadata.', 'prExport')]
      }
    },
    read: {
      agree: 'All three put something between the sender’s remote content and the reader — a relay, a proxy or a blocker. None end-to-end encrypts the subject line or the envelope of ordinary email.',
      differ: 'Apple and Google hold the keys to stored mail (Workspace client-side encryption aside); Proton cannot read stored mail. Proton’s apps are open source and audited; Apple’s and Google’s are closed and checked through bounties.',
      watch: 'The pixel fetch. When it happens and whose IP address it comes from can be tested directly, and it is the whole of the privacy claim.'
    }
  });

  /* ── 4 · messages ────────────────────────────────────────── */
  P({ id: 'messages', n: 'Messages', t: 'Who else can read the conversation?',
    lede: 'All three encrypt the conversation end to end. The differences live at the edges: whether the protection can switch off, what the servers still see, and who holds the key to the backup.',
    arrow: ['You', 'Your phone', 'Relay server', 'Their phone', 'Backup'], hot: 4,
    cos: ['apple', 'google', 'meta'],
    names: { apple: 'iMessage', google: 'Google Messages (RCS)', meta: 'WhatsApp' },
    cells: {
      apple: {
        sec: [d('End-to-end, post-quantum', 'Apple documents that iMessage content and attachments are end-to-end encrypted and not stored by Apple, and has rolled out the post-quantum PQ3 protocol since iOS 17.4.', 'apImessage apPq3')],
        pri: [l('Routing data remains', 'Timestamps and push-routing metadata are not end-to-end encrypted; Apple’s legal guidelines say lookup logs, without content, are kept up to 25 days.', 'apImessage apLegal')],
        qa: [s('Check the keys yourself', 'Contact Key Verification, when turned on, alerts you if a key the servers present does not match and lets two people compare codes.', 'apCkv'),
          t('Add a device and watch for the alert', 'With verification on for two test accounts, add a new device to one and confirm the other is warned.')],
        gov: [l('The backup can hold the key', 'With iCloud Backup on and Advanced Data Protection off, the backup includes a copy of the Messages in iCloud key, protected by keys Apple holds. Advanced Data Protection is off by default.', 'apIcloudSec'),
          l('Not offered to new UK users', 'Since February 2025 Apple cannot offer Advanced Data Protection to new users in the United Kingdom.', 'apAdpUk')]
      },
      google: {
        sec: [d('End-to-end when every condition holds', 'RCS chats in Google Messages are end-to-end encrypted, one-to-one and in groups, when everyone uses RCS; SMS and MMS never are. A lock icon marks encrypted chats.', 'gMsgE2E'),
          d('Across iPhone and Android, in beta', 'End-to-end encrypted RCS between Android and iPhone began rolling out in May 2026, needing current apps and carrier support on both ends.', 'gRcsXplat apRcsBeta')],
        pri: [l('Operational metadata remains', 'Google documents that its servers can still use sender and recipient numbers, timestamps, IP or connection information and carriers.', 'gMsgMeta'),
          l('Chats with Gemini are not end-to-end', 'Conversations with Gemini inside Messages are not end-to-end encrypted.', 'gGeminiMsgs')],
        qa: [d('Published protocol paper', 'Google publishes a technical paper describing its end-to-end encryption; the app itself is closed.', 'gMsgPaper'),
          t('A matrix, not a single test', 'Try Android and iPhone, supported and unsupported carriers, one-to-one and group; the lock must appear only when every condition holds, and a fall-back to SMS must be visible every time.')],
        gov: [d('Backups tied to your screen lock', 'Android backup end-to-end encrypts some data with the screen-lock PIN, pattern or password.', 'gAndroidBackup')]
      },
      meta: {
        sec: [d('End-to-end, always on', 'WhatsApp documents end-to-end encryption for messages, media, voice notes and calls, and that there is no way to turn it off.', 'waE2E')],
        pri: [l('Metadata is collected', 'WhatsApp’s privacy policy lists usage and log information — activity, frequency, online status — and connection information such as IP address and device identifiers.', 'waPolicy'),
          d('AI requests in sealed hardware', 'Meta documents Private Processing: AI requests go encrypted into trusted execution environments that it says Meta cannot access, and nothing is stored.', 'metaPrivateProc')],
        qa: [d('Key transparency and a bounty', 'WhatsApp publishes key transparency through an open-source auditable key directory, and Meta’s bug bounty covers WhatsApp and Private Processing.', 'waKeyTransp metaBountyPp'),
          t('Reinstall and verify', 'Reinstall one test account and confirm the security-code change is shown to the other side and the key-transparency proof verifies.')],
        gov: [s('Encrypted backups are opt-in', 'End-to-end encrypted backups are optional, secured by a password or a 64-digit key; if the key is lost, WhatsApp cannot restore the backup.', 'waBackups'),
          d('Content is not produced', 'WhatsApp says it cannot and does not produce message content to governments; Meta publishes request data twice a year.', 'waGovReq')]
      }
    },
    read: {
      agree: 'All three end-to-end encrypt the content of native conversations, and all three document that servers still see routing metadata. Each offers some way to check keys.',
      differ: 'WhatsApp’s encryption cannot be switched off; Google Messages depends on RCS, the other person’s phone and the carrier. On backups, Apple’s and WhatsApp’s strongest options are opt-in, while Android ties backup encryption to the screen lock.',
      watch: 'The backup. In transit the message is encrypted by default everywhere; the backup copy is where defaults decide who holds the key.'
    }
  });

  /* ── 5 · wallet & ID ─────────────────────────────────────── */
  P({ id: 'wallet', n: 'Wallet & ID', t: 'What does the tap reveal?',
    lede: 'Tapping to pay sends a stand-in for your card number. Showing a digital ID can prove you are over 21 without your name or birth date. The token protects you from the merchant; what the wallet maker itself keeps is a separate question.',
    arrow: ['You', 'Wallet', 'Terminal or verifier', 'Payment network', 'Wallet maker'], hot: 4,
    cos: ['apple', 'google', 'samsung'],
    names: { apple: 'Apple Wallet and Apple Pay', google: 'Google Wallet', samsung: 'Samsung Wallet' },
    cells: {
      apple: {
        sec: [d('A device number, not your card number', 'Apple documents that the issuer creates a Device Account Number, kept in the Secure Element, never stored on Apple’s servers or backed up to iCloud; each payment adds a one-time code.', 'apPay'),
          d('The ID is bound to the phone', 'The private key for an ID in Wallet stays in the Secure Element, and each data element is signed.', 'apIdSec')],
        pri: [d('Apple does not see where the ID is shown', 'Apple states it cannot see when or where you present your Digital ID or what was shared; only the requested fields leave, after Face ID or Touch ID.', 'apDigitalId apIdPrivacy'),
          d('Card payments are not tied back to you', 'Apple documents that it does not keep transaction information that can be tied back to you for card payments.', 'apPay')],
        qa: [d('Documented components, paid bounty', 'The Apple Platform Security guide documents Apple Pay components; the Security Bounty pays for breaking them.', 'apPayComp apBounty'),
          t('Ask only for “over 21”', 'Present an ID to a test ISO 18013-5 reader requesting only age; confirm no birth date, name or address comes back.')],
        gov: [d('Enrolment data deleted after issue', 'Apple documents that passport chip data is deleted from its servers right after issuance, and the selfie and movement video shortly after approval.', 'apIdLegal'),
          l('US only', 'The Digital ID from a US passport works only in the US and does not replace a passport for travel.', 'apDigitalId')]
      },
      google: {
        sec: [d('A virtual card number', 'Google documents virtual card numbers that stand in for the real card online and in apps.', 'gVirtualCard'),
          d('IDs stay on the device', 'ID passes and state IDs are stored encrypted on the device, not in the Google Account, and nothing is shared without device authentication.', 'gWalletId')],
        pri: [d('Prove your age with a zero-knowledge proof', 'Google’s age assurance proves “over 18” without revealing a birth date, and it open-sourced the proof libraries in 2025.', 'gZkp'),
          s('Transaction data, and a personalisation switch', 'The Wallet privacy notice documents collecting transaction data; a Wallet personalisation setting controls its use across Google.', 'gWalletNotice gWalletManage')],
        qa: [d('The cryptography is public', 'The zero-knowledge proof library is open source and was presented to the IETF research group, so the maths itself can be reviewed.', 'gZkp ietfLongfellow'),
          t('Two presentations, unlinkable?', 'Request age-over-18 twice from the same wallet; confirm the verifier gets a valid proof, no birth date, and bytes that cannot be linked.')],
        gov: [l('Device-only means no export', 'Because the ID is saved on the device and not in the account, Google Takeout cannot export it.', 'gWalletId')]
      },
      samsung: {
        sec: [d('Tokens, and Knox underneath', 'Samsung documents that tokenisation replaces the card number and that Knox keeps payment and biometric data in a hardware-isolated environment.', 'ssWalletSec')],
        pri: [d('Transaction and usage data are collected', 'Samsung’s Wallet privacy notice lists payment attempts, merchants and amounts, and how and when Wallet is used.', 'ssWalletPrivacy'),
          d('A standard mobile ID', 'Samsung’s digital ID follows the ISO mobile driving licence standard, is stored on the device and is released only after fingerprint or PIN.', 'ssDigitalId')],
        qa: [d('A mobile rewards programme', 'Samsung runs a mobile security rewards programme with Knox in scope.', 'ssRewards'),
          t('Trip the integrity check', 'On a test device, unlock the bootloader and confirm Wallet refuses to provision or pay; wipe Wallet remotely and confirm the issuer shows the tokens deactivated.')],
        gov: [l('A compromised phone loses Wallet for good', 'Knox permanently disables Samsung Wallet on a device it detects as compromised.', 'ssWalletSec'),
          d('Delete per device or per account', 'Wallet data can be removed per device or account-wide through Samsung’s privacy portal.', 'ssWalletPrivacy')]
      }
    },
    read: {
      agree: 'All three replace the card number with a device-bound token, gate payment and ID behind a biometric or PIN, and keep ID credentials on the device.',
      differ: 'Apple states it cannot see where an ID is shown and does not tie card transactions to you; Google and Samsung document collecting transaction details. Google alone has published its age-proof cryptography.',
      watch: 'Transaction data flowing from the wallet to the wallet maker. The token hides the card from the merchant; it says nothing about what the platform keeps.'
    }
  });

  /* ── 6 · cloud backup ────────────────────────────────────── */
  P({ id: 'backup', n: 'Cloud backup', t: 'Who holds the key to your photos?',
    lede: 'Every backup is encrypted. The question that separates them is who holds the key: the provider, so it can recover your account and scan the content, or only your devices, so nobody else can — including the provider, and including anyone who can compel it.',
    arrow: ['Phone', 'Upload', 'Provider cloud', 'Recovery', 'Anyone who can compel'], hot: 3,
    cos: ['apple', 'google', 'microsoft'],
    names: { apple: 'iCloud', google: 'Android backup, Google Photos and Drive', microsoft: 'OneDrive' },
    cells: {
      apple: {
        sec: [d('Standard protection by default', 'Apple documents that under Standard Data Protection it holds the keys for most categories so it can help with recovery; some categories, such as Keychain and Health, are always end-to-end encrypted.', 'apIcloudSec')],
        pri: [s('Advanced Data Protection is opt-in', 'Turning on Advanced Data Protection extends end-to-end encryption to Backup, Drive, Photos, Notes and more; Mail, Contacts and Calendar stay out because they must work with global standards.', 'apAdp'),
          l('Not offered to new UK users', 'Since February 2025 Apple cannot offer Advanced Data Protection to new users in the United Kingdom.', 'apAdpUk')],
        qa: [d('Key design published', 'The Platform Security guide documents iCloud and Advanced Data Protection keys; the Security Bounty covers unauthorised access to iCloud data.', 'apIcloudOverview apBounty'),
          t('Try to enrol without a way back', 'Remove every recovery contact and key and confirm enrolment in Advanced Data Protection is blocked.')],
        gov: [l('You hold the only recovery', 'Under Advanced Data Protection Apple holds no recovery keys; you need a recovery contact or key, or risk permanent loss.', 'apAdp'),
          d('A copy on request', 'Apple’s Data and Privacy portal returns account data and iCloud content after verifying identity.', 'apDataCopy')]
      },
      google: {
        sec: [d('Device backups end-to-end encrypted', 'Google documents that some Android backup data is end-to-end encrypted with the screen-lock PIN, pattern or password, and recommends a real lock rather than swipe.', 'gAndroidBackup'),
          d('Guesses limited in secure hardware', 'Google described backup keys wrapped by the lock-screen secret and held in Titan chips that rate-limit guesses.', 'gBackupTitan')],
        pri: [l('Photos are not end-to-end encrypted', 'Google documents that Google Photos content is not encrypted with the screen lock: it is encrypted in transit and at rest under keys Google controls.', 'gAndroidBackup'),
          s('Customer-held keys for Workspace', 'Workspace, not consumer accounts, offers client-side encryption with keys the organisation holds.', 'gCseFaq')],
        qa: [d('A public third-party audit', 'NCC Group’s 2018 audit of the backup design is public.', 'nccBackup'),
          t('Wrong PIN on a new phone', 'Restore to a new device, enter a wrong lock-screen secret repeatedly and confirm app data locks out while Photos still syncs — showing where the end-to-end boundary sits.')],
        gov: [d('Takeout and a 30-day bin', 'Google Takeout exports your data; Drive trash is deleted automatically after 30 days.', 'gTakeout gDriveDelete'),
          d('Inactive accounts can be deleted', 'Personal accounts inactive for two years may be deleted, including Drive and Photos content.', 'gInactive')]
      },
      microsoft: {
        sec: [d('Encrypted at rest, keys held by Microsoft', 'Microsoft documents BitLocker disk encryption and a unique key per file at rest, plus TLS in transit; Microsoft manages the keys.', 'msOneDriveSafe'),
          s('Personal Vault adds a second check', 'Personal Vault asks for a second verification step and locks after inactivity.', 'msVault')],
        pri: [l('A vault is a gate, not end-to-end encryption', 'Personal Vault files are encrypted in the cloud like other OneDrive files, under keys Microsoft holds.', 'msVault msOneDriveSafe')],
        qa: [d('OneDrive is in the bounty', 'Microsoft’s 365 bounty lists OneDrive domains in scope.', 'msM365Bounty'),
          t('Day 29 and day 31', 'Delete a file and confirm it restores from the recycle bin until day 30 and not after; lock the vault and confirm a direct link cannot read it.')],
        gov: [d('A 30-day recycle bin', 'Recycle-bin items in personal accounts are deleted automatically 30 days after they are put there.', 'msRestore'),
          l('Over quota for six months', 'An account over its storage quota becomes read-only, and after six months its files may be deleted for good.', 'msQuota')]
      }
    },
    read: {
      agree: 'All three encrypt in transit and at rest under provider-held keys by default, which lets the provider run recovery, search and abuse scanning. All three offer export and a 30-day bin.',
      differ: 'Only Apple offers consumers an end-to-end mode for photos and files, opt-in and not for new UK users. Google end-to-end encrypts device backups by default but not Photos or Drive. Microsoft’s vault adds a gate, not provider-blind encryption.',
      watch: 'Key custody. Whoever holds the key — provider, user or recovery contact — decides who can be compelled to open it.'
    }
  });

  /* ── 7 · AI assistant ────────────────────────────────────── */
  P({ id: 'assistant', n: 'AI assistant', t: 'Where does the question go?',
    lede: 'An assistant is useful because it reads across your mail, messages, photos and calendar. Where that reading happens — on the phone, in a sealed server, or in an ordinary cloud service — decides who else could see the request and how long it lives.',
    arrow: ['Your request', 'On-device model', 'Private cloud', 'Retention', 'Training'], hot: 3,
    cos: ['apple', 'google', 'microsoft'],
    names: { apple: 'Apple Intelligence', google: 'Gemini', microsoft: 'Copilot and Recall' },
    cells: {
      apple: {
        sec: [d('Private Cloud Compute', 'Apple documents that the device encrypts each request to the keys of attested Private Cloud Compute nodes, so only a validated node can read it, and that there is no privileged runtime access.', 'apPccBlog')],
        pri: [d('Used for the request, then not kept', 'Apple says Private Cloud Compute uses personal data only to fulfil the request and never stores it.', 'apPccBlog apAiPrivacy'),
          s('ChatGPT is opt-in', 'The ChatGPT extension is off unless enabled; signed out, the IP address is hidden and OpenAI must not store or train on requests; signed in, OpenAI’s policies apply.', 'apChatgpt')],
        qa: [d('Verifiable by outsiders', 'Apple publishes measurements of production software to a transparency log, provides a Virtual Research Environment, and pays bounties for breaking Private Cloud Compute.', 'apPccResearch'),
          s('A report of what went to the cloud', 'Settings can export an Apple Intelligence Report listing the requests sent to Private Cloud Compute.', 'apAiReport'),
          t('Replay and reconcile', 'Export the report, replay a fixed set of prompts and check that every cloud request matches a published software measurement.')],
        gov: [d('Not used for training', 'Apple says it does not use users’ private personal data or interactions to train its foundation models.', 'apFm2025')]
      },
      google: {
        sec: [d('Private AI Compute', 'Google announced Private AI Compute in November 2025: Gemini runs in attested, encrypted enclaves that Google says are inaccessible even to Google.', 'gPrivateAi'),
          d('Gemini Nano on the device', 'Gemini Nano runs on the phone through a system service that Google says has no direct internet access.', 'gNano')],
        pri: [s('Activity is kept by default', 'Keep Activity is on by default for adults; while on, chats can be reviewed by people and used to improve Google’s AI. With it off, chats are still kept for up to 72 hours.', 'gGeminiHub')],
        qa: [d('AI is in the bounty', 'Gemini is covered by Google’s vulnerability reward programme.', 'gVrp'),
          t('Turn it off and check the export', 'With Keep Activity off, hold a chat, wait 72 hours and confirm a data export no longer contains it.')],
        gov: [s('18 months by default', 'Gemini activity auto-deletes after 18 months by default, adjustable or off.', 'gGeminiManage'),
          l('Reviewed chats stay longer', 'Chats already reviewed by people are disconnected from the account and kept up to three years, even after you delete your activity.', 'gGeminiManage'),
          d('Workspace data is not used for training', 'For Workspace customers, Google says content is not reviewed by people or used to train models outside the domain without permission.', 'gWorkspaceAi')]
      },
      microsoft: {
        sec: [d('Recall is sealed on the PC', 'Microsoft documents that Recall encrypts snapshots and its index with TPM-protected keys usable only inside a virtualisation-based enclave, behind Windows Hello.', 'msRecallArch')],
        pri: [s('Recall is opt-in and local', 'Recall is off unless the user turns it on, snapshots stay on the device, and a sensitive-information filter is on by default.', 'msRecallArch msRecallFilter'),
          s('Consumer Copilot training toggles', 'Consumer Copilot has separate opt-out toggles for training on text and voice conversations.', 'msCopilotControls')],
        qa: [d('Tested, and in the AI bounty', 'Microsoft says its offensive research team and a third party tested Recall; the Copilot bounty pays for AI flaws.', 'msRecallArch msAiBounty'),
          t('Feed it a fake card number', 'Open a page with test card and ID numbers, then search Recall; pass means no snapshot holds them.')],
        gov: [s('Organisations can remove Recall', 'Recall is removed by default on managed commercial devices, and administrators can limit how long snapshots are kept.', 'msManageRecall'),
          d('Enterprise prompts are not training data', 'With enterprise data protection, Microsoft 365 Copilot prompts and responses are not used to train foundation models; they are retained for audit and eDiscovery.', 'msCopilotEdp')]
      }
    },
    read: {
      agree: 'All three split work between an on-device tier and a cloud tier, all three say work content is not used to train general models, and all three run bounties that cover their AI.',
      differ: 'Apple’s cloud tier is documented as stateless and checkable through a public log. Google keeps consumer chats by default, with human review unless switched off. Microsoft’s most intimate data, Recall, never leaves the PC and is opt-in.',
      watch: 'The arrow from device to cloud tier, and what is retained after the answer. “Verifiable” and “we promise” are different kinds of control.'
    }
  });

  /* ── 8 · home & voice ────────────────────────────────────── */
  P({ id: 'voice', n: 'Home & voice', t: 'Who hears the kitchen?',
    lede: 'A voice assistant listens for its wake word in a room where anyone can be speaking. What leaves the room, whether the audio is kept, and whether a person may listen to it are settings — and one of these companies removed a local-processing option in 2025.',
    arrow: ['A voice in the room', 'Speaker', 'Cloud', 'Saved recording', 'Human review'], hot: 3,
    cos: ['apple', 'google', 'amazon'],
    names: { apple: 'Siri and Apple Home', google: 'Google Assistant, Gemini for Home and Nest', amazon: 'Alexa, Echo and Ring' },
    cells: {
      apple: {
        sec: [d('Commands encrypted to the accessory', 'Apple documents that Home commands travel end-to-end encrypted from device through the home hub to the accessory, over HomeKit or Matter.', 'apHomeComm')],
        pri: [s('Audio kept only if you opt in', 'Apple says it does not retain Siri audio unless you opt in to Improve Siri & Dictation; opted-in samples are tied to a random identifier, not your Apple Account.', 'apSiriNews apSiriImprove')],
        qa: [d('Camera video end-to-end encrypted', 'HomeKit Secure Video is end-to-end encrypted, so Apple cannot view recordings.', 'apHsv'),
          t('Opt out, then ask for everything', 'With the improvement setting off, make 20 requests, then request a copy of your data and confirm no audio comes back.')],
        gov: [d('Ten days of video', 'HomeKit Secure Video keeps a rolling 10 days; opted-in Siri audio can be deleted.', 'apHsv apSiriImprove')]
      },
      google: {
        sec: [d('Five years of updates', 'Google commits to automatic security updates for Nest devices for at least five years from launch, and verified boot on newer devices.', 'gNestCommit')],
        pri: [s('Recordings not saved by default', 'Saving voice and audio recordings is off by default; a separate setting lets Google use recordings to improve its services.', 'gNestActivity gHomeGemini')],
        qa: [d('Third-party assessments published', 'Google publishes third-party security assessment results for Nest devices.', 'gNestAssess'),
          t('Default settings, then Takeout', 'Leave audio saving off, use the assistant, then check My Activity and a Takeout export for audio. Pass means none.')],
        gov: [s('Auto-delete after 18 months', 'Gemini for Home activity auto-deletes after 18 months by default, adjustable or off.', 'gHomeGemini')]
      },
      amazon: {
        sec: [d('Nothing sent before the wake word', 'Amazon says Echo devices send nothing to the cloud until the wake word or button is detected, and requests are encrypted in transit.', 'amzPrivacy'),
          s('Ring offers end-to-end video, optionally', 'Ring’s opt-in end-to-end encryption lets only enrolled phones decrypt video, and turns off some features.', 'ringE2E')],
        pri: [l('The local-processing option was removed', 'From 28 March 2025, the “Do not send voice recordings” option on some Echo devices was withdrawn; affected users were moved to “Don’t save recordings”.', 'tcAlexa2025'),
          s('Don’t save, and a review switch', 'With “Don’t save recordings” on, audio is deleted after processing; whether recordings may be reviewed by people is a separate setting.', 'amzDeleteAuto amzPrivacy')],
        qa: [d('Devices are in a bounty', 'Echo and Alexa devices are in scope of Amazon’s vulnerability research programme.', 'amzVrp'),
          l('A regulator’s record', 'In 2023 the FTC and DOJ charged that Amazon kept children’s Alexa recordings and undermined deletion requests; Amazon paid $25 million to settle.', 'ftcAlexa'),
          t('Transcripts too', 'Turn on “Don’t save recordings”, make requests, then export: no audio, and no transcripts derived from it.')],
        gov: [s('Four retention choices', 'Recordings can be kept until deleted, for 18 months, for 3 months, or not saved.', 'amzSettings')]
      }
    },
    read: {
      agree: 'All three send at least some voice requests to the cloud and offer settings that limit whether recordings are kept or heard by people. All three publish security material for home devices.',
      differ: 'Apple keeps no Siri audio unless you opt in, and Google saves none by default. Amazon removed its local-processing option, so audio reaches the cloud and “don’t save” deletes it afterwards.',
      watch: 'The arrow from the speaker to the cloud, now that generative assistants need it — and whether deletion covers the transcripts made from the audio.'
    }
  });

  /* ── 9 · ambient & wearable ──────────────────────────────── */
  /* One company only, on purpose: when this was reviewed, Meta's were the camera glasses
   * on sale with first-party documentation. Google's partners and Snap had announced
   * camera glasses for autumn 2026; they are listed under “What could not be confirmed”. */
  P({ id: 'wearable', n: 'Ambient & wearable', t: 'Who else is inside the frame?',
    lede: 'Camera glasses put a camera, microphones and an assistant into something you already wear. The person asking the question owns the glasses; the people in the frame, at the next table or behind the counter do not. The questions move from “what did I share?” to “what did the glasses observe, about whom, and what survived?”',
    arrow: ['A scene and voices nearby', 'Glasses camera and microphones', 'Wake word or capture', 'Phone app and cloud', 'Stored media and recordings'], hot: 3,
    cos: ['meta'],
    single: 'Only one company is compared: when this was reviewed, Meta’s were the camera glasses on sale with first-party documentation to cite.',
    names: { meta: 'Ray-Ban Meta and Oakley Meta AI glasses' },
    cells: {
      meta: {
        sec: [d('The camera stops if the light is covered', 'Meta documents that if the glasses detect the capture light is blocked or tampered with, the camera is disabled until the light is clear.', 'mtGlassesPrivacy')],
        pri: [d('A light for the people around you', 'A white capture light on the front blinks while photos or video are being captured for the gallery; Meta describes it as there to let others know.', 'mtGlassesPrivacy'),
          l('Background sound is part of the interaction', 'Meta’s voice privacy notice says voice interactions include accidental activations and any background sound while the assistant is listening.', 'mtVoiceNotice'),
          s('Visual data from AI features', 'Meta documents a setting for storing visual data from AI experiences such as live AI; its default could not be confirmed on Meta’s own page.', 'mtVisualData')],
        qa: [d('Mistaken wakes are labelled and deleted', 'When Meta’s systems detect an activation nobody intended, it is labelled a false wake and deleted within 90 days of detection.', 'mtVoiceNotice'),
          t('Say something close to the wake word', 'With a television and a conversation nearby, use similar-sounding phrases, then read the voice activity log: anything the wearer did not intend to send is a finding.')],
        gov: [d('Voice kept up to a year', 'Voice recordings, transcripts and related data are kept for up to one year to improve Meta’s products, can be deleted sooner in the voice activity log, and may be reviewed by trained people.', 'mtVoiceNotice'),
          d('Photos stay on the glasses until imported', 'Captured media stays on the glasses until it is imported into the Meta AI app, then moves to the phone’s photo library.', 'mtMediaStorage'),
          l('Some sharing goes through the cloud', 'Features such as sending a photo by voice can send media to Meta’s cloud, where it is kept for 30 days and then deleted automatically.', 'mtCloudMedia')]
      }
    },
    read: {
      agree: 'A capture light that the camera depends on, voice recordings kept up to a year by default and deletable, false wakes deleted within 90 days, and media that stays on the glasses until imported.',
      differ: 'What the people in the frame are told beyond the light, the default for visual data from AI features, and whether wake-word detection runs on the glasses or the phone.',
      watch: 'The arrow from the glasses to the cloud: what is sent (a frame, audio, or only what was asked), how long it is kept, and whether the people in it know.'
    }
  });

  /* ── sources: the company's own page wherever possible ───── */
  var S = C.sources = {};
  var src = function (k, g, c, u) { S[k] = { g: g, c: c, u: u }; };
  /* Apple */
  src('apPasskeySec', 'Apple', 'Apple Support, “About the security of passkeys”.', 'https://support.apple.com/en-us/102195');
  src('apKeychain', 'Apple', 'Apple Platform Security, “iCloud Keychain security overview”.', 'https://support.apple.com/guide/security/icloud-keychain-security-overview-sec1c89c6f3b/web');
  src('apPlatformSec', 'Apple', 'Apple, Apple Platform Security guide (PDF).', 'https://help.apple.com/pdf/security/en_US/apple-platform-security-guide.pdf');
  src('apBounty', 'Apple', 'Apple Security Research, “Apple Security Bounty categories”.', 'https://security.apple.com/bounty/categories/');
  src('apRecoveryContact', 'Apple', 'Apple Platform Security, “Account Recovery Contact security”.', 'https://support.apple.com/guide/security/account-recovery-contact-security-secafa525057/web');
  src('apRecentlyDeleted', 'Apple', 'Apple Support, “Recover a recently deleted password or passkey on Mac”.', 'https://support.apple.com/guide/passwords/recover-a-password-mchlee73013a/mac');
  src('apWwdcPasskeys', 'Apple', 'Apple Developer, “What’s new in passkeys”, WWDC25 session 279.', 'https://developer.apple.com/videos/play/wwdc2025/279/');
  src('wkSafari26', 'Apple', 'WebKit, “WebKit features in Safari 26.0”.', 'https://webkit.org/blog/17333/webkit-features-in-safari-26-0/');
  src('apPrivateRelay', 'Apple', 'Apple Support, “Protect web browsing with iCloud Private Relay on iPhone”.', 'https://support.apple.com/guide/iphone/protect-web-browsing-icloud-private-relay-iph499d287c2/ios');
  src('apIcloudSec', 'Apple', 'Apple Support, “iCloud data security overview”.', 'https://support.apple.com/en-us/102651');
  src('apMpp', 'Apple', 'Apple Support, “Use Mail Privacy Protection on iPhone”.', 'https://support.apple.com/guide/iphone/use-mail-privacy-protection-iphf084865c7/ios');
  src('apHme', 'Apple', 'Apple Support, “Use Hide My Email on iPhone”.', 'https://support.apple.com/guide/iphone/use-hide-my-email-iphf277f837e/ios');
  src('apDataCopy', 'Apple', 'Apple Support, “Get a copy of the data associated with your Apple Account”.', 'https://support.apple.com/en-us/HT208502');
  src('apTransparency', 'Apple', 'Apple, “Transparency Report”.', 'https://www.apple.com/legal/transparency/');
  src('apImessage', 'Apple', 'Apple Platform Security, “How iMessage sends and receives messages securely”.', 'https://support.apple.com/guide/security/how-imessage-sends-and-receives-messages-sec70e68c949/web');
  src('apPq3', 'Apple', 'Apple Security Research, “iMessage with PQ3”.', 'https://security.apple.com/blog/imessage-pq3/');
  src('apLegal', 'Apple', 'Apple, “Legal Process Guidelines — U.S.” (PDF).', 'https://www.apple.com/legal/privacy/law-enforcement-guidelines-us.pdf');
  src('apCkv', 'Apple', 'Apple Support, “About iMessage Contact Key Verification”.', 'https://support.apple.com/en-us/118246');
  src('apAdpUk', 'Apple', 'Apple Support, “Apple can no longer offer Advanced Data Protection in the United Kingdom to new users”.', 'https://support.apple.com/en-us/122234');
  src('apRcsBeta', 'Apple', 'Apple Newsroom, “End-to-end encrypted RCS messaging begins rolling out today in beta”, May 2026.', 'https://www.apple.com/newsroom/2026/05/end-to-end-encrypted-rcs-messaging-begins-rolling-out-today-in-beta/');
  src('apPay', 'Apple', 'Apple Support, “Apple Pay security and privacy overview”.', 'https://support.apple.com/en-us/101554');
  src('apIdSec', 'Apple', 'Apple Platform Security, “Security of IDs in Apple Wallet”.', 'https://support.apple.com/guide/security/security-of-ids-in-apple-wallet-secb569bf393/web');
  src('apDigitalId', 'Apple', 'Apple Newsroom, “Apple introduces Digital ID”, November 2025.', 'https://www.apple.com/newsroom/2025/11/apple-introduces-digital-id-a-new-way-to-create-and-present-an-id-in-apple-wallet/');
  src('apIdPrivacy', 'Apple', 'Apple Support, “IDs in Apple Wallet: privacy and security overview”.', 'https://support.apple.com/en-us/118260');
  src('apPayComp', 'Apple', 'Apple Platform Security, “Apple Pay component security”.', 'https://support.apple.com/guide/security/apple-pay-component-security-sec2561eb018/web');
  src('apIdLegal', 'Apple', 'Apple Legal, “IDs in Wallet & Privacy”.', 'https://www.apple.com/legal/privacy/data/en/identity/');
  src('apAdp', 'Apple', 'Apple Platform Security, “Advanced Data Protection for iCloud”.', 'https://support.apple.com/guide/security/advanced-data-protection-for-icloud-sec973254c5f/web');
  src('apIcloudOverview', 'Apple', 'Apple Platform Security, “iCloud security overview”.', 'https://support.apple.com/guide/security/icloud-security-overview-secacde2d0da/web');
  src('apPccBlog', 'Apple', 'Apple Security Research, “Private Cloud Compute: a new frontier for AI privacy in the cloud”.', 'https://security.apple.com/blog/private-cloud-compute/');
  src('apAiPrivacy', 'Apple', 'Apple Support, “Apple Intelligence and privacy on iPhone”.', 'https://support.apple.com/guide/iphone/apple-intelligence-and-privacy-iphe3f499e0e/ios');
  src('apChatgpt', 'Apple', 'Apple Legal, “ChatGPT Extension & Privacy”.', 'https://www.apple.com/legal/privacy/data/en/chatgpt-extension/');
  src('apPccResearch', 'Apple', 'Apple Security Research, “Security research on Private Cloud Compute”.', 'https://security.apple.com/blog/pcc-security-research/');
  src('apAiReport', 'Apple', 'Apple Support, “Apple Intelligence and privacy on Mac”.', 'https://support.apple.com/guide/mac-help/apple-intelligence-and-privacy-mchlfc0d4779/mac');
  src('apFm2025', 'Apple', 'Apple Machine Learning Research, “Updates to Apple’s on-device and server foundation language models”, 2025.', 'https://machinelearning.apple.com/research/apple-foundation-models-2025-updates');
  src('apHomeComm', 'Apple', 'Apple Platform Security, “HomeKit communication security”.', 'https://support.apple.com/guide/security/communication-security-sec3a881ccb1/web');
  src('apSiriNews', 'Apple', 'Apple Newsroom, “Our longstanding privacy commitment with Siri”, January 2025.', 'https://www.apple.com/newsroom/2025/01/our-longstanding-privacy-commitment-with-siri/');
  src('apSiriImprove', 'Apple', 'Apple Support, “Turn Improve Siri & Dictation on or off”.', 'https://support.apple.com/en-us/127070');
  src('apHsv', 'Apple', 'Apple Support, “iCloud HomeKit Secure Video”.', 'https://support.apple.com/guide/icloud/icloud-homekit-secure-video-mme054c72692/icloud');
  /* Google */
  src('gPasskeyE2E', 'Google', 'Google, “More users can now save passkeys in Google Password Manager”, September 2024.', 'https://blog.google/innovation-and-ai/technology/safety-security/google-password-manager-passkeys-update-september-2024/');
  src('gPasskeysAbout', 'Google', 'Google Account, “Passkeys”.', 'https://www.google.com/account/about/passkeys/');
  src('gChromeVrp', 'Google', 'Chromium, “Chrome VRP news and FAQ”.', 'https://chromium.googlesource.com/chromium/src/+/main/docs/security/vrp-faq.md');
  src('gPinManage', 'Google', 'Google Chrome Help, “Manage your Google Password Manager PIN”.', 'https://support.google.com/chrome/answer/16608973');
  src('gPasskeyJourneys', 'Google', 'Google for Developers, “Passkeys user journeys”.', 'https://developers.google.com/identity/passkeys/ux/user-journeys');
  src('crSiteIsolation', 'Google', 'Chromium, “Site Isolation design document”.', 'https://www.chromium.org/developers/design-documents/site-isolation/');
  src('gSafeBrowsing', 'Google', 'Google Chrome Help, “How Chrome Safe Browsing keeps your browsing data private”.', 'https://support.google.com/chrome/answer/13844634');
  src('gBlock3pc', 'Google', 'Chrome Enterprise, policy “BlockThirdPartyCookies”.', 'https://chromeenterprise.google/policies/block-third-party-cookies/');
  src('gSandboxUpdate', 'Google', 'Privacy Sandbox, “Update on plans for Privacy Sandbox technologies”.', 'https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies');
  src('gBrowserSignin', 'Google', 'Chrome Enterprise, policy “BrowserSignin”.', 'https://chromeenterprise.google/policies/browser-signin/');
  src('gConfidential', 'Google', 'Gmail Help, “Send & open confidential emails”.', 'https://support.google.com/mail/answer/7674059?hl=en');
  src('gGmailAds', 'Google', 'Google, “G Suite’s Gmail and consumer Gmail to more closely align”, June 2017.', 'https://blog.google/products-and-platforms/products/gmail/g-suite-gains-traction-in-the-enterprise-g-suites-gmail-and-consumer-gmail-to-more-closely-align/');
  src('gImages', 'Google', 'Gmail Help, “Turn images on or off in Gmail”.', 'https://support.google.com/mail/answer/145919?hl=en');
  src('gVrp', 'Google', 'Google Bug Hunters, “Google and Alphabet Vulnerability Reward Program rules”.', 'https://bughunters.google.com/about/rules/google-friends/6625378258649088/google-and-alphabet-vulnerability-reward-program-vrp-rules');
  src('gCse', 'Google', 'Gmail Help, “Learn about Gmail client-side encryption”.', 'https://support.google.com/mail/answer/13317990?hl=en');
  src('gRequestsFaq', 'Google', 'Google Transparency Report Help, “Requests for user information FAQs”.', 'https://support.google.com/transparencyreport/answer/9713961?hl=en');
  src('gMsgE2E', 'Google', 'Google Messages Help, “Use end-to-end encryption in Google Messages”.', 'https://support.google.com/messages/answer/10252671?hl=en');
  src('gRcsXplat', 'Google', 'Google, “End-to-end encrypted RCS messaging between Android and iPhone”, May 2026.', 'https://blog.google/products-and-platforms/platforms/android/android-ios-end-to-end-encrypted-rcs-messaging/');
  src('gMsgMeta', 'Google', 'Google Messages Help, “How end-to-end encryption in Google Messages provides more security”.', 'https://support.google.com/messages/answer/10262381?hl=en');
  src('gGeminiMsgs', 'Google', 'Gemini Help, “Use Gemini in Google Messages”.', 'https://support.google.com/gemini/answer/14599070?hl=en');
  src('gMsgPaper', 'Google', 'Google, “Messages end-to-end encryption overview” technical paper (PDF).', 'https://www.gstatic.com/messages/papers/messages_e2ee.pdf');
  src('gAndroidBackup', 'Google', 'Android Help, “Back up or restore data on your Android device”.', 'https://support.google.com/android/answer/2819582');
  src('gVirtualCard', 'Google', 'Google Pay Help, “Use virtual cards to pay online or in apps”.', 'https://support.google.com/googlepay/answer/11234179');
  src('gWalletId', 'Google', 'Google Wallet Help, “Add your US driver’s license or state ID”.', 'https://support.google.com/wallet/answer/12436402');
  src('gZkp', 'Google', 'Google, “Now open source: our zero-knowledge proof libraries for age assurance”, 2025.', 'https://blog.google/innovation-and-ai/technology/safety-security/opening-up-zero-knowledge-proof-technology-to-promote-privacy-in-age-assurance/');
  src('gWalletNotice', 'Google', 'Google, “Google Wallet Privacy Notice”.', 'https://payments.google.com/payments/apis-secure/get_legal_document?ldxi=99120123');
  src('gWalletManage', 'Google', 'Google Wallet Help, “Manage data & privacy in Google Wallet”.', 'https://support.google.com/wallet/answer/16703349');
  src('gBackupTitan', 'Google', 'Google Security Blog, “Google and Android have your back by protecting your backups”, October 2018.', 'https://security.googleblog.com/2018/10/google-and-android-have-your-back-by.html');
  src('gCseFaq', 'Google', 'Google Workspace Admin Help, “Client-side encryption FAQ”.', 'https://support.google.com/a/answer/14328489');
  src('gTakeout', 'Google', 'Google Account Help, “How to download your Google data”.', 'https://support.google.com/accounts/answer/3024190');
  src('gDriveDelete', 'Google', 'Google Drive Help, “Delete files in Google Drive”.', 'https://support.google.com/drive/answer/2375102');
  src('gInactive', 'Google', 'Google, “Updating our inactive account policies”.', 'https://blog.google/innovation-and-ai/technology/safety-security/updating-our-inactive-account-policies/');
  src('gPrivateAi', 'Google', 'Google, “Private AI Compute: our next step in building private and helpful AI”, November 2025.', 'https://blog.google/innovation-and-ai/products/google-private-ai-compute/');
  src('gNano', 'Google', 'Android Developers Blog, “An introduction to privacy and safety for Gemini Nano”, October 2024.', 'https://android-developers.googleblog.com/2024/10/introduction-to-privacy-and-safety-gemini-nano.html');
  src('gGeminiHub', 'Google', 'Gemini Help, “Gemini Apps Privacy Hub”.', 'https://support.google.com/gemini/answer/13594961?hl=en');
  src('gGeminiManage', 'Google', 'Gemini Help, “Manage & delete your activity in Gemini Apps”.', 'https://support.google.com/gemini/answer/13278892?hl=en');
  src('gWorkspaceAi', 'Google', 'Google Workspace, “Generative AI in Google Workspace Privacy Hub”.', 'https://knowledge.workspace.google.com/admin/gemini/generative-ai-in-google-workspace-privacy-hub');
  src('gNestCommit', 'Google', 'Google Safety Center, “Google Nest security & privacy commitments”.', 'https://safety.google/intl/en_us/products/nest/');
  src('gNestActivity', 'Google', 'Google Nest Help, “Activity controls and Google Nest”.', 'https://support.google.com/googlehome/answer/7382500');
  src('gHomeGemini', 'Google', 'Google Home Help, “Manage & delete your Gemini for Home activity”.', 'https://support.google.com/googlehome/answer/16613583?hl=en');
  src('gNestAssess', 'Google', 'Google, “Security updates and third-party assessments for Google Nest devices”.', 'https://support.google.com/product-documentation/answer/10231940');
  /* Microsoft */
  src('msPasskeys2025', 'Microsoft', 'Microsoft Security Blog, “Pushing passkeys forward: Microsoft’s latest updates for simpler, safer sign-ins”, 1 May 2025.', 'https://www.microsoft.com/en-us/security/blog/2025/05/01/pushing-passkeys-forward-microsofts-latest-updates-for-simpler-safer-sign-ins/');
  src('msHelloBook', 'Microsoft', 'Microsoft Learn, “Windows 11 security book — passwordless sign-in”.', 'https://learn.microsoft.com/en-us/windows/security/book/identity-protection-passwordless-sign-in');
  src('fidoHello', 'Microsoft', 'FIDO Alliance, “Microsoft achieves FIDO2 certification for Windows Hello”, May 2019.', 'https://fidoalliance.org/microsoft-achieves-fido2-certification-for-windows-hello/');
  src('msIdBounty', 'Microsoft', 'Microsoft Security Response Center, “Microsoft Identity Bounty”.', 'https://www.microsoft.com/en-us/msrc/bounty-microsoft-identity');
  src('msManagePasskeys', 'Microsoft', 'Microsoft Support, “Manage your saved passkeys”.', 'https://support.microsoft.com/en-us/accounts-billing/security/manage-your-saved-passkeys');
  src('msOneDriveSafe', 'Microsoft', 'Microsoft Support, “How OneDrive safeguards your data in the cloud”.', 'https://support.microsoft.com/en-us/office/how-onedrive-safeguards-your-data-in-the-cloud-23c6ea94-3608-48d7-8bf0-80e142edd1e1');
  src('msVault', 'Microsoft', 'Microsoft Support, “Protect your OneDrive files in Personal Vault”.', 'https://support.microsoft.com/en-us/onedrive/protect-your-onedrive-files-in-personal-vault');
  src('msM365Bounty', 'Microsoft', 'Microsoft Security Response Center, “M365 Bounty”.', 'https://www.microsoft.com/en-us/msrc/bounty-online-services');
  src('msRestore', 'Microsoft', 'Microsoft Support, “Restore files deleted from your OneDrive”.', 'https://support.microsoft.com/en-us/onedrive/restore-deleted-files-or-folders-in-onedrive');
  src('msQuota', 'Microsoft', 'Microsoft Support, “Microsoft storage quotas”.', 'https://support.microsoft.com/en-us/office/microsoft-storage-quotas-8f2f9d72-04d1-4223-a5ae-c2fdd26dd770');
  src('msRecallArch', 'Microsoft', 'Windows Experience Blog, “Update on Recall security and privacy architecture”, September 2024.', 'https://blogs.windows.com/windowsexperience/2024/09/27/update-on-recall-security-and-privacy-architecture/');
  src('msRecallFilter', 'Microsoft', 'Microsoft Support, “Filtering apps, websites and sensitive information in Recall”.', 'https://support.microsoft.com/en-us/windows/ai/ai-features/filtering-apps-websites-and-sensitive-information-in-recall');
  src('msCopilotControls', 'Microsoft', 'Microsoft Support, “Microsoft Copilot privacy controls”.', 'https://support.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-privacy-controls');
  src('msAiBounty', 'Microsoft', 'Microsoft Security Response Center, “Microsoft Copilot (AI) Bounty”.', 'https://www.microsoft.com/en-us/msrc/bounty-ai');
  src('msManageRecall', 'Microsoft', 'Microsoft Learn, “Manage Recall for Windows clients”.', 'https://learn.microsoft.com/en-us/windows/client-management/manage-recall');
  src('msCopilotEdp', 'Microsoft', 'Microsoft Learn, “Microsoft Copilot Chat privacy and protections”.', 'https://learn.microsoft.com/en-us/copilot/privacy-and-protections');
  /* Mozilla */
  src('mzSync', 'Mozilla', 'Mozilla Support, “How Firefox Sync keeps your data safe even if TLS fails”.', 'https://support.mozilla.org/en-US/kb/how-firefox-sync-keeps-your-data-safe-even-if-tls-fails');
  src('mzTcp', 'Mozilla', 'Mozilla, “Firefox rolls out Total Cookie Protection by default to all users worldwide”, June 2022.', 'https://blog.mozilla.org/en/mozilla/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/');
  src('mzEtp', 'Mozilla', 'Mozilla Support, “Enhanced Tracking Protection in Firefox for desktop”.', 'https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop');
  src('mzFingerprint', 'Mozilla', 'Mozilla, “Fingerprinting protections” (Firefox blog).', 'https://blog.mozilla.org/en/firefox/fingerprinting-protections/');
  src('mzBounty', 'Mozilla', 'Mozilla, “Client Bug Bounty Program”.', 'https://www.mozilla.org/en-US/security/client-bug-bounty/');
  src('mzTerms', 'Mozilla', 'Mozilla, “An update on our terms of use”, March 2025.', 'https://blog.mozilla.org/en/firefox/update-on-terms-of-use/');
  /* Proton */
  src('prEnc', 'Proton', 'Proton Support, “How Proton Mail messages are encrypted”.', 'https://proton.me/support/proton-mail-encryption-explained');
  src('prWhat', 'Proton', 'Proton Support, “What is encrypted within Proton Mail?”.', 'https://proton.me/support/what-is-encrypted-within-protonmail');
  src('prTracker', 'Proton', 'Proton Support, “Enhanced email tracker protection”.', 'https://proton.me/support/email-tracker-protection');
  src('prOss', 'Proton', 'Proton, “An open source privacy company”.', 'https://proton.me/community/open-source');
  src('prBounty', 'Proton', 'Proton, “Bug bounty program”.', 'https://proton.me/security/bug-bounty');
  src('prTransparency', 'Proton', 'Proton, “Transparency report”.', 'https://proton.me/legal/transparency');
  src('prExport', 'Proton', 'Proton Support, “Proton Mail Export Tool”.', 'https://proton.me/support/proton-mail-export-tool');
  /* Meta */
  src('waE2E', 'Meta', 'WhatsApp Blog, “End-to-end encryption”.', 'https://blog.whatsapp.com/end-to-end-encryption');
  src('waPolicy', 'Meta', 'WhatsApp, “Privacy Policy”.', 'https://www.whatsapp.com/legal/privacy-policy');
  src('metaPrivateProc', 'Meta', 'Engineering at Meta, “Building Private Processing for AI tools on WhatsApp”, April 2025.', 'https://engineering.fb.com/2025/04/29/security/whatsapp-private-processing-ai-tools/');
  src('waKeyTransp', 'Meta', 'Engineering at Meta, “Deploying key transparency at WhatsApp”, April 2023.', 'https://engineering.fb.com/2023/04/13/security/whatsapp-key-transparency/');
  src('metaBountyPp', 'Meta', 'Meta Bug Bounty, “Private Processing payout guidelines”.', 'https://bugbounty.meta.com/payout-guidelines/private-processing/');
  src('waBackups', 'Meta', 'Engineering at Meta, “How WhatsApp is enabling end-to-end encrypted backups”, September 2021.', 'https://engineering.fb.com/2021/09/10/security/whatsapp-e2ee-backups/');
  src('waGovReq', 'Meta', 'WhatsApp Help Center, “About government requests for user data”.', 'https://faq.whatsapp.com/808280033839222/');
  /* Samsung */
  src('ssWalletSec', 'Samsung', 'Samsung US Support, “How secure is Samsung Wallet?”.', 'https://www.samsung.com/us/support/answer/ANS10002617/');
  src('ssWalletPrivacy', 'Samsung', 'Samsung US, “Samsung Wallet privacy notice”.', 'https://www.samsung.com/us/samsung-wallet/privacy-notice/');
  src('ssDigitalId', 'Samsung', 'Samsung US, “Digital ID in Samsung Wallet”.', 'https://www.samsung.com/us/apps/samsung-wallet/digital-id/');
  src('ssRewards', 'Samsung', 'Samsung Mobile Security, “Mobile Security Rewards Program”.', 'https://security.samsungmobile.com/rewardsProgram.smsb');
  /* Meta: the glasses pages could be confirmed only through their search listings (see the method) */
  src('mtGlassesPrivacy', 'Meta', 'Meta, “Privacy settings for Meta AI glasses”.', 'https://www.meta.com/ai-glasses/privacy/');
  src('mtVoiceNotice', 'Meta', 'Meta, “AI Glasses Voice Privacy Notice”, effective 22 July 2025.', 'https://www.meta.com/legal/ai-glasses/voice-controls-privacy-notice/');
  src('mtMediaStorage', 'Meta', 'Meta Help, “How media storage works with AI glasses and the Meta AI mobile app”.', 'https://www.meta.com/help/ai-glasses/1427588664906909/');
  src('mtCloudMedia', 'Meta', 'Meta Help, “Learn more about cloud media on AI glasses”.', 'https://www.meta.com/help/ai-glasses/734190441863923/');
  src('mtVisualData', 'Meta', 'Meta Help, “Storing visual data from AI experiences”.', 'https://www.meta.com/help/ai-glasses/1381548946634724/');
  /* Amazon */
  src('amzPrivacy', 'Amazon', 'Amazon Help, “Alexa, Echo devices, and your privacy”.', 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GVP69FUJ48X9DK8V');
  src('ringE2E', 'Amazon', 'Ring Support, “Using video end-to-end encryption”.', 'https://ring.com/support/articles/7e3lk/using-video-end-to-end-encryption-e2ee');
  src('amzDeleteAuto', 'Amazon', 'Amazon Help, “Delete Alexa voice recordings and transcripts automatically”.', 'https://www.amazon.com/gp/help/customer/display.html?nodeId=G68KUKTXN92WY3C3');
  src('amzVrp', 'Amazon', 'HackerOne, “Amazon Vulnerability Research Program — devices”.', 'https://hackerone.com/amazonvrp-devices?view_policy=true');
  src('amzSettings', 'Amazon', 'Amazon, “Personalize your Alexa privacy settings”.', 'https://www.amazon.com/b?ie=UTF8&node=23608614011');
  /* standards, regulators and dated press (named as such) */
  src('ietfLongfellow', 'Standards, regulators and press', 'IETF 124, CFRG, “Longfellow ZK” (slides).', 'https://datatracker.ietf.org/meeting/124/materials/slides-124-cfrg-longfellow-zk-01');
  src('nccBackup', 'Standards, regulators and press', 'NCC Group, public report on Google’s encrypted backup design, October 2018 (PDF).', 'https://www.nccgroup.com/media/2biaan4n/_final_public_report_ncc_group_google_encryptedbackup_2018-10-10_v10.pdf');
  src('ftcAlexa', 'Standards, regulators and press', 'U.S. Federal Trade Commission, “FTC and DOJ charge Amazon with violating children’s privacy law by keeping kids’ Alexa voice recordings forever”, May 2023. A settlement; Amazon did not admit wrongdoing.', 'https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-doj-charge-amazon-violating-childrens-privacy-law-keeping-kids-alexa-voice-recordings-forever');
  src('tcAlexa2025', 'Standards, regulators and press', 'TechCrunch, “Amazon’s Echo will send all voice recordings to the cloud, starting March 28”, 15 March 2025 (reporting Amazon’s notice to customers).', 'https://techcrunch.com/2025/03/15/amazons-echo-will-send-all-voice-recordings-to-the-cloud-starting-march-28');
})(typeof window !== 'undefined' ? window : globalThis);
