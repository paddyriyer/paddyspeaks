/* Privacy Command Center v1 — the EVENTS layer.
 *
 * Ordinary things a person does (sign in, search, buy a coffee, ask an
 * assistant) and what each one sets in motion, as one chain:
 *
 *   EVENT → IDENTIFIER → SYSTEM → DERIVED DATA → INFERENCE
 *
 * Everything is synthetic. The ecosystem views (Apple-like, Google-like,
 * Microsoft-like) only relabel the same pattern with familiar product
 * categories; they describe no company’s implementation, and the structure is
 * identical in every view, so they are never a comparison.
 *
 *   types      the kinds of event (the 25 everyday ones and a few more), each with its chain of node ids
 *   nodes      identifiers, systems, data and inferences, each with the answers
 *              “Why is this connected?” shows (purpose, need, retention, who,
 *              whether the contexts can be separated)
 *   day        the morning timeline; cases: the fourteen use cases;
 *   changes    “What changed?” review events
 *
 * Numbers on screen are computed from these records (counts, months, which
 * inferences survive a decision), never typed. Retention days are record values
 * used to decide whether something is kept longer than needed. */
(function () {
  'use strict';
  var G = window.PG, E = G.events = {};
  E.asOf = G.asOf;

  /* ── event families: colour names the kind of event, nothing else ── */
  E.families = [
    { id: 'identity', label: 'Identity' }, { id: 'comms', label: 'Communication' }, { id: 'location', label: 'Location' },
    { id: 'pay', label: 'Payments' }, { id: 'device', label: 'Device' }, { id: 'cloud', label: 'Cloud & files' },
    { id: 'ai', label: 'AI' }, { id: 'ads', label: 'Search, ads & analytics' }, { id: 'security', label: 'Security' },
    { id: 'controls', label: 'Your controls & deletion' }
  ];

  /* ── ecosystems: the same pattern, relabelled ── */
  E.ecos = [
    { id: 'all', label: 'All' },
    { id: 'apple', label: 'Apple-like', services: ['Account', 'iPhone / Mac', 'Safari', 'Mail', 'iCloud', 'Photos', 'Maps', 'Wallet', 'App Store', 'Siri / AI assistant'] },
    { id: 'google', label: 'Google-like', services: ['Account', 'Android', 'Chrome', 'Gmail', 'Drive', 'Photos', 'Maps', 'Wallet', 'Play Store', 'YouTube', 'Gemini-like assistant'] },
    { id: 'ms', label: 'Microsoft-like', services: ['Account', 'Windows', 'Edge', 'Outlook', 'OneDrive', 'Teams', 'Store', 'Xbox', 'Bing / search', 'Copilot-like assistant'] },
    { id: 'mixed', label: 'Mixed devices' }
  ];
  E.ecoNote = 'Apple-like, Google-like and Microsoft-like are synthetic patterns that borrow familiar product categories as labels. Every connection, identifier, retention period and inference here is illustrative; none describes how any company’s products work. The pattern is the same in every view; only the names change.';

  /* ── your devices: one person, several platforms ──
   * Each device kind offers platforms; a platform belongs to a family whose
   * account it signs in to ('' = no platform account, a local sign-in). The
   * device mix is the ONLY thing that changes the graph's shape, and only in
   * the “Devices across platforms” case; ecosystems only relabel. */
  E.devKinds = [
    { id: 'phone', label: 'Phone', node: 'i_dev', opts: [['ios', 'iPhone-like phone', 'apple'], ['android', 'Android-like phone', 'google']] },
    { id: 'laptop', label: 'Laptop', node: 'i_dev2', opts: [['win', 'Windows-like laptop', 'ms'], ['mac', 'Mac-like laptop', 'apple'], ['chromeos', 'Chromebook-like laptop', 'google'], ['linux', 'Linux laptop', '']] },
    { id: 'tablet', label: 'Tablet', node: 'i_dev3', opts: [['androidtab', 'Android-like tablet', 'google'], ['ipad', 'iPad-like tablet', 'apple'], ['wintab', 'Windows-like tablet', 'ms'], ['none', 'No tablet', '']] }
  ];
  E.famAccount = { apple: 'Apple-like Account', google: 'Google-like Account', ms: 'Microsoft-like Account' };
  E.dvDefault = 'ios.win.androidtab';
  E.otherDevices = [
    ['Watch', 'Pairs with the phone; heart rate and location travel through it.'],
    ['TV', 'Signs in to streaming accounts and shares the home Wi-Fi.'],
    ['Car', 'Pairs with the phone; contacts, messages and location go with it.'],
    ['Smart speaker', 'Hears the whole household, on one person’s account.', 'family'],
    ['Game console', 'A gaming account, often a child’s.', 'family'],
    ['Work laptop', 'Managed by your employer.', 'workpersonal'],
    ['Shared family tablet', 'Whose activity is it?', 'family']
  ];
  /* 'ios.win.androidtab' → the three chosen options, each [id, label, family] */
  E.parseDv = function (str) {
    var p = String(str || E.dvDefault).split('.');
    return E.devKinds.map(function (k, i) { return k.opts.filter(function (o) { return o[0] === p[i]; })[0] || k.opts[0]; });
  };
  E.validDv = function (str) { var p = String(str || '').split('.'); return p.length === 3 && E.devKinds.every(function (k, i) { return k.opts.some(function (o) { return o[0] === p[i]; }); }); };
  /* which platform accounts exist, and which devices each one sees */
  E.devAccounts = function (dv) {
    var d = E.parseDv(dv), slots = [['s_account', 'i_acct', 'd_devices'], ['s_account2', 'i_acct2', 'd_devices2'], ['s_account3', 'i_acct3', 'd_devices3']], acc = [];
    d.forEach(function (o, i) {
      if (o[0] === 'none' || !o[2]) return;
      var a = acc.filter(function (x) { return x.fam === o[2]; })[0];
      if (!a) { var sl = slots[acc.length]; a = { fam: o[2], label: E.famAccount[o[2]], sys: sl[0], id: sl[1], data: sl[2], devices: [] }; acc.push(a); }
      a.devices.push(E.devKinds[i].node);
    });
    return acc;
  };
  /* names the device mix gives to nodes */
  E.devLabels = function (dv) {
    var d = E.parseDv(dv), lab = {};
    E.devKinds.forEach(function (k, i) { if (d[i][0] !== 'none') lab[k.node] = d[i][1].replace(/ (phone|laptop|tablet)$/, '') + ' ' + k.label.toLowerCase() + ' ID'; });
    lab.s_os = d[0][1];
    E.devAccounts(dv).forEach(function (a) { lab[a.sys] = a.label; lab[a.id] = a.label + ' ID'; lab[a.data] = 'Devices on the ' + a.label; });
    return lab;
  };

  E.cols = [['event', 'Event'], ['id', 'Identifier'], ['sys', 'System'], ['data', 'Derived data'], ['inf', 'Inference']];
  E.needs = { required: 'Required', useful: 'Useful', optional: 'Optional' };
  E.uses = [['operate', 'Run the service'], ['security', 'Keep the account safe'], ['analytics', 'Measure the product'], ['personalize', 'Personalize'], ['ads', 'Advertising'], ['legal', 'Legal duty'], ['none', 'Nobody asked for it']];
  E.states = { collected: 'Collected', derived: 'Derived', inferred: 'Inferred', shared: 'Shared outside', expired: 'Deleted or expired' };
  E.stab = {
    stable: ['Same everywhere', 'Yes: give this service its own ID, and it can no longer be matched with the others.'],
    scoped: ['Different for each app or site', 'Already separate: this ID works only here.'],
    resettable: ['You can reset it', 'Partly: resetting it breaks the link, but until then it connects your activity.'],
    network: ['Changes with the network', 'Partly: a relay or VPN hides it from the receiver.']
  };

  /* ── nodes ──────────────────────────────────────────────
   * id   identifiers: stab, carry (why it travels with the event)
   * sys  systems: L = [Apple-like, Google-like, Microsoft-like] labels, why, who,
   *      log = [how long the request is kept, days], ext = outside the service
   * data st (collected | derived | shared | expired), why, need, use,
   *      ret = [label, days], enough = days the purpose needs, short = shorter
   *      retention on offer, who, sep, hist (needs history), onDel, to (receiver)
   * inf  why, use, sens, hist; needs = all of these must exist (an AND join) */
  function N(kind, name, o) { o = o || {}; o.kind = kind; o.name = name; return o; }
  var NEVER = ['Not kept after the answer', 0];
  E.nodes = {
    /* identifiers */
    i_acct: N('id', 'Account ID', { stab: 'stable', carry: 'So every service on the account knows it is you.' }),
    i_dev: N('id', 'Phone ID', { stab: 'stable', carry: 'So the service knows which device to answer.' }),
    i_dev2: N('id', 'Laptop ID', { stab: 'stable', carry: 'So the service knows which device to answer.' }),
    i_ip: N('id', 'IP address', { stab: 'network', carry: 'Every request carries one; it is how the answer finds its way back.' }),
    i_cookie: N('id', 'Browser cookie', { stab: 'resettable', carry: 'So the site remembers this browser.' }),
    i_scoped: N('id', 'App-specific ID', { stab: 'scoped', carry: 'So the app can recognize you, and only the app.' }),
    i_adid: N('id', 'Advertising ID', { stab: 'resettable', carry: 'So ads can be counted on this device.', use: 'ads', need: 'optional' }),
    i_phone: N('id', 'Phone number', { stab: 'stable', carry: 'So a code can reach you.', use: 'security' }),
    i_remail: N('id', 'Recovery email', { stab: 'stable', carry: 'So a reset link can reach you.', use: 'security' }),
    i_pk: N('id', 'Passkey', { stab: 'scoped', carry: 'So you can sign in without a password; each site gets its own key.', use: 'security' }),
    i_tok: N('id', 'Payment token', { stab: 'scoped', carry: 'A stand-in card number for this device, so the shop never sees the real one.' }),
    i_dev3: N('id', 'Tablet ID', { stab: 'stable', carry: 'So the service knows which device to answer.' }),
    i_acct2: N('id', 'Second account ID', { stab: 'stable', carry: 'So every service on that platform account knows it is you.' }),
    i_acct3: N('id', 'Third account ID', { stab: 'stable', carry: 'So every service on that platform account knows it is you.' }),
    i_email: N('id', 'Email address', { stab: 'stable', carry: 'The name you sign in with on every platform.' }),
    i_work: N('id', 'Work account ID', { stab: 'stable', carry: 'So the employer’s systems know it is you.' }),

    /* systems */
    s_os: N('sys', 'Phone', { L: ['iPhone / Mac-like', 'Android-like', 'Windows-like'], why: 'runs the device; this stays on it', who: 'Only you, on the device', log: ['Stays on the device', 0], local: true }),
    s_account: N('sys', 'Account service', { L: ['Apple-like Account', 'Google-like Account', 'Microsoft-like Account'], why: 'keeps you signed in on every device', who: 'Account team; account security' }),
    s_account2: N('sys', 'Second platform account', { why: 'keeps you signed in on that platform’s devices', who: 'That platform’s account team' }),
    s_account3: N('sys', 'Third platform account', { why: 'keeps you signed in on that platform’s devices', who: 'That platform’s account team' }),
    s_bridge: N('sys', 'Phone-to-computer link', { why: 'mirrors the phone on the computer', who: 'You; the link service' }),
    s_security: N('sys', 'Security & recovery', { why: 'checks that it is really you', who: 'Account security only', use: 'security', log: ['1 year', 365] }),
    s_mail: N('sys', 'Mail', { L: ['Mail-like', 'Gmail-like', 'Outlook-like'], why: 'delivers and stores your mail', who: 'The mail service' }),
    s_cal: N('sys', 'Calendar', { L: ['Calendar-like', 'Calendar-like', 'Outlook-like calendar'], why: 'keeps your schedule', who: 'The calendar service' }),
    s_search: N('sys', 'Search', { L: ['Safari-like search', 'Search-like', 'Bing-like search'], why: 'answers what you asked', who: 'Search; personalization' }),
    s_browser: N('sys', 'Browser', { L: ['Safari-like', 'Chrome-like', 'Edge-like'], why: 'shows the web', who: 'The browser' }),
    s_maps: N('sys', 'Maps', { L: ['Maps-like', 'Maps-like', 'Bing-like maps'], why: 'gives directions', who: 'Maps' }),
    s_wallet: N('sys', 'Wallet', { L: ['Wallet-like', 'Wallet-like', 'Payment profile'], why: 'pays and keeps the receipt', who: 'Wallet' }),
    s_store: N('sys', 'App store', { L: ['App Store-like', 'Play Store-like', 'Store-like'], why: 'installs and updates apps', who: 'The app store' }),
    s_cloud: N('sys', 'Cloud drive', { L: ['iCloud Drive-like', 'Drive-like', 'OneDrive-like'], why: 'stores and shares files', who: 'Cloud storage' }),
    s_photos: N('sys', 'Photos', { L: ['Photos-like', 'Photos-like', 'OneDrive-like photos'], why: 'stores and sorts photos', who: 'Photos' }),
    s_backup: N('sys', 'Cloud backup', { L: ['iCloud-like backup', 'Drive-like backup', 'OneDrive-like backup'], why: 'copies the whole phone each night', who: 'The backup service' }),
    s_assist: N('sys', 'AI assistant', { L: ['Siri-like assistant', 'Gemini-like assistant', 'Copilot-like assistant'], why: 'answers your question', who: 'The assistant' }),
    s_sync: N('sys', 'Sync', { why: 'keeps every device in step', who: 'Sync' }),
    s_diag: N('sys', 'Diagnostics', { why: 'collects crash and performance reports', who: 'Engineering', use: 'analytics', need: 'useful' }),
    s_ads: N('sys', 'Ads & measurement', { why: 'chooses and counts ads', who: 'Advertising teams', use: 'ads', need: 'optional' }),
    s_export: N('sys', 'Data export', { why: 'builds a copy of your data for you', who: 'You', use: 'legal' }),
    s_delete: N('sys', 'Account deletion', { why: 'deletes the account and its data', who: 'You', use: 'legal' }),
    s_weather: N('sys', 'Weather widget', { why: 'shows local weather', who: 'Weather', need: 'useful' }),
    x_merchant: N('sys', 'The shop', { ext: true, why: 'takes the payment', who: 'The shop' }),
    x_network: N('sys', 'Card network & bank', { ext: true, why: 'approves the payment', who: 'The bank and the card network', log: ['Set by the bank', null] }),
    x_recipient: N('sys', 'The person you shared with', { ext: true, why: 'opens what you shared', who: 'Them, and anyone they forward it to', log: ['Theirs to keep', null] }),
    x_app: N('sys', 'Third-party app', { ext: true, why: 'is the outside app you connected', who: 'The app’s company', log: ['Set by the app', null] }),
    x_site: N('sys', 'The website', { ext: true, why: 'is where you created the passkey', who: 'The website' }),
    x_employer: N('sys', 'Employer IT', { ext: true, why: 'manages work accounts and devices', who: 'Your employer’s IT team', log: ['Set by your employer', null] }),
    x_group: N('sys', 'Group chat', { ext: true, why: 'receives the photo you sent', who: 'Everyone in the chat', log: ['Theirs to keep', null] }),
    x_proc: N('sys', 'Outside processor', { ext: true, why: 'measures feature use under contract', who: 'The processor', use: 'analytics', need: 'optional', log: ['Set by contract', null] }),

    /* data */
    d_screen: N('data', 'Screen-time log', { st: 'collected', why: 'Shows you your own screen time.', need: 'useful', use: 'operate', ret: ['28 days, on the phone', 28], enough: 28, who: 'Only you', sep: 'Already separate: it never leaves the phone.', onDel: 'device' }),
    d_devices: N('data', 'Signed-in devices', { st: 'collected', why: 'Lets you see and remove the devices on your account.', need: 'required', use: 'security', ret: ['While each device stays signed in', null], who: 'You; account security', sep: 'No: this list exists to connect your devices.', onDel: 'delete' }),
    d_devices2: N('data', 'Signed-in devices, second account', { st: 'collected', why: 'Lets you see and remove the devices on that account.', need: 'required', use: 'security', ret: ['While each device stays signed in', null], who: 'You; that account’s security', sep: 'No: this list exists to connect your devices.', onDel: 'delete' }),
    d_devices3: N('data', 'Signed-in devices, third account', { st: 'collected', why: 'Lets you see and remove the devices on that account.', need: 'required', use: 'security', ret: ['While each device stays signed in', null], who: 'You; that account’s security', sep: 'No: this list exists to connect your devices.', onDel: 'delete' }),
    d_bridged: N('data', 'Texts, calls and photos on the laptop', { st: 'collected', why: 'Lets you answer the phone from the computer.', need: 'optional', use: 'operate', ret: ['Until you unlink the devices', null], who: 'You; both devices', sep: 'Yes: unlink the phone, or turn off messages and photos.', onDel: 'delete' }),
    d_appacct: N('data', 'The app’s account, on every device', { st: 'shared', to: 'Third-party app', sub: 'one email address, whatever the platform', why: 'Lets you sign in to the app anywhere.', need: 'required', use: 'operate', ret: ['Unknown: set by the app', null], who: 'The app’s company', sep: 'Yes: a different, or relay, email address for each app.', onDel: 'theirs' }),
    d_household: N('data', 'Devices seen on one network', { st: 'derived', sub: 'one home internet address, many devices', why: 'Measures ads across the devices in a home.', need: 'optional', use: 'ads', ret: ['90 days', 90], enough: 0, short: ['Not kept', 0], who: 'Ads & measurement', sep: 'Yes: a relay or VPN hides the shared address.', onDel: 'delete' }),
    d_signins: N('data', 'Sign-in history', { st: 'collected', why: 'Helps spot sign-ins that are not you.', need: 'required', use: 'security', ret: ['2 years', 730], enough: 180, short: ['6 months', 180], who: 'Account security', sep: 'Yes: it can stay inside security and never reach ads or analytics.', onDel: 'security' }),
    d_risk: N('data', 'Sign-in risk signal', { st: 'derived', why: 'Asks for one more check when something looks wrong.', need: 'required', use: 'security', ret: ['90 days', 90], enough: 90, who: 'Account security only', sep: 'Yes: it can stay inside security and never reach ads or analytics.', onDel: 'security' }),
    d_alert: N('data', 'Alert on your devices', { st: 'collected', why: 'Tells you about the new device or sign-in.', need: 'required', use: 'security', ret: ['30 days', 30], enough: 30, who: 'You', sep: 'Not needed: it only goes to you.', onDel: 'delete' }),
    d_recovery: N('data', 'Recovery check', { st: 'derived', sub: 'phone, recovery email, devices and IP, side by side', why: 'Decides whether the person resetting the password is you.', need: 'required', use: 'security', ret: ['1 year', 365], enough: 365, who: 'Account security only', sep: 'Yes: these links exist for security only, and must never reach ads or analytics.', onDel: 'security' }),
    d_inbox: N('data', 'Messages', { st: 'collected', why: 'Delivers and stores your mail.', need: 'required', use: 'operate', ret: ['Until you delete them', null], who: 'You; the mail service', sep: 'Not needed: this is the service itself.', onDel: 'delete' }),
    d_res: N('data', 'Flight reservation', { st: 'derived', sub: 'read from a confirmation email', why: 'Shows trip cards and reminders.', need: 'useful', use: 'personalize', ret: ['Until the email is deleted', null], who: 'Mail; the assistant, when asked', sep: 'Yes: it can be read on the device and stay in Mail.', onDel: 'delete' }),
    d_contacts: N('data', 'Who you write to most', { st: 'derived', why: 'Suggests recipients as you type.', need: 'useful', use: 'personalize', ret: ['1 year', 365], enough: 90, short: ['90 days', 90], who: 'Mail', sep: 'Yes: suggestions can be worked out on the device.', onDel: 'delete' }),
    d_results: N('data', 'Results for your query', { st: 'collected', why: 'Answers the search.', need: 'required', use: 'operate', ret: NEVER, enough: 0, who: 'Search', sep: 'Not needed: nothing is kept.', onDel: 'delete' }),
    d_searchhist: N('data', 'Search history', { st: 'collected', why: 'Shows your recent searches.', need: 'useful', use: 'personalize', ret: ['18 months', 548], enough: 90, short: ['3 months', 90], who: 'Search; personalization', sep: 'Yes: history can be kept without reaching ads.', onDel: 'delete' }),
    d_segment: N('data', 'Interest segment', { st: 'derived', sub: '“coffee”, “running”, “travel”', why: 'Chooses which ads you see.', need: 'optional', use: 'ads', ret: ['13 months', 395], enough: 30, short: ['30 days', 30], who: 'Ads & measurement', sep: 'Yes: turning off personalized ads stops it.', onDel: 'delete' }),
    d_counts: N('data', 'Usage counts', { st: 'derived', sub: 'totals, with no ID', why: 'Shows which features people use.', need: 'useful', use: 'analytics', ret: ['2 years', 730], enough: 730, who: 'Product teams', sep: 'Already separate: counts carry no ID.', onDel: 'anon' }),
    d_adview: N('data', 'Ad view record', { st: 'collected', why: 'Counts that an ad was shown.', need: 'optional', use: 'ads', ret: ['90 days', 90], enough: 30, short: ['30 days', 30], who: 'Ads & measurement', sep: 'Yes: an app-specific ID stops it following you between apps.', onDel: 'delete' }),
    d_adconv: N('data', 'Ad counted as a sale', { st: 'shared', to: 'Ad partner', why: 'Tells the advertiser the ad led to a purchase.', need: 'optional', use: 'ads', ret: ['90 days', 90], enough: 30, who: 'The ad partner', sep: 'Yes: report totals, not people.', onDel: 'theirs', needs: ['d_adview', 'd_purchase'] }),
    d_route: N('data', 'The route you asked for', { st: 'collected', why: 'Gives you directions.', need: 'required', use: 'operate', ret: ['Not kept after the trip', 0], enough: 0, who: 'Maps', sep: 'Not needed: it is gone after the trip.', onDel: 'delete' }),
    d_lochist: N('data', 'Location history', { st: 'collected', why: 'Shows places you have been.', need: 'optional', use: 'personalize', ret: ['18 months', 548], enough: 90, short: ['24 hours', 1], who: 'Maps; personalization', sep: 'Yes: keep it on the device, or off.', onDel: 'delete' }),
    d_places: N('data', 'Repeated places', { st: 'derived', why: 'Suggests “Home” and “Work”.', need: 'useful', use: 'personalize', hist: true, ret: ['Until you clear it', null], who: 'Maps', sep: 'Yes: it can be worked out on the device.', onDel: 'delete' }),
    d_purchase: N('data', 'Purchase record', { st: 'collected', why: 'Shows your receipt.', need: 'required', use: 'operate', ret: ['7 years', 2555], enough: 2555, who: 'Wallet; the shop; the bank', sep: 'Partly: the shop and the bank keep their own records.', onDel: 'legal', keepWhy: 'Tax and payment rules require the record.' }),
    d_spend: N('data', 'Spending pattern', { st: 'derived', why: 'Shows monthly spending.', need: 'optional', use: 'personalize', hist: true, ret: ['2 years', 730], enough: 365, short: ['1 year', 365], who: 'Wallet', sep: 'Yes: it can be worked out on the device.', onDel: 'delete' }),
    d_fraud: N('data', 'Fraud check', { st: 'derived', why: 'Stops a stolen card being used.', need: 'required', use: 'security', ret: ['1 year', 365], enough: 365, who: 'The bank and the card network', sep: 'Yes: fraud signals stay with fraud prevention.', onDel: 'theirs' }),
    d_offers: N('data', 'Offers from your purchases', { st: 'derived', why: 'Chooses offers for you.', need: 'optional', use: 'ads', ret: ['1 year', 365], enough: 30, short: ['30 days', 30], who: 'Wallet; offers', sep: 'Yes: receipts can stay receipts.', onDel: 'delete' }),
    d_file: N('data', 'The file', { st: 'collected', why: 'Stores your file.', need: 'required', use: 'operate', ret: ['Until you delete it', null], who: 'You; cloud storage', sep: 'Not needed: this is the service itself.', onDel: 'delete' }),
    d_acl: N('data', 'Who can open the file', { st: 'collected', why: 'Lets the right people open it.', need: 'required', use: 'operate', ret: ['While the file is shared', null], who: 'Cloud storage', sep: 'Yes: stop sharing, and the link closes.', onDel: 'delete' }),
    d_theircopy: N('data', 'Their copy', { st: 'shared', to: 'The person you shared with', why: 'They can download or forward it.', need: 'required', use: 'operate', ret: ['Theirs to keep', null], who: 'The person you shared with', sep: 'No: once shared, a copy is out of your reach.', onDel: 'theirs' }),
    d_prompt: N('data', 'Your question and the answer', { st: 'collected', why: 'Lets you pick up the conversation later.', need: 'useful', use: 'operate', ret: ['365 days', 365], enough: 30, short: ['30 days', 30], who: 'The assistant', sep: 'Yes: a conversation can be kept without being reused.', onDel: 'delete' }),
    d_cal: N('data', 'Calendar entries', { st: 'collected', why: 'Keeps your schedule.', need: 'required', use: 'operate', ret: ['Until you delete them', null], who: 'You; the calendar service', sep: 'Not needed: this is the service itself.', onDel: 'delete' }),
    d_ctx: N('data', 'What the assistant was given', { st: 'derived', sub: 'everything put in front of it for this one answer', why: 'Answers this question.', need: 'required', use: 'operate', ret: ['Only for this answer', 0], enough: 0, who: 'The assistant', sep: 'Yes: give each answer only the sources it needs.', onDel: 'delete' }),
    d_history: N('data', 'Earlier conversations', { st: 'collected', why: 'Lets the assistant refer back.', need: 'optional', use: 'personalize', ret: ['365 days', 365], enough: 30, short: ['30 days', 30], who: 'The assistant', sep: 'Yes: start fresh, or keep history off.', onDel: 'delete' }),
    d_devctx: N('data', 'Device context', { st: 'collected', sub: 'time zone, language, rough location', why: 'Answers in your time zone and language.', need: 'useful', use: 'operate', ret: ['Only for this answer', 0], enough: 0, who: 'The assistant', sep: 'Yes: send the time zone, not the location.', onDel: 'delete' }),
    d_installs: N('data', 'Apps you installed', { st: 'collected', why: 'Lets you re-download and update apps.', need: 'required', use: 'operate', ret: ['Until you delete the account', null], who: 'The app store', sep: 'Not needed: this is the service itself.', onDel: 'delete' }),
    d_perm: N('data', 'Permission record', { st: 'collected', sub: 'which apps may use location, contacts and the camera', why: 'Remembers what you allowed.', need: 'required', use: 'operate', ret: ['Until you turn it off', null], who: 'The phone', sep: 'Yes: choose “While using the app” or “Ask next time”.', onDel: 'device' }),
    d_applocation: N('data', 'The app’s copy of your location', { st: 'shared', to: 'Third-party app', why: 'Finds your parked car.', need: 'optional', use: 'personalize', ret: ['Unknown: set by the app', null], who: 'The app’s company', sep: 'Yes: allow location only while the app is open.', onDel: 'theirs' }),
    d_appcontacts: N('data', 'The app’s copy of your contacts', { st: 'shared', to: 'Third-party app', why: 'Finds friends who use the app.', need: 'optional', use: 'personalize', ret: ['Unknown: set by the app', null], who: 'The app’s company', sep: 'Yes: share only the contacts you pick.', onDel: 'theirs' }),
    d_diag: N('data', 'Diagnostics report', { st: 'collected', why: 'Helps fix crashes.', need: 'useful', use: 'analytics', ret: ['90 days', 90], enough: 90, who: 'Engineering', sep: 'Yes: a crash report needs no account ID.', onDel: 'delete' }),
    d_photo: N('data', 'The photo', { st: 'collected', why: 'Stores and shows your photo.', need: 'required', use: 'operate', ret: ['Until you delete it', null], who: 'You; Photos', sep: 'Not needed: this is the service itself.', onDel: 'delete' }),
    d_exif: N('data', 'Time, place and camera', { st: 'collected', sub: 'written inside the photo file', why: 'Sorts photos by time and place.', need: 'useful', use: 'personalize', ret: ['As long as the photo', null], who: 'Photos; anyone who gets the file', sep: 'Yes: remove the location before sharing.', onDel: 'delete',
      fields: [['Taken', 'the day and the minute'], ['Where', 'a GPS position, accurate to a building'], ['Camera', 'the phone model and lens'], ['Edited', 'the app used']] }),
    d_sentphoto: N('data', 'The photo, with its location', { st: 'shared', to: 'Group chat', why: 'You sent it.', need: 'required', use: 'operate', ret: ['Theirs to keep', null], who: 'Everyone in the chat', sep: 'No: once sent, a copy is out of your reach.', onDel: 'theirs' }),
    d_backup: N('data', 'Backup copy', { st: 'collected', sub: 'the whole phone, as it was that night', why: 'Restores your phone if it is lost.', need: 'useful', use: 'operate', ret: ['180 days after the last backup', 180], enough: 180, who: 'The backup service', sep: 'Partly: a backup copies everything, including what you later delete.', onDel: 'backup' }),
    d_photogone: N('data', 'The photo, deleted on the phone', { st: 'expired', why: 'You deleted it.', need: 'required', use: 'operate', ret: ['Deleted', 0], who: 'Nobody', sep: 'Not needed: it is gone here.', onDel: 'delete' }),
    d_restored: N('data', 'The photo, back on a new phone', { st: 'collected', why: 'Restored from the backup.', need: 'useful', use: 'operate', ret: ['Until you delete it again', null], who: 'You', sep: 'Not needed: it is yours.', onDel: 'delete' }),
    d_copyLaptop: N('data', 'Copy on the laptop', { st: 'collected', why: 'Keeps every device in step.', need: 'useful', use: 'operate', ret: ['Until deleted on any device', null], who: 'You', sep: 'Yes: turn off sync for this app.', onDel: 'delete' }),
    d_copyWatch: N('data', 'Copy on the watch', { st: 'collected', why: 'Keeps every device in step.', need: 'useful', use: 'operate', ret: ['Until deleted on any device', null], who: 'You', sep: 'Yes: turn off sync for this app.', onDel: 'delete' }),
    d_copyWeb: N('data', 'Copy in the web version', { st: 'collected', why: 'Keeps every device in step.', need: 'useful', use: 'operate', ret: ['Until deleted on any device', null], who: 'You', sep: 'Yes: turn off sync for this app.', onDel: 'delete' }),
    d_synctabs: N('data', 'Synced tabs and history', { st: 'collected', why: 'Opens your tabs on every device.', need: 'useful', use: 'operate', ret: ['Until you clear history', null], who: 'Sync', sep: 'Yes: a separate browser profile keeps them apart.', onDel: 'delete' }),
    d_passkey: N('data', 'Passkey on all your devices', { st: 'collected', why: 'Lets you sign in on any of your devices.', need: 'useful', use: 'security', ret: ['Until you delete it', null], who: 'You; encrypted, so sync cannot read it', sep: 'Not needed: the key is useless to anyone else.', onDel: 'delete' }),
    d_pubkey: N('data', 'Public key only', { st: 'shared', to: 'The website', why: 'Checks future sign-ins; no secret is shared.', need: 'required', use: 'security', ret: ['Set by the website', null], who: 'The website', sep: 'Already separate: each site gets its own key.', onDel: 'theirs' }),
    d_link: N('data', 'Linked-account record', { st: 'collected', why: 'Remembers that the two accounts are connected.', need: 'required', use: 'operate', ret: ['Until you unlink', null], who: 'Account service', sep: 'Yes: unlink, and the record goes.', onDel: 'delete' }),
    d_connected: N('data', 'Apps you signed in to', { st: 'collected', why: 'Lets you see and remove connected apps.', need: 'required', use: 'security', ret: ['Until you remove the app', null], who: 'Account service', sep: 'Partly: the account provider must know, so you can remove the app later.', onDel: 'delete' }),
    d_3pid: N('data', 'What the app receives', { st: 'shared', to: 'Third-party app', sub: 'an app-specific ID and a relay email address', why: 'Creates your account in the app.', need: 'required', use: 'operate', ret: ['Unknown: set by the app', null], who: 'The app’s company', sep: 'Already separate: the ID and the email work only for this app.', onDel: 'theirs' }),
    d_mdm: N('data', 'Your phone, as work sees it', { st: 'shared', to: 'Employer IT', sub: 'model, system version, work apps', why: 'Keeps work data safe on the phone.', need: 'required', use: 'security', ret: ['Set by your employer', null], who: 'Your employer’s IT team', sep: 'Yes: a work profile limits IT to work apps.', onDel: 'theirs' }),
    d_workprofile: N('data', 'Work bookmarks at home', { st: 'collected', sub: 'copied into the personal browser by sync', why: 'Sync copied them across.', need: 'optional', use: 'operate', ret: ['Until you remove the work profile', null], who: 'You; sync', sep: 'Yes: keep work in its own browser profile.', onDel: 'delete' }),
    d_voice: N('data', 'Voice request', { st: 'collected', why: 'Understands what you said.', need: 'required', use: 'operate', ret: NEVER, enough: 0, who: 'The assistant', sep: 'Not needed: nothing is kept.', onDel: 'delete' }),
    d_voiceclip: N('data', 'Recording kept to improve', { st: 'collected', why: 'Improves speech recognition.', need: 'optional', use: 'analytics', ret: ['6 months', 180], enough: 0, short: ['Not kept', 0], who: 'Speech teams', sep: 'Yes: only if you opt in.', onDel: 'delete' }),
    d_export: N('data', 'Your downloaded copy', { st: 'shared', to: 'Your computer', why: 'You asked for a copy of your data.', need: 'required', use: 'legal', ret: ['Yours to keep', null], who: 'You', sep: 'Not needed: it is yours.', onDel: 'outside' }),
    d_exportlog: N('data', 'Record of the export', { st: 'collected', why: 'Shows when your data was downloaded, in case it was not you.', need: 'required', use: 'security', ret: ['1 year', 365], enough: 365, who: 'Account security', sep: 'Yes: it stays inside security.', onDel: 'security' }),
    d_delrec: N('data', 'Record of the deletion', { st: 'collected', why: 'Proves the request was made and finished.', need: 'required', use: 'legal', ret: ['3 years', 1095], enough: 1095, who: 'Privacy operations', sep: 'Not needed: it holds no account data.', onDel: 'legal', keepWhy: 'Proof the request was honoured.' }),
    d_wxloc: N('data', 'Precise location, hourly', { st: 'collected', why: 'Shows local weather.', need: 'optional', use: 'operate', ret: ['30 days', 30], enough: 0, short: ['Not kept', 0], who: 'Weather', sep: 'Yes: a rough location is enough for weather.', onDel: 'delete' }),
    d_mapsusage: N('data', 'Maps usage, sent out', { st: 'shared', to: 'Outside processor', why: 'Measures feature use.', need: 'optional', use: 'analytics', ret: ['Set by contract', null], who: 'The processor', sep: 'Yes: send totals, not people.', onDel: 'theirs' }),

    /* inferences: nobody typed these in */
    n_routine: N('inf', 'Daily routine', { sub: 'when you wake, when you leave', why: 'Could time reminders; also shows when the home is empty.', use: 'none', needs: ['d_screen', 'd_places'] }),
    n_commute: N('inf', 'Possible commute pattern', { why: 'Traffic alerts for the usual drive.', use: 'personalize', hist: true }),
    n_homework: N('inf', 'Likely home and work', { why: 'Suggests “Home” and “Work”; also says where you live.', use: 'personalize', hist: true, sens: true }),
    n_habit: N('inf', 'Coffee near work on weekdays', { why: 'Useful for offers; also a picture of your day.', use: 'ads', needs: ['d_searchhist', 'd_places', 'd_purchase'] }),
    n_itinerary: N('inf', 'Travel itinerary', { why: 'Answers “When is my flight?”', use: 'operate', needsEdge: ['d_res>d_ctx'] }),
    n_away: N('inf', 'Away from home on those dates', { why: 'Nobody asked for this. It is what two facts say together.', use: 'none', sens: true, needs: ['n_itinerary', 'n_homework'] }),
    n_sameperson: N('inf', 'Phone, laptop and browser are one person', { why: 'Keeps you signed in everywhere; also joins everything you do.', use: 'operate', needs: ['d_devices', 'd_synctabs'] }),
    n_life: N('inf', 'One picture of a life', { sub: 'schedule, places, spending, people', why: 'No single service needs this. One ID makes it possible.', use: 'none', sens: true, needs: ['d_contacts', 'd_file', 'd_cal', 'd_places', 'd_spend'] }),
    n_appkind: N('inf', 'The kinds of apps you use', { sub: 'here, a health tracker', why: 'Nothing needs this: it is a side effect of being the sign-in provider.', use: 'none', sens: true }),
    n_social: N('inf', 'Who you know', { sub: 'including people who never joined the app', why: 'Suggests friends; also maps people who never agreed.', use: 'personalize' }),
    n_apphome: N('inf', 'Where you live and work, to the app', { why: 'Nothing needs this: parking only needed one moment.', use: 'none', hist: true, sens: true }),
    n_interests: N('inf', 'Interests, credited to the owner', { sub: 'video games: but whose?', why: 'Recommendations and ads, possibly about the wrong person.', use: 'ads', needs: ['d_searchhist', 'd_installs', 'd_purchase'] }),
    n_crossover: N('inf', 'Work and personal look like one person', { why: 'Nobody asked for this. Two setups were joined by accident.', use: 'none', sens: true, needs: ['d_mdm', 'd_workprofile'] }),
    n_wherelive: N('inf', 'Where you live', { sub: 'photos taken late at night, in one place', why: 'Nothing needs this: it travels inside the file.', use: 'none', hist: true, sens: true }),
    n_expecting: N('inf', 'Possibly expecting a child', { why: 'A health inference nobody typed in.', use: 'ads', sens: true, needs: ['d_searchhist', 'd_lochist', 'd_purchase'] }),
    n_xplat: N('inf', 'One person, across every platform', { why: 'No single platform account sees every device. What you install everywhere does.', use: 'none', sens: true, needs: ['d_synctabs', 'd_bridged', 'd_appacct'] }),
    n_home: N('inf', 'These devices share a home', { sub: 'a guess from the shared address', why: 'Ads across a household’s devices; also a guess about who lives together.', use: 'ads', sens: true }),
    n_notyou: N('inf', 'This may not be you', { why: 'Blocks the attacker, or asks for one more check.', use: 'security', need: 'required', any: true })
  };

  /* ── what the deletion request does to each kind of record ── */
  E.onDel = {
    delete: [false, 'Deleted', 'Nothing requires keeping it.'],
    security: [true, 'Kept for security', 'Kept for a limited time to investigate misuse of the account, then deleted.'],
    legal: [true, 'Kept by law', 'A legal duty requires the record.'],
    backup: [true, 'Still in a backup', 'Removed only when the backup rolls over.'],
    theirs: [true, 'Outside your reach', 'Another party holds this copy; deleting your account does not delete it.'],
    outside: [true, 'Yours, outside the service', 'A copy you downloaded; deleting the account does not touch it.'],
    device: [true, 'On the device until erased', 'It never left the device, so the service cannot delete it.'],
    anon: [true, 'Not about you', 'Totals carry no ID, so there is nothing of yours to delete.']
  };

  /* ── per-connection answers where the default would be wrong ── */
  E.edgeMeta = {
    's_assist>s_mail': { why: 'The assistant reads your email to find the answer.', need: 'required', who: 'The assistant, with your mail access', sep: 'Yes: let the assistant read mail only when a question needs it, and ask first.' },
    's_assist>s_cal': { why: 'The assistant reads your calendar to check the schedule.', need: 'useful', who: 'The assistant, with your calendar access', sep: 'Yes: ask before reading the calendar.' },
    's_assist>s_cloud': { why: 'The assistant can search your files.', need: 'optional', who: 'The assistant, with your file access', sep: 'Yes: files are not needed to answer this question.' },
    's_assist>s_maps': { why: 'The assistant can see where you have been.', need: 'optional', who: 'The assistant, with your location access', sep: 'Yes: location history is not needed to answer this question.' },
    'd_prompt>d_ctx': { why: 'Your question is the starting point.', need: 'required' },
    'd_res>d_ctx': { why: 'The reservation holds the answer.', need: 'required' },
    'd_cal>d_ctx': { why: 'The calendar confirms the trip.', need: 'useful' },
    'd_devctx>d_ctx': { why: 'The answer should be in your time zone.', need: 'useful' },
    'd_history>d_ctx': { why: 'Earlier conversations were in scope, though this question does not need them.', need: 'optional' },
    'd_file>d_ctx': { why: 'Your files were in scope, though this question does not need them.', need: 'optional' },
    'd_lochist>d_ctx': { why: 'Your location history was in scope, though this question does not need it.', need: 'optional' },
    's_cloud>x_recipient': { why: 'You chose to share the file with them.', need: 'required', ret: ['Until you stop sharing; their copy stays theirs', null], who: 'The person you shared with', sep: 'Partly: you can stop sharing, but not recall a downloaded copy.' },
    's_photos>x_group': { why: 'You sent the photo to the chat.', need: 'required', ret: ['Theirs to keep', null], who: 'Everyone in the chat', sep: 'Partly: send it without the location.' },
    's_browser>s_sync': { why: 'Sync copies this browser’s tabs and history to your account.', need: 'useful', sep: 'Yes: use separate profiles for work and personal.' },
    'i_work>s_sync': { why: 'Signing in to work in the personal browser brought work data into the same sync.', need: 'optional', sep: 'Yes: keep the work account in its own profile.' },
    'i_work>x_employer': { why: 'Your employer manages every device that opens work email.', need: 'required', sep: 'Yes: a work profile keeps IT to the work side.' },
    'i_dev>s_weather': { why: 'The weather widget now receives your precise location every hour.', need: 'optional', sep: 'Yes: a rough location is enough for weather.' },
    's_maps>x_proc': { why: 'Maps sends usage events to an outside processor.', need: 'optional', ret: ['Set by contract', null], sep: 'Yes: send totals, not people.' },
    'd_purchase>d_offers': { why: 'Receipts are now also used to choose offers.', need: 'optional', sep: 'Yes: receipts can stay receipts.' },
    'i_adid>s_search': { why: 'Searches now carry the advertising ID.', need: 'optional', sep: 'Yes: search needs no advertising ID.' },
    'd_backup>d_restored': { why: 'Restoring a backup brings back everything in it, including what you deleted.', need: 'useful', sep: 'Partly: delete from the backup too, or wait for it to roll over.' },
    'i_email>s_sync': { why: 'The same browser account, signed in with your email address, on every platform.', need: 'useful', sep: 'Yes: separate browser profiles, or no sync, keep the devices apart.' },
    'i_email>x_app': { why: 'The app knows you by the email address you signed up with, on any platform.', need: 'required', sep: 'Yes: a relay email address for each app.' },
    'i_ip>s_ads': { why: 'Every device at home shares one internet address, and ads can see it.', need: 'optional', sep: 'Partly: a relay or VPN hides the shared address.' },
    'd_searchhist>d_segment': { why: 'Your searches decide which ads you see.', need: 'optional', sep: 'Yes: turning off personalized ads stops this.' },
    'd_searchhist>d_counts': { why: 'Searches are counted, without any ID, to improve search.', need: 'useful' },
    's_search>d_results': { why: 'To answer the search.', need: 'required' }
  };

  /* ── the kinds of event ─────────────────────────────────
   * chain: edges from the event ('ev') to what it sets in motion. AND-joins
   * (nodes with needs) are added when everything they need is present.
   * cc: the Command Center selectors that review this kind of event. */
  function T(id, fam, label, plain, chain, cc) { return { id: id, fam: fam, label: label, plain: plain, chain: chain.split(' '), cc: cc }; }
  function cc(s, j, q) { return { s: s, j: j, q: q }; }
  E.types = [
    T('signin', 'identity', 'Sign in', 'You sign in to your account.', 'ev>i_acct ev>i_dev ev>i_ip i_acct>s_account i_dev>s_account i_ip>s_security s_account>d_devices s_security>d_signins', cc('ident', 'signin', 'prove')),
    T('newdevice', 'identity', 'New device added', 'A new laptop joins the account.', 'ev>i_acct ev>i_dev2 i_acct>s_account i_dev2>s_account i_dev2>s_security s_account>d_devices s_security>d_alert', cc('ident', 'account', 'linkid')),
    T('passkey', 'identity', 'Passkey created', 'You make a passkey for a website instead of a password.', 'ev>i_acct ev>i_pk i_acct>s_sync s_sync>d_passkey i_pk>x_site x_site>d_pubkey', cc('ident', 'signin', 'prove')),
    T('linked', 'identity', 'Account linked', 'You connect a music account to your main account.', 'ev>i_acct ev>i_scoped i_acct>s_account s_account>d_link i_scoped>x_app', cc('ident', 'signin', 'linkid')),
    T('thirdparty', 'identity', 'Third-party app connected', 'You use “Sign in with…” on an outside app.', 'ev>i_acct ev>i_scoped i_acct>s_account s_account>d_connected d_connected>n_appkind i_scoped>x_app x_app>d_3pid', cc('ident', 'signin', 'linkid')),
    T('emailsent', 'comms', 'Email sent', 'You send an email.', 'ev>i_acct ev>i_ip i_acct>s_mail i_ip>s_mail s_mail>d_inbox s_mail>d_contacts', cc('mail', 'mail', 'whoknows')),
    T('emailread', 'comms', 'Email read', 'You open your inbox; a flight confirmation is waiting.', 'ev>i_acct ev>i_dev i_acct>s_mail s_mail>d_inbox d_inbox>d_res', cc('mail', 'mail', 'whoknows')),
    T('calendar', 'comms', 'Calendar event created', 'You add a meeting to your calendar.', 'ev>i_acct i_acct>s_cal s_cal>d_cal', cc('mail', 'mail', 'where')),
    T('contacts', 'comms', 'Contact accessed', 'An app asks to read your contacts, and you allow it.', 'ev>i_dev ev>i_scoped i_dev>s_os s_os>d_perm i_scoped>x_app x_app>d_appcontacts d_appcontacts>n_social', cc('mail', 'mail', 'linkid')),
    T('location', 'location', 'Location used', 'You ask Maps for directions.', 'ev>i_acct ev>i_dev i_acct>s_maps i_dev>s_maps s_maps>d_route s_maps>d_lochist d_lochist>d_places d_places>n_commute d_places>n_homework', cc('all', 'account', 'know')),
    T('purchase', 'pay', 'Purchase made', 'You pay with your phone.', 'ev>i_tok ev>i_acct i_tok>x_merchant i_tok>x_network i_acct>s_wallet s_wallet>d_purchase', cc('pay', 'pay', 'where')),
    T('paymethod', 'pay', 'Payment method used', 'Your card is used through the wallet.', 'ev>i_tok ev>i_dev i_tok>x_network i_dev>s_wallet x_network>d_fraud s_wallet>d_purchase', cc('pay', 'pay', 'provewithout')),
    T('unlock', 'device', 'Phone unlocked', 'You pick up the phone and unlock it.', 'ev>i_dev i_dev>s_os s_os>d_screen', cc('all', 'account', 'know')),
    T('appinstall', 'device', 'App installed', 'You install an app.', 'ev>i_acct ev>i_dev i_acct>s_store s_store>d_installs', cc('all', 'account', 'whoknows')),
    T('permission', 'device', 'Permission granted', 'You let an app use your location “Always”.', 'ev>i_dev ev>i_scoped i_dev>s_os s_os>d_perm i_scoped>x_app x_app>d_applocation d_applocation>n_apphome', cc('all', 'account', 'changed')),
    T('bridge', 'device', 'Phone linked to computer', 'You connect the phone to the computer, so texts and photos appear on both.', 'ev>i_dev ev>i_dev2 i_dev>s_bridge i_dev2>s_bridge s_bridge>d_bridged', cc('ident', 'account', 'linkid')),
    T('wifi', 'device', 'Devices on the home Wi-Fi', 'Every device at home shares one internet address.', 'ev>i_ip ev>i_dev ev>i_dev2 i_ip>s_ads s_ads>d_household d_household>n_home', cc('web', 'browse', 'linkid')),
    T('telemetry', 'device', 'Device telemetry sent', 'The phone sends a crash and performance report.', 'ev>i_dev ev>i_ip i_dev>s_diag i_ip>s_diag s_diag>d_diag d_diag>d_counts', cc('analytics', 'browse', 'where')),
    T('upload', 'cloud', 'File uploaded', 'You save a file to cloud storage.', 'ev>i_acct i_acct>s_cloud s_cloud>d_file', cc('cloud', 'delete', 'where')),
    T('share', 'cloud', 'File shared', 'You share a file with someone.', 'ev>i_acct i_acct>s_cloud s_cloud>d_acl s_cloud>x_recipient x_recipient>d_theircopy', cc('cloud', 'delete', 'where')),
    T('browsersync', 'cloud', 'Browser sync', 'You turn on sync in a browser on the laptop.', 'ev>i_acct ev>i_cookie ev>i_dev2 i_acct>s_sync i_cookie>s_browser i_dev2>s_sync s_browser>s_sync s_sync>d_synctabs', cc('ident', 'account', 'linkid')),
    T('backup', 'cloud', 'Cloud backup', 'The phone backs itself up overnight.', 'ev>i_acct ev>i_dev i_acct>s_backup i_dev>s_backup s_backup>d_backup', cc('cloud', 'delete', 'delete')),
    T('photo', 'cloud', 'Photo uploaded', 'A photo you took is saved to Photos.', 'ev>i_acct ev>i_dev i_acct>s_photos s_photos>d_photo s_photos>d_exif d_exif>n_wherelive', cc('cloud', 'delete', 'live')),
    T('voice', 'ai', 'Voice assistant used', 'You ask the assistant something out loud.', 'ev>i_acct ev>i_dev i_dev>s_assist i_acct>s_assist s_assist>d_voice s_assist>d_voiceclip', cc('ai', 'ai', 'leftdevice')),
    T('aiprompt', 'ai', 'AI assistant prompt', 'You ask the assistant “When is my flight?”', 'ev>i_acct ev>i_dev i_acct>s_assist s_assist>s_mail s_assist>s_cal s_assist>d_prompt s_mail>d_inbox d_inbox>d_res s_cal>d_cal d_prompt>d_ctx d_res>d_ctx d_cal>d_ctx d_ctx>n_itinerary', cc('ai', 'ai', 'infer')),
    T('search', 'ads', 'Search performed', 'You search for something.', 'ev>i_acct ev>i_cookie i_acct>s_search i_cookie>s_search s_search>d_searchhist', cc('web', 'browse', 'whoknows')),
    T('adshown', 'ads', 'Ad shown', 'An app shows you an ad.', 'ev>i_adid ev>i_cookie i_adid>s_ads i_cookie>s_ads s_ads>d_adview', cc('analytics', 'browse', 'join')),
    T('alert', 'security', 'Security alert', 'Someone tries to sign in from a new device.', 'ev>i_acct ev>i_ip ev>i_dev2 i_acct>s_security i_ip>s_security i_dev2>s_security s_security>d_risk s_security>d_alert d_risk>n_notyou', cc('ident', 'account', 'stolen')),
    T('recovery', 'security', 'Password / account recovery', 'You reset a forgotten password.', 'ev>i_phone ev>i_remail ev>i_ip ev>i_dev i_phone>s_security i_remail>s_security i_ip>s_security i_dev>s_security s_security>d_recovery s_security>d_signins d_recovery>n_notyou', cc('ident', 'account', 'stolen')),
    T('export', 'controls', 'Data exported', 'You download a copy of your data.', 'ev>i_acct i_acct>s_export s_export>d_export s_export>d_exportlog', cc('analytics', 'delete', 'delete')),
    T('delete', 'controls', 'Account / data deleted', 'You delete your account.', 'ev>i_acct i_acct>s_delete s_delete>d_delrec', cc('analytics', 'delete', 'delete'))
  ];
  E.type = function (id) { for (var i = 0; i < E.types.length; i++) if (E.types[i].id === id) return E.types[i]; return null; };

  /* ── the morning ── */
  function I(id, type, t, label, o) { o = o || {}; o.id = id; o.type = type; o.t = t; o.label = label; return o; }
  E.day = { id: 'day', title: 'A morning', line: 'Eight ordinary things before 10 AM.', inf: ['n_routine', 'n_habit', 'n_away'], events: [
    I('m1', 'unlock', '8:02 AM', 'Unlock phone'),
    I('m2', 'signin', '8:04 AM', 'Sign in'),
    I('m3', 'emailread', '8:06 AM', 'Check email'),
    I('m4', 'search', '8:15 AM', 'Search: “coffee near me”'),
    I('m5', 'location', '8:20 AM', 'Maps: directions to a café'),
    I('m6', 'purchase', '8:32 AM', 'Bought coffee', { pick: 1 }),
    I('m7', 'share', '9:10 AM', 'Shared a file', { pick: 1 }),
    I('m8', 'aiprompt', '9:30 AM', 'Asked AI about my flight', { pick: 1 })
  ], cc: cc('all', 'account', 'know') };

  /* ── the use cases ── */
  var BARE_LOC = 'ev>i_acct ev>i_dev i_acct>s_maps i_dev>s_maps s_maps>d_lochist'.split(' ');
  function C(id, title, line, events, o) { o.id = id; o.title = title; o.line = line; o.events = events; return o; }
  /* Devices across platforms: built from the device mix. */
  E.devCase = function (dv) {
    var d = E.parseDv(dv), acc = E.devAccounts(dv), devs = E.devKinds.filter(function (k, i) { return d[i][0] !== 'none'; }).map(function (k) { return k.node; });
    var accOf = function (node) { return acc.filter(function (a) { return a.devices.indexOf(node) >= 0; })[0]; };
    var ev = [];
    E.devKinds.forEach(function (k, i) {
      if (d[i][0] === 'none') return;
      var a = accOf(k.node), name = d[i][1].replace(/-like (phone|laptop|tablet)$/, '-like ' + k.label.toLowerCase());
      ev.push(I('v' + (i + 1), 'signin', ['Mon 8:04 AM', 'Mon 9:00 AM', 'Mon 7:30 PM'][i], a ? 'Sign in on the ' + name : 'Sign in locally on the ' + name, {
        chain: a ? ['ev>' + a.id, 'ev>' + k.node, a.id + '>' + a.sys, k.node + '>' + a.sys, a.sys + '>' + a.data] : ['ev>' + k.node] }));
    });
    var same = d[0][2] && d[0][2] === d[1][2];
    ev.push(I('v4', 'browsersync', 'Mon 9:05 AM', 'The same browser account on every device', { chain: ['ev>i_email'].concat(devs.map(function (n) { return 'ev>' + n; })).concat(['i_email>s_sync']).concat(devs.map(function (n) { return n + '>s_sync'; })).concat(['s_sync>d_synctabs']) }));
    ev.push(I('v5', 'bridge', 'Mon 9:10 AM', same ? 'Built-in handoff links the phone and the laptop' : 'A phone-link app joins the two platforms'));
    var appDev = devs.indexOf('i_dev3') >= 0 ? 'i_dev3' : 'i_dev2';
    ev.push(I('v6', 'appinstall', 'Mon 7:45 PM', 'The same app, same email, on the ' + (appDev === 'i_dev3' ? 'tablet' : 'laptop'), { chain: ['ev>i_email', 'ev>' + appDev, 'i_email>x_app', appDev + '>x_app', 'x_app>d_appacct'] }));
    ev.push(I('v7', 'wifi', 'Every evening', 'Every device on the home Wi-Fi', { chain: ['ev>i_ip'].concat(devs.map(function (n) { return 'ev>' + n; })).concat(['i_ip>s_ads', 's_ads>d_household', 'd_household>n_home']) }));
    var c = E.cases.filter(function (x) { return x.id === 'xplat'; })[0];
    return { id: 'xplat', title: c.title, line: c.line, take: c.take, devices: true, inf: ['n_xplat'], cc: c.cc, events: ev, lab: E.devLabels(dv), dv: dv || E.dvDefault, accounts: acc };
  };

  E.cases = [
    C('xplat', 'Devices across platforms', 'An iPhone-like phone, a Windows-like laptop, an Android-like tablet: still one person.', [], { take: 'Mixing platforms does not stop the linking. It moves it, from one platform account to what you use everywhere: the browser account, your email address, the apps, the phone link and the home Wi-Fi.', cc: cc('ident', 'account', 'linkid') }),
    C('crossdevice', 'Cross-device identity', 'Phone + laptop + browser become one person.', [
      I('a1', 'signin', 'Mon 8:04 AM', 'Sign in on the phone'),
      I('a2', 'signin', 'Mon 12:30 PM', 'Sign in on the laptop', { chain: 'ev>i_acct ev>i_dev2 ev>i_ip i_acct>s_account i_dev2>s_account i_ip>s_security s_account>d_devices s_security>d_signins'.split(' ') }),
      I('a3', 'browsersync', 'Mon 12:31 PM', 'Turn on browser sync')
    ], { inf: ['n_sameperson'], take: 'Each sign-in is ordinary. The account ID is what lets three devices be read as one person.', cc: cc('ident', 'account', 'linkid') }),
    C('cloudsync', 'Cloud sync', 'One action quietly appears on several devices.', [
      I('b1', 'calendar', 'Tue 9:00 AM', 'Add a doctor’s appointment', { add: 'i_acct>s_sync s_sync>d_copyLaptop s_sync>d_copyWatch s_sync>d_copyWeb'.split(' ') })
    ], { inf: [], take: 'You did one thing, once. Every copy is now a place it must be deleted from, and a place it can be seen.', cc: cc('cloud', 'delete', 'where') }),
    C('oneaccount', 'Single account across services', 'Email, files, calendar, maps and payments can become connected.', [
      I('c1', 'emailsent', 'Mon 9:12 AM', 'Email a colleague'),
      I('c2', 'upload', 'Mon 11:40 AM', 'Save a contract to the drive'),
      I('c3', 'calendar', 'Mon 2:00 PM', 'Book a dentist appointment'),
      I('c4', 'location', 'Mon 5:45 PM', 'Directions home'),
      I('c5', 'purchase', 'Mon 6:20 PM', 'Groceries with the wallet', { add: ['d_purchase>d_spend'] })
    ], { inf: ['n_life'], oneId: true, take: 'Every service is useful alone. One account ID is what lets them be read as one life.', cc: cc('ident', 'account', 'stolen') }),
    C('thirdlogin', 'Third-party login', '“Sign in with…” reveals which outside service you connect.', [
      I('d1', 'thirdparty', 'Wed 10:05 PM', 'Sign in to a health app with your account')
    ], { inf: [], take: 'The app learns less than it used to: an app-specific ID and a relay address. The account provider learns which app you use.', cc: cc('ident', 'signin', 'linkid') }),
    C('permissions', 'Permissions changing over time', 'Access granted today may still be on months later.', [
      I('e1', 'permission', '', 'Let a parking app use location “Always”', { date: '2026-03-03' }),
      I('e2', 'contacts', '', 'Let it read contacts “to find friends”', { date: '2026-03-03' }),
      I('e3', 'permission', '', 'The app reads location in the background', { date: '2026-09-29', chain: 'ev>i_scoped i_scoped>x_app x_app>d_applocation d_applocation>n_apphome'.split(' ') })
    ], { inf: [], perm: { granted: '2026-03-03', needed: '2026-03-03' }, take: 'A permission is a decision made once, for a moment. It keeps working long after the moment has passed.', cc: cc('all', 'account', 'changed') }),
    C('family', 'Family / shared accounts', 'Whose activity is this: the owner’s, or someone else in the family?', [
      I('f1', 'search', 'Sat 10:12 AM', 'Search: “game console deals”', { who: 'Someone on the family tablet' }),
      I('f2', 'appinstall', 'Sat 10:20 AM', 'A game is installed', { who: 'Someone on the family tablet' }),
      I('f3', 'purchase', 'Sat 10:31 AM', 'In-game purchase on the shared card', { who: 'Unknown' })
    ], { inf: ['n_interests'], unknown: 'Who did this? The account cannot tell: the tablet is shared, and everything is credited to the owner’s account ID.', take: 'One account ID can stand for several people. Inferences then describe someone who does not exist.', cc: cc('ident', 'account', 'know') }),
    C('workpersonal', 'Work + personal crossover', 'A work account, a personal phone and a shared browser create accidental links.', [
      I('g1', 'signin', 'Mon 8:50 AM', 'Add work email to the personal phone', { chain: 'ev>i_work ev>i_dev i_work>x_employer x_employer>d_mdm'.split(' ') }),
      I('g2', 'browsersync', 'Mon 9:05 AM', 'Sign in to work in the personal browser', { chain: 'ev>i_acct ev>i_work ev>i_cookie i_acct>s_sync i_work>s_sync i_cookie>s_browser s_browser>s_sync s_sync>d_workprofile s_sync>d_synctabs'.split(' ') })
    ], { inf: ['n_crossover'], take: 'Nobody decided to join work and home. Two reasonable setups did it together.', cc: cc('ident', 'account', 'linkid') }),
    C('backup', 'Backup and restore', 'Deleted information may still exist in a backup or a synced copy.', [
      I('h1', 'photo', 'Jan 5', 'Take a photo'),
      I('h2', 'backup', 'Jan 5, night', 'Nightly backup'),
      I('h3', 'delete', 'Jan 9', 'Delete the photo on the phone', { chain: 'ev>i_dev i_dev>s_photos s_photos>d_photogone'.split(' ') }),
      I('h4', 'backup', 'Feb 2', 'Restore a backup to a new phone', { chain: 'ev>i_acct ev>i_dev2 i_acct>s_backup i_dev2>s_backup s_backup>d_backup d_backup>d_restored'.split(' ') })
    ], { inf: [], take: 'Deleting is a promise about every copy. The backup made a copy before the deletion, and the restore brought it back.', cc: cc('cloud', 'delete', 'delete') }),
    C('aictx', 'AI assistant context', 'What the assistant receives to answer one question.', [
      I('k1', 'aiprompt', 'Thu 9:30 AM', 'Ask: “When is my flight?”', { add: 's_assist>d_history d_history>d_ctx s_assist>d_devctx d_devctx>d_ctx s_assist>s_cloud s_cloud>d_file d_file>d_ctx s_assist>s_maps s_maps>d_lochist d_lochist>d_ctx'.split(' ') })
    ], { inf: [], ctx: true, take: 'Email, calendar, files, location and history may each be reasonable alone. The new question is what happens when one feature may see all of them at once.', cc: cc('ai', 'ai', 'infer') }),
    C('intent', 'Search → location → purchase', 'Harmless alone. Joined, they reveal intent.', [
      I('l1', 'search', 'Tue 7:40 PM', 'Search: “best strollers”', { chain: 'ev>i_acct ev>i_cookie i_acct>s_search i_cookie>s_search s_search>d_searchhist'.split(' '), alone: 'Someone looked at strollers. A gift, perhaps.' }),
      I('l2', 'location', 'Wed 12:15 PM', 'Maps: a baby-goods store', { chain: BARE_LOC, alone: 'Someone visited a shop.' }),
      I('l3', 'purchase', 'Wed 12:40 PM', 'Bought prenatal vitamins', { alone: 'Someone bought vitamins.' })
    ], { inf: ['n_expecting'], take: 'No single event says anything sensitive. Joined by one account ID, they say something nobody typed in.', cc: cc('analytics', 'browse', 'join') }),
    C('photometa', 'Photo metadata', 'Time, device and place can say more than the picture.', [
      I('p1', 'photo', 'Fri 11:48 PM', 'Photo of the cat'),
      I('p2', 'share', 'Fri 11:50 PM', 'Send it to a group chat', { chain: 'ev>i_acct i_acct>s_photos s_photos>x_group x_group>d_sentphoto'.split(' ') })
    ], { inf: [], exif: true, take: 'The picture shows a cat. The file shows when, where and with what, to everyone who receives it.', cc: cc('cloud', 'delete', 'live') }),
    C('ads', 'Advertising and analytics', 'Running the service, measuring it, personalizing it and advertising are four different reasons.', [
      I('q1', 'search', 'Sat 9:05 AM', 'Search: “running shoes”', { add: 's_search>d_results d_searchhist>d_segment d_searchhist>d_counts'.split(' ') }),
      I('q2', 'adshown', 'Sat 9:20 AM', 'Ad for running shoes, in another app'),
      I('q3', 'purchase', 'Sat 4:10 PM', 'Bought the shoes')
    ], { inf: [], uses: true, take: 'The same search can serve four purposes. Only the first one is needed to answer it.', cc: cc('analytics', 'browse', 'join') }),
    C('security', 'Account recovery and security', 'Phone, recovery email, devices and IP are linked for security, and still need limits.', [
      I('r1', 'alert', 'Sun 2:13 AM', 'Sign-in attempt from a new device'),
      I('r2', 'recovery', 'Sun 2:20 AM', 'Reset the password with the recovery phone')
    ], { inf: [], take: 'Linking these for security is legitimate. The control is that the link stays inside security.', cc: cc('ident', 'account', 'stolen') }),
    C('deletion', 'Deletion and export', 'Where data must be deleted, and where the law or security says keep it.', [
      I('s1', 'signin', 'Aug 3', 'Sign in'),
      I('s2', 'search', 'Aug 3', 'Search'),
      I('s3', 'purchase', 'Aug 4', 'Bought a coffee'),
      I('s4', 'share', 'Aug 6', 'Shared a file'),
      I('s5', 'backup', 'Aug 6, night', 'Nightly backup'),
      I('s6', 'export', 'Sep 1', 'Download a copy of my data'),
      I('s7', 'delete', 'Sep 2', 'Delete the account')
    ], { inf: [], afterDelete: true, take: 'Deletion is not one action. It is a list: what goes, what the law or security keeps, and what is already out of reach.', cc: cc('analytics', 'delete', 'delete') })
  ];

  E.cases[0].events = E.devCase(E.dvDefault).events;

  /* ── what changed: review events ── */
  E.changes = [
    { id: 'ch1', date: '2026-09-12', kind: 'New receiver', title: 'New service starts receiving location', before: 'Only Maps received your location.', after: 'A weather widget receives precise location every hour.', add: ['i_dev>s_weather', 's_weather>d_wxloc'], edge: 'i_dev>s_weather', reviewed: false },
    { id: 'ch2', date: '2026-09-15', kind: 'Retention', node: 'd_prompt', from: 30, to: 365, before: 'Conversations were kept 30 days.', after: 'Conversations are kept 365 days.', add: [], edge: 's_assist>d_prompt', reviewed: false },
    { id: 'ch3', date: '2026-09-18', kind: 'New identifier', title: 'New identifier added', before: 'Searches carried the account ID and a cookie.', after: 'Searches also carry the advertising ID.', add: ['m4>i_adid', 'i_adid>s_search'], edge: 'i_adid>s_search', reviewed: false },
    { id: 'ch4', date: '2026-09-21', kind: 'AI context', title: 'AI feature begins using email context', before: 'The assistant used your question and your calendar.', after: 'The assistant also reads your email.', add: [], edge: 's_assist>s_mail', reviewed: true },
    { id: 'ch5', date: '2026-09-24', kind: 'New processor', title: 'Third-party processor added', before: 'Maps usage stayed inside the company.', after: 'Maps usage is sent to an outside processor.', add: ['s_maps>x_proc', 'x_proc>d_mapsusage'], edge: 's_maps>x_proc', reviewed: false },
    { id: 'ch6', date: '2026-09-27', kind: 'Purpose', title: 'Purpose changed', before: 'Purchase records: show your receipt.', after: 'Purchase records also choose offers for you.', add: ['d_purchase>d_offers'], edge: 'd_purchase>d_offers', reviewed: false }
  ];
  /* the retention change's title is written from its record */
  E.changes.forEach(function (c) { if (c.kind === 'Retention') c.title = 'Retention changed from ' + c.from + ' → ' + c.to + ' days'; });

  /* ═══════════ the logic: compose, reach, decide, explain ═══════════ */
  var COL = { event: 0, id: 1, sys: 2, data: 3, inf: 4 };
  E.col = function (n) { return COL[n.kind]; };
  E.key = function (a, b) { return a + '>' + b; };
  E.list = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  E.caseById = function (id) { for (var i = 0; i < E.cases.length; i++) if (E.cases[i].id === id) return E.cases[i]; return null; };
  E.changeById = function (id) { for (var i = 0; i < E.changes.length; i++) if (E.changes[i].id === id) return E.changes[i]; return null; };
  E.fam = function (id) { for (var i = 0; i < E.families.length; i++) if (E.families[i].id === id) return E.families[i]; return null; };

  /* The name a node wears in an ecosystem view. */
  E.label = function (id, eco, set) {
    if (set && set.lab && set.lab[id]) return set.lab[id];
    var n = E.nodes[id], k = { apple: 0, google: 1, ms: 2 }[eco];
    return n && n.L && k != null ? n.L[k] : n ? n.name : id;
  };

  /* A set of events → one graph. Inferences that join several things (needs)
   * appear only when everything they need is present, and only where the set
   * allows them (a morning does not imply a pregnancy). */
  E.compose = function (def, extra) {
    var nodes = {}, edges = [], ek = {}, order = [];
    function addNode(id, by) { if (!nodes[id]) { nodes[id] = { id: id, by: by }; order.push(id); } }
    function addEdge(a, b, by, mark, ev) {
      var k = E.key(a, b), e = ek[k];
      if (!e) { e = { a: a, b: b, k: k, by: by, mark: mark || '', evs: {} }; ek[k] = e; edges.push(e); addNode(a, by); addNode(b, by); }
      else if (mark) e.mark = mark;
      if (ev) { e.evs[ev] = 1; e.own = true; }
    }
    def.events.forEach(function (ev, i) {
      var t = E.type(ev.type);
      nodes[ev.id] = { id: ev.id, by: i, ev: ev, type: t }; order.push(ev.id);
      (ev.chain || t.chain).concat(ev.add || []).forEach(function (s) { var p = s.split('>'); addEdge(p[0] === 'ev' ? ev.id : p[0], p[1], i, '', ev.id); });
    });
    (extra && extra.add || []).forEach(function (s) { var p = s.split('>'); addEdge(p[0], p[1], 99, 'new'); });
    if (extra && extra.mark) { var m = ek[extra.mark]; if (m && !m.mark) m.mark = 'changed'; }
    var allow = def.inf === 'all' ? null : def.inf || [], grew = true;
    while (grew) {
      grew = false;
      Object.keys(E.nodes).forEach(function (id) {
        var n = E.nodes[id];
        if (!n.needs || nodes[id]) return;
        if (n.kind === 'inf' && allow && allow.indexOf(id) < 0) return;
        if (!n.needs.every(function (x) { return nodes[x]; })) return;
        var by = Math.max.apply(null, n.needs.map(function (x) { return nodes[x].by; }));
        n.needs.forEach(function (x) { addEdge(x, id, by); }); grew = true;
      });
    }
    /* A connection belongs to the events whose chains name it. Connections no
     * chain names (joins, changes) belong to every event that feeds them. */
    var grow = true;
    while (grow) {
      grow = false;
      edges.forEach(function (e) {
        if (nodes[e.a].ev) { if (!e.evs[e.a]) { e.evs[e.a] = 1; grow = true; } return; }
        if (e.own) return;
        edges.forEach(function (f) { if (f.b === e.a) Object.keys(f.evs).forEach(function (x) { if (!e.evs[x]) { e.evs[x] = 1; grow = true; } }); });
      });
    }
    return { def: def, nodes: nodes, edges: edges, ek: ek, order: order, events: def.events, lab: def.lab || null };
  };
  E.info = function (set, id) { var n = set.nodes[id]; return n && n.ev ? { kind: 'event', name: n.ev.label } : E.nodes[id]; };
  E.kindOf = function (set, id) { var n = set.nodes[id]; return n && n.ev ? 'event' : E.nodes[id] ? E.nodes[id].kind : '?'; };

  /* everything an event (or a node) sets in motion, and where a node came from */
  /* Following one event: only the connections that event made. Following a
   * node: forward and back along the events that reach it. A shared ID (the
   * same phone on every event) never makes one event a source of another's. */
  function walk(set, start, back, ev) {
    var seen = {}, q = [start]; seen[start] = 1;
    while (q.length) { var x = q.shift(); set.edges.forEach(function (e) { if (ev && !e.evs[ev]) return; var from = back ? e.b : e.a, to = back ? e.a : e.b; if (from === x && !seen[to]) { seen[to] = 1; q.push(to); } }); }
    return seen;
  }
  /* the events whose activity feeds a node */
  E.sources = function (set, id) { return set.events.filter(function (ev) { return walk(set, ev.id, false, ev.id)[id]; }); };
  E.reach = function (set, start, back) {
    if (set.nodes[start] && set.nodes[start].ev) return back ? (function () { var o = {}; o[start] = 1; return o; })() : walk(set, start, false, start);
    var out = {}; out[start] = 1;
    E.sources(set, start).forEach(function (ev) {
      var r = walk(set, start, !!back, ev.id);
      if (back) Object.keys(r).forEach(function (k) { out[k] = 1; });
      else { var f = walk(set, start, false, ev.id); Object.keys(f).forEach(function (k) { out[k] = 1; }); }
    });
    return out;
  };
  /* the services (contexts) a node draws on */
  /* the services (contexts) whose records a node is built from */
  E.contexts = function (set, id) {
    var up = E.reach(set, id, true), out = [];
    set.edges.forEach(function (e) { var s = E.nodes[e.a], d = E.nodes[e.b]; if (up[e.b] && s && s.kind === 'sys' && !s.ext && !s.local && d && (d.kind === 'data' || d.kind === 'inf') && out.indexOf(e.a) < 0) out.push(e.a); });
    return out;
  };
  E.idsFor = function (set, id) {
    var up = E.reach(set, id, true), out = [];
    Object.keys(up).forEach(function (x) { if (E.nodes[x] && E.nodes[x].kind === 'id') out.push(x); });
    return out;
  };

  /* Decisions on connections: keep | scope | short | cut. Returns, for every
   * node, whether it still exists and, if not, why (in plain words). */
  E.applicable = function (set, k, act) {
    var e = set.ek[k], a = E.nodes[e.a], b = E.nodes[e.b];
    if (act === 'scope') {
      if (a && a.kind === 'id') return a.stab === 'scoped' ? 'This connection already uses an ID that works only here.' : b.local ? 'This stays on the device, so no service receives the ID.' : '';
      if (a && a.kind === 'sys' && b && b.kind === 'sys') return '';
      if (b && (b.kind === 'data' || b.kind === 'inf') && E.contexts(set, e.b).length > 1) return '';
      return set.nodes[e.a].ev ? 'The event needs some ID; scope the connection that receives it instead.' : 'Nothing here joins two services, so there is nothing to scope.';
    }
    if (act === 'short') return E.shortTargets(set, k).length ? '' : 'Nothing on this connection is kept beyond the moment, so there is nothing to shorten.';
    return '';
  };
  E.shortTargets = function (set, k) {
    var e = set.ek[k], b = E.nodes[e.b];
    if (b && b.short) return [e.b];
    if (b && b.kind === 'sys') return set.edges.filter(function (x) { return x.a === e.b && E.nodes[x.b] && E.nodes[x.b].short; }).map(function (x) { return x.b; });
    return [];
  };
  E.evaluate = function (set, dec) {
    dec = dec || {};
    var shortened = {}, memo = {}, onPath = {}, iso = {}, joinAt = {}, pairs = [];
    Object.keys(dec).forEach(function (k) {
      var e = set.ek[k]; if (!e) return;
      if (dec[k] === 'short') E.shortTargets(set, k).forEach(function (x) { shortened[x] = 1; });
      if (dec[k] !== 'scope') return;
      var a = E.nodes[e.a], b = E.nodes[e.b];
      /* an ID → service connection: the service gets its own ID instead of the shared ones */
      if (a && a.kind === 'id') iso[e.b] = 1;
      /* service → service: those two can no longer recognize the same person */
      else if (a && a.kind === 'sys' && b && b.kind === 'sys') pairs.push([e.a, e.b]);
      /* a join: it may only happen under purpose-limited IDs */
      else joinAt[e.b] = 1;
    });
    function live(e) { return dec[e.k] !== 'cut'; }
    function state(id) {
      if (memo[id]) return memo[id];
      if (onPath[id]) return { ok: true };
      onPath[id] = 1;
      var r = { ok: true }, n = E.nodes[id], into = set.edges.filter(function (e) { return e.b === id; });
      if (set.nodes[id].ev) r = { ok: true };
      else if (!into.length) r = { ok: true };
      else {
        var and = n && n.needs && !n.any, good = into.filter(function (e) { return live(e) && state(e.a).ok; });
        if (and ? good.length < into.length : !good.length) {
          var lost = into.filter(function (e) { return good.indexOf(e) < 0; })[0];
          r = { ok: false, why: !live(lost) ? 'separated' : 'needs', from: lost.a };
        }
        if (r.ok && n && n.needsEdge && n.needsEdge.some(function (k) { return set.ek[k] && dec[k] === 'cut'; })) r = { ok: false, why: 'separated', from: n.needsEdge[0].split('>')[0] };
        if (r.ok && n && n.hist) { var up = E.reach(set, id, true); if (Object.keys(up).some(function (x) { return shortened[x]; })) r = { ok: false, why: 'retention' }; }
        var ctx = n && (n.kind === 'data' || n.kind === 'inf') ? E.contexts(set, id) : [];
        if (r.ok && ctx.length > 1) {
          var upE = E.reach(set, id, true);
          if (ctx.some(function (c) { return iso[c]; }) || Object.keys(joinAt).some(function (j) { return upE[j]; }) || pairs.some(function (p) { return ctx.indexOf(p[0]) >= 0 && ctx.indexOf(p[1]) >= 0; })) r = { ok: false, why: 'scoped' };
        }
      }
      onPath[id] = 0; memo[id] = r; return r;
    }
    var out = {};
    Object.keys(set.nodes).forEach(function (id) { out[id] = state(id); });
    out.__short = shortened;
    return out;
  };
  E.retOf = function (id, st) { var n = E.nodes[id]; return st && st.__short && st.__short[id] && n.short ? n.short : n.ret; };
  E.tooLong = function (id, st) { var n = E.nodes[id], r = E.retOf(id, st); return !!(n && r && r[1] != null && n.enough != null && r[1] > n.enough); };
  E.unknownRet = function (id) { var r = E.nodes[id] && E.nodes[id].ret; return !!(r && r[1] == null && /^(Unknown|Set by)/.test(r[0])); };

  /* “Why is this connected?”: six plain answers for any connection. */
  E.explain = function (set, k, eco, st) {
    var e = set.ek[k], A = set.nodes[e.a], a = E.nodes[e.a], b = E.nodes[e.b], m = E.edgeMeta[k] || {}, L = function (id) { return set.nodes[id] && set.nodes[id].ev ? set.nodes[id].ev.label : E.label(id, eco, set); };
    var ids = function () { var l = a && a.kind === 'id' ? [e.a] : E.idsFor(set, e.a); return l.length ? l.map(L).join(', ') : 'None'; };
    var lcn = function (x) { return /^[A-Z]{2}|^[A-Z][a-z]+-like/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1); };
    var r = { from: L(e.a), to: L(e.b) };
    if (A && A.ev) {
      r.why = b.carry; r.need = b.need || 'required'; r.use = b.use || 'operate'; r.id = L(e.b) + ' · ' + E.stab[b.stab][0].toLowerCase();
      r.ret = 'Travels with the request'; r.who = 'Whoever receives the request'; r.sep = E.stab[b.stab][1];
    } else if (a.kind === 'id') {
      r.why = L(e.b) + ' receives your ' + lcn(L(e.a)) + ': it ' + (b.why || 'uses it') + '.'; r.need = b.need || (a.need || 'required'); r.use = b.use || a.use || 'operate';
      r.id = L(e.a) + ' · ' + E.stab[a.stab][0].toLowerCase(); r.ret = (b.log || ['30 days, in request logs', 30])[0]; r.who = b.who || L(e.b);
      r.sep = a.stab === 'stable' ? 'Yes: give ' + L(e.b) + ' its own ID, and it can no longer be matched with the other services.' : E.stab[a.stab][1];
    } else {
      var ctx = E.contexts(set, e.b);
      r.why = b.kind === 'inf' ? 'Put together, the inputs suggest this. ' + b.why : b.kind === 'sys' ? L(e.a) + ' passes this to ' + L(e.b) + '.' : b.why;
      r.need = b.need || (b.kind === 'inf' ? 'optional' : 'required'); r.use = b.use || 'operate'; r.id = ids();
      var rr = b.kind === 'sys' ? b.log || ['Set by ' + L(e.b), null] : E.retOf(e.b, st) || ['As long as its inputs exist', null];
      r.ret = rr[0]; r.who = b.who || L(e.b);
      r.sep = (b.kind === 'data' || b.kind === 'inf') && ctx.length > 1 ? 'Yes: if ' + E.list(ctx.map(L)) + ' use different IDs, they can no longer recognize the same person.' : b.sep || 'Yes: stop this connection, and this goes with it.';
    }
    ['why', 'need', 'use', 'who', 'sep'].forEach(function (f) { if (m[f]) r[f] = m[f]; });
    if (m.ret) r.ret = m.ret[0];
    r.joins = b && (b.kind === 'data' || b.kind === 'inf') ? E.contexts(set, e.b).length > 1 : a && a.kind === 'sys' && b && b.kind === 'sys';
    return r;
  };
})();
