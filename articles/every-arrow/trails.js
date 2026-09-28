/* Corner-case trails. One engine, eight stories. Each story is a list of dated
   moments plus world(step, habits), which derives everything on screen —
   the artifact, its history, who holds it, and the counters — from the
   story's state. Habits are switches; nothing is scripted twice.

   The stories are plain data + functions, so scripts/every_arrow/build.mjs
   runs the same world() in Node to write each trail's static fallback (the
   no-JS and print version): the printed counters cannot disagree with the
   interactive ones. People, systems and figures are invented. */
(function(root){
  var hasDom = typeof document !== "undefined";
  var RM = hasDom && root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function n(v){ return typeof v === "number" ? v.toLocaleString("en-US") : v; }
  function S(tag, title, body, myth, real){ return { tag:tag, title:title, body:body, myth:myth, real:real }; }
  function OK(tag, title, body, myth, real){ var c = S(tag, title, body, myth, real); c.safe = true; return c; }
  function row(cells, hot){ return "<tr" + (hot ? " class=\"hot\"" : "") + ">" + cells.map(function(c){ return "<td>" + c + "</td>"; }).join("") + "</tr>"; }
  function logl(t, s, hot){ return "<div class=\"ll" + (hot ? " hot" : "") + "\"><span>" + t + "</span>" + s + "</div>"; }
  var T = {};

  /* ── 1 · Version 11 (Google Docs) ─────────────────────────────── */
  T.v11 = { name:"Version 11",
    box:"YOU CAN STILL REVOKE", out:"OUTSIDE THE COMPANY",
    habits:[
      { id:"least", t:"Tom gets Commenter", d:"He was fixing wording. Commenters can suggest edits but can’t open version history — so they can’t restore from it." },
      { id:"clean", t:"Break the timeline", d:"Share <code>File › Make a copy</code>. The copy’s history starts today; version 11 isn’t in it." },
      { id:"gear",  t:"Lock the gear ⚙", d:"Untick <em>Editors can change permissions and share</em> and the viewers’ download / print / copy option." },
      { id:"pdf",   t:"Flatten for outsiders", d:"The agency gets <code>File › Download › PDF</code> from you — not a live link." }
    ],
    steps:[["SEP 10 09:05","Raw export pasted"],["SEP 10 16:20","v12: rows → counts"],["SEP 12 10:00","Shared with Tom"],["SEP 12 10:40","Tom restores v11"],["SEP 12 10:42","A meeting"],["SEP 12 14:05","Tom shares with Mike"],["SEP 13 09:30","To the design agency"],["SEP 15 11:00","You notice"]],
    label:function(k,H){ if (k===2 && H.least) return "Tom as Commenter"; if (k===2 && H.clean) return "Tom gets a clean copy"; if (k===3 && (H.least||H.clean)) return "Nothing to restore"; if (k===5 && (H.gear||H.least)) return "Tom has to ask"; if (k===6 && H.pdf && !(!H.gear && !H.least)) return "Agency gets a PDF"; return null; },
    world:function(i,H){
      var restored = i>=3 && !H.least && !H.clean, fixed = i>=7, live = restored && !fixed;
      var tom = i>=2, mike = i>=5 && !H.gear && !H.least, ag = i>=6;
      var viaMike = ag && mike, link = ag && (viaMike || !H.pdf), pdf = ag && !viaMike && H.pdf;
      var agPII = ag && restored; /* the page they received carried the table */
      var agCopy = link && !H.gear, gone = fixed;
      var tomSees = tom && ((!H.least && !H.clean) || live), mikeSees = mike && !gone && (live || !H.clean);
      var m1 = (tomSees?1:0) + (mikeSees?1:0) + (link && !gone && live ? 1 : 0);
      var m2 = (mike?1:0) + (viaMike?1:0);
      var m3 = (agCopy && agPII ? 1:0) + (pdf && agPII ? 1:0);
      var m4 = agPII ? 1284 : 0;
      var table = "<table class=\"tl-tbl\"><tr><th>Name</th><th>Email</th><th>Phone</th><th>Plan</th></tr>" + row(["A. Mensah","a.mensah@…","+1 415 …","Plus"]) + row(["B. Laurent","b.laurent@…","+33 6 …","Basic"]) + row(["Dana K.","dana.k@…","+1 415 …","Plus"]) + "</table><p class=\"tl-small\">… 1,281 more rows</p>";
      var clean = "<p><strong>Q4 onboarding plan</strong></p><p>1,284 customers onboarded in Q3 · 62% on Plus · churn risk concentrated in the first 30 days.</p>";
      var art;
      if (i===0) art = "<p><strong>Q4 onboarding plan</strong> <span class=\"tl-pill hot\">raw CRM export</span></p>" + table;
      else if (live) art = clean + "<div class=\"tl-restored\"><span class=\"tl-pill hot\">restored from v11 · Sep 12 10:40</span>" + table + "</div>";
      else art = clean + (fixed && restored ? "<p class=\"tl-small\">v14 restored by you · Sep 15 11:00</p>" : "");
      var tr = [];
      var shared = i>=2, off = H.clean && shared;
      tr.push({a:"v1–v10 · Sep 10", b:"drafting", c: off?"off":""});
      tr.push({a:"v11 · 16:05", b:"raw customer table", c: off?"off":(shared && !H.least ? "hot":"")});
      tr.push({a:"v12 · 16:20", b:"rows → counts", c: off?"off":""});
      tr.push({a:"v14 · Sep 11", b:"final draft", c: off?"off":""});
      if (off) tr.push({a:"Sep 12 · copy", b:"history starts here", c:""});
      if (restored) tr.push({a:"v15 · Sep 12 10:40", b:"Tom restored v11", c:"hot"});
      if (fixed && restored) tr.push({a:"v16 · Sep 15", b:"you restored v14", c:""});
      var who = ["you"]; if (tom && !H.least) who.push("Tom"); if (mike && !gone) who.push("Mike");
      var nodes = [ {id:"you", name:"You", role:"Owner", col:0, inside:true} ];
      if (tom) nodes.push({id:"tom", name:"Tom", role:H.least?"Commenter":"Editor", col:1, inside:true, via:"you", hot:tomSees, note: tomSees?"SEES THE LIST":""});
      if (i>=5) nodes.push(mike ? {id:"mike", name:"Mike", role: gone?"removed":"Editor", col:2, inside:true, via:"tom", hot:mikeSees, gone:gone, note: mikeSees?"SEES THE LIST":""} : {id:"mike", name:"Mike", role:"not added", col:2, via:"tom", blocked:"only you can share"});
      if (ag) nodes.push({id:"ag", name:"Agency", role: pdf ? "PDF" : (gone ? "link revoked" : "Viewer link"), col:3, outside:true, via: viaMike?"mike":"you", hot:agPII, gone: gone && link});
      if (agCopy) nodes.push({id:"agc", name:"Copy", role:"Owner: agency", col:4, outside:true, file:true, via:"ag", hot:agPII});
      var c;
      switch(i){
        case 0: c = S("Sep 10 · The raw material","You paste the customer export to build a summary","1,284 rows — names, emails, phones, plans — go straight from the CRM into a working doc. It feels temporary. Every autosave makes it a version.","It’s just a scratch doc.","Scratch docs keep permanent history."); break;
        case 1: c = S("Sep 10 · Cleanup","Version 12: the table becomes three numbers","You replace the rows with counts and percentages. The page is clean. Version 11, saved at 16:05, still holds every row.","I removed it.","You removed it from the page. Version 11 kept it."); break;
        case 2: c = H.least ? OK("Habit on","Tom joins as a Commenter","He can suggest wording. He can’t open version history, so version 11 is out of his reach.","He needs Editor to help.","He needs to suggest. Commenter is enough.")
                 : H.clean ? OK("Habit on","Tom gets a clean copy","You shared File › Make a copy. Its history begins today. Version 11 stays in your original, which Tom can’t open.","Editors see everything.","They see everything in this file — and this file started today.")
                 : S("Blind spot · Retroactive access","Sep 12: Tom joins as an Editor","He only needs to tidy the wording. As an Editor he can open version history back to Sep 10 — version 11 included.","He’ll only see today’s page.","Editor access includes every past version."); break;
        case 3: c = restored ? S("Blind spot · Restore resurrects","10:40 — Tom clicks “Restore this version” on v11","Hunting for an older opening paragraph, he opens version 11 and restores it to copy from. The raw customer table is back on the live page — for everyone with access.","Version history is read-only.","Any Editor can make an old version the current one.")
                 : OK("Habit on","Nothing to restore", H.least ? "As a Commenter, Tom can’t open version history at all." : "The shared copy has no version 11. The oldest thing Tom could restore is Sep 12.","Mistakes need care to avoid.","This mistake has nowhere to happen."); break;
        case 4: c = restored ? S("Blind spot · Nobody is looking","10:42 — a meeting pulls Tom away","The restore is one line in version history. Nobody is asked to confirm it, and nobody looks at the page again for three hours.","Someone would notice.","A restore looks like any other edit.")
                 : OK("Habit on","10:42 — a meeting. Nothing is waiting.","The page Tom walks away from is the clean one.","Distraction causes leaks.","Distraction only matters when the page is dangerous."); break;
        case 5: c = mike ? S("Blind spot · The viral share","14:05 — Tom shares “the latest” with Mike", live ? "Back at his desk, Tom adds Mike as an Editor. Mike sees the customer table on the page itself — he doesn’t even need history." : "Tom adds Mike as an Editor. Mike inherits the whole history, version 11 included.","Tom only passes on what I gave him.","By default an Editor can share like an owner.")
                 : OK("Habit on","Tom has to ask you", H.least ? "Commenters can’t add people." : "With “Editors can change permissions and share” unticked, only you add people.","I trust Tom’s judgement.","You don’t have to: the decision stays yours."); break;
        case 6:
          if (viaMike) c = S("Blind spot · Third-party egress","Sep 13 — Mike sends the agency a live link", agPII ? "They open it for the flyer copy. The table of 1,284 customers is on page one, and their designer makes a copy to work offline." : "They get a live link to a file whose history holds version 11, and their designer makes a copy to work offline.","It’s only going to the designers.","It left the company — as a copy nobody here can recall.");
          else if (pdf && agPII) c = S("Careful","You export a PDF — of the restored page","A PDF is only as clean as the page you export. Tom’s restore is still live, so the PDF carries the customer table.","PDF means safe.","A PDF flattens history, not mistakes.");
          else if (pdf) c = OK("Habit on","The agency gets a flattened PDF","Today’s clean page as a PDF: no live link, no history, no copy button.","Outsiders need the live doc.","Readers need the words, not the timeline.");
          else if (agPII) c = S("Careful","You send the agency a view-only link","Copying is switched off, but Tom’s restore is still live: the customer table is on the page they read.","View-only is safe.","View-only still means they can read it.");
          else if (H.gear) c = OK("Habit on","The agency gets a locked view-only link","No copy, no download, no history, and you can revoke it tomorrow.","A link is a leak.","A locked link is a decision you can undo.");
          else c = OK("Clean page, open settings","You send the agency a view-only link","The page is clean, so nothing personal goes. But download and copy are on by default, and their designer makes a copy you can’t recall — lock the gear too.","The page is clean, so the link is safe.","Today it is. The copy is theirs whatever the page holds next.");
          break;
        default: c = (m3||m4) ? S("Sep 15 · Afterwards","You notice, restore version 14 and remove Mike and the agency","That works going forward only. " + (m3 ? "The agency’s copy has its own owner now. " : "") + "Customer data reached a third party, so this may be a notifiable breach: bring in your privacy team today — under GDPR the regulator clock is 72 hours from when you become aware.","Restore it back and it’s undone.","Restore and revoke work forward. Exposure doesn’t rewind.")
               : (restored ? S("Sep 15 · Afterwards","You restore version 14","The table was live for three days, visible to everyone in the file — but it never left the company. Fix it, then fix the habit.","No harm, no foul.","It was luck, not design.")
               : OK("Same week, habits on","Nothing to undo", "The customer list never left version 11 of a file only you can open." + (m2 ? " Mike and the agency still got in without you deciding — only the gear stops that." : ""),"This was bad luck.","The design didn’t allow it."));
      }
      return { cap:c, art:{ title:"Q4 onboarding plan", html:art }, traceH:"Version history · open to " + who.join(", "), trace:tr, nodes:nodes,
        meters:[{v:m1,l:"people besides you who can see the customer list"},{v:m2,l:"people who got in without you deciding"},{v:m3,l:"copies of the list you can’t recall"},{v:m4,l:"customers exposed outside the company"}] };
    }
  };

  /* ── 2 · The opt-out at 01:58 (consent) ──────────────────────── */
  T.optout = { name:"The opt-out at 01:58",
    box:"INSIDE NORTHSTAR", out:"THE AD PARTNER",
    habits:[
      { id:"read",  t:"Check consent per record", d:"The job asks the consent service for each row as it reads it — not once, at midnight." },
      { id:"retry", t:"Re-filter every retry", d:"A retried batch is rebuilt against today’s consent, never replayed from the dead-letter queue." },
      { id:"derived", t:"Revocation reaches derived data", d:"Segments and features built from her data are purged when she says no." },
      { id:"push",  t:"Tell the partner", d:"Revocations go to the partner’s suppression API within minutes." }
    ],
    steps:[["SEP 18 00:00","Nightly job starts"],["SEP 18 01:58","Dana opts out"],["SEP 18 02:10","Job reaches Dana"],["SEP 18 03:00","Export sent"],["SEP 18 03:04","Timeout → retry"],["SEP 19 00:00","The next night"],["SEP 25 20:15","Dana still sees ads"]],
    label:function(k,H){ if (k===2 && H.read) return "Job skips Dana"; if (k===4 && H.retry) return "Retry re-filtered"; return null; },
    world:function(i,H){
      var incl = !H.read, sent = i>=3 && incl, dup = i>=4 && sent && !H.retry;
      var copies = H.push ? 0 : (sent?1:0) + (dup?1:0);
      var segStale = i>=5 && !H.derived, jobStale = i>=2 && i<5 && incl, queueStale = dup && i<5;
      var stale = (jobStale?1:0) + (queueStale?1:0) + (segStale?1:0) + (copies ? 1 : 0);
      var reach = (copies || segStale) ? "never" : (incl && i>=2 ? "22 h" : (i>=1 ? "minutes" : "—"));
      var L = "";
      L += logl("00:00:02","audience_job: loaded consent snapshot (41,882,114 rows)");
      if (i>=1) L += logl("01:58:40","consent: dana.k → <b>REVOKED</b> (advertising)", true);
      if (i>=2) L += incl ? logl("02:10:17","audience_job: dana.k included · snapshot says GRANTED", true) : logl("02:10:17","audience_job: dana.k skipped · consent REVOKED at read");
      if (i>=3) L += sent ? logl("03:00:05","export → partner: segments_0918.csv (dana.k in file)", true) : logl("03:00:05","export → partner: segments_0918.csv (dana.k absent)");
      if (i>=4) L += dup ? logl("03:04:31","upload timeout · DLQ replay of the same file", true) : (sent ? logl("03:04:31","upload timeout · batch rebuilt · dana.k dropped") : logl("03:04:31","upload timeout · batch rebuilt"));
      if (i>=5) L += segStale ? logl("00:00:03","lookalike_seed uses segment ‘likely_parent’ (built Sep 11, includes dana.k)", true) : logl("00:00:03","segments purged for revoked users (1 row)");
      if (i>=6) L += copies ? logl("20:15","partner serves ad to hashed(dana.k)", true) : logl("20:15","partner: hashed(dana.k) on suppression list");
      var tr = [{a:"Sep 3", b:"GRANTED", c:""}];
      if (i>=1) tr.push({a:"Sep 18 01:58", b:"REVOKED", c:""});
      if (jobStale) tr.push({a:"job cache", b:"still GRANTED", c:"hot"});
      if (queueStale) tr.push({a:"retry queue", b:"file from before", c:"hot"});
      if (segStale) tr.push({a:"segment", b:"built Sep 11", c:"hot"});
      if (copies) tr.push({a:"partner", b:copies + " cop" + (copies>1?"ies":"y"), c:"hot"});
      var nodes = [{id:"maya", name:"Dana", role:"customer", col:0, person:true}, {id:"cs", name:"Consent", role:"service", col:1, sys:true, inside:true, via:"maya"}];
      nodes.push({id:"job", name:"Nightly job", role: jobStale ? "stale snapshot" : "reads per row", col:2, sys:true, inside:true, via:"cs", hot:jobStale, safe:H.read});
      if (i>=5) nodes.push({id:"seg", name:"Segment", role: segStale ? "still has Dana" : "purged", col:2, row:1, sys:true, inside:true, via:"job", hot:segStale});
      if (i>=3) nodes.push({id:"pt", name:"Partner", role: sent ? (H.push ? "suppressed" : "has her data") : "nothing sent", col:3, outside:true, via:"job", hot:sent && !H.push});
      if (dup) nodes.push({id:"pc", name:"Copy 2", role:"from the retry", col:4, outside:true, file:true, via:"pt", hot:!H.push});
      var c;
      switch(i){
        case 0: c = S("Sep 18 · Midnight","The nightly audience job loads consent — once","41.9 million consent states are read at 00:00 and cached for the run, which takes four hours.","The job respects consent.","It respects consent as of midnight."); break;
        case 1: c = S("01:58","Dana taps “Stop personalised ads”","The consent service records REVOKED instantly, and the app thanks her. The job, two hours into its run, doesn’t hear about it.","Her choice took effect.","It took effect in one system."); break;
        case 2: c = incl ? S("Blind spot · Revocation mid-job","02:10 — the job reaches Dana’s row","Its snapshot says GRANTED, so her row goes into tonight’s audience file.","Consent is checked.","It was checked — before she changed it.") : OK("Habit on","02:10 — the job asks, and skips her","Checking consent per record means her 01:58 answer is the one that counts.","Per-row checks are too slow.","They are one cache lookup per row."); break;
        case 3: c = sent ? S("Blind spot · Exports already sent","03:00 — the file goes to the ad partner","Her hashed email and segments leave the company. Nothing now can pull them back except the partner.","Hashed means anonymous.","A hashed email is the same key on every site.") : OK("Habit on","03:00 — the export goes without her","The file the partner receives doesn’t contain Dana.","",""); break;
        case 4: c = dup ? S("Blind spot · Retries & dead letters","03:04 — a timeout, and a replay","The partner actually received the file, but the upload timed out. The dead-letter queue replays the same file. The partner now holds two copies.","Retries are harmless.","A retry can replay a decision that has since changed.") : OK(H.retry ? "Habit on" : "03:04", H.retry ? "A timeout, and a rebuilt batch" : "A timeout, and a replay", sent ? "The retry is rebuilt against current consent, so the second attempt drops her." : (H.retry ? "The rebuilt batch checks consent again." : "The replayed file never contained her, so replaying it does no harm this time."),"",""); break;
        case 5: c = segStale ? S("Blind spot · Derived data","Sep 19 — tonight’s job excludes her. Last week’s segment doesn’t.","The ‘likely parent’ segment built on Sep 11 still lists her, and it seeds the lookalike model.","New runs fix it.","Old derivatives keep the old answer.") : OK("Habit on","Sep 19 — every copy agrees","Tonight’s job and last week’s segment both say no.","",""); break;
        default: c = copies || segStale ? S("Sep 25 · A week later","Dana is still seeing personalised ads","Her “no” reached the consent service in milliseconds, but " + (copies ? "the partner’s copies" : "the derived segment") + " never heard it. She has no way to know which system ignored her.","Opt-out is a switch.","Opt-out is a message that must reach every copy.") : OK("Same week, habits on","Her no reached everything","Consent service, nightly job, retries, segments and the partner all agree within minutes.","","");
      }
      if (c.myth === "") { c.myth = "It worked because nothing went wrong."; c.real = "It worked because each copy asks for today’s answer."; }
      return { cap:c, art:{ title:"What the pipeline logged", html:"<div class=\"tl-log\">" + L + "</div>" }, traceH:"Consent for Dana, copy by copy", trace:tr, nodes:nodes,
        meters:[{v:copies,l:"copies of Dana’s data the partner still uses"},{v:stale,l:"places still acting on her old answer"},{v:reach,l:"until her no reaches everything"}] };
    }
  };

  /* ── 3 · The debug flag (logging) ───────────────────────────── */
  T.debug = { name:"The debug flag",
    box:"INSIDE NORTHSTAR", out:"OUTSIDE",
    habits:[
      { id:"redact", t:"Redact at write time", d:"The logger drops any field tagged personal before the line exists." },
      { id:"expire", t:"Debug flags expire", d:"Every flag carries a 24-hour TTL. Forgetting it is harmless." },
      { id:"ttl",    t:"Logs live 7 days", d:"And they never flow into the warehouse ‘for analytics’." },
      { id:"scope",  t:"Scoped log access", d:"Only the on-call for this service, by just-in-time grant." }
    ],
    steps:[["SEP 20 14:00","A failing payment"],["SEP 20 14:01","Full requests logged"],["SEP 20 14:30","Bug fixed"],["SEP 21 02:00","Logs shipped"],["SEP 26 03:00","Snapshots"],["OCT 1 10:12","Someone searches"],["OCT 1 17:00","The flag is found"]],
    label:function(k,H){ if (k===2 && H.expire) return "Flag expires Sep 21"; return null; },
    world:function(i,H){
      var days = i<2 ? 0 : Math.min(H.expire ? 1 : 11, [0,0,0,1,6,11,11][i]);
      var perDay = 38400, lines = H.redact ? 0 : (i>=1 ? Math.max(1200, days*perDay) : 0);
      if (i===1 && !H.redact) lines = 1200;
      var places = 0; if (lines) { places = 1; if (i>=3) places += H.ttl ? 1 : 2; if (i>=4 && !H.ttl) places += 1; }
      var readers = lines ? (H.scope ? 6 : 1214) : 0;
      var L = "";
      L += logl("14:00:11","flags: checkout-api LOG_LEVEL=DEBUG (ana.k)");
      if (i>=1) L += H.redact ? logl("14:01:03","POST /pay 402 · body: {email:[redacted], address:[redacted], last4:[redacted]}") : logl("14:01:03","POST /pay 402 · body: {email:“dana.k@…”, address:“12 Elm St…”, last4:“4417”}", true);
      if (i>=1) L += H.redact ? logl("14:01:09","GET /reset?token=[redacted]") : logl("14:01:09","GET /reset?token=8f3a…&email=dana.k@…", true);
      if (i>=2) L += logl("14:30:40","fix deployed · " + (H.expire ? "flag auto-expires Sep 21 14:00" : "flag still DEBUG"), !H.expire && !H.redact);
      if (i>=3) L += logl("02:00:00","shipper → observability vendor (30 d)" + (H.ttl ? "" : " · nightly copy → warehouse.logs_raw"), !H.redact);
      if (i>=5) L += H.scope ? logl("10:12:55","search denied: support-contractor-17 has no grant") : logl("10:12:55","search by support-contractor-17: email:“j.okafor@…” (not their customer)", !H.redact);
      if (i>=6) L += logl("17:00:00","flag found · on for " + (H.expire ? "1 day" : "11 days"));
      var tr = [{a:"app logs", b:(H.ttl?"7 d":"395 d"), c: lines?"hot":""}];
      if (i>=3) tr.push({a:"vendor", b:"30 d", c: lines?"hot":""});
      if (i>=3 && !H.ttl) tr.push({a:"warehouse", b:"no TTL", c: lines?"hot":""});
      if (i>=4 && !H.ttl) tr.push({a:"snapshots", b:"35 d", c: lines?"hot":""});
      var nodes = [{id:"ana", name:"Ana", role:"engineer", col:0, person:true, inside:true}, {id:"logs", name:"App logs", role: lines ? n(lines) + " lines" : "clean", col:1, sys:true, inside:true, via:"ana", hot:!!lines}];
      if (i>=3) nodes.push({id:"ven", name:"Vendor", role:"observability", col:4, row:1, outside:true, sys:true, via:"logs", hot:!!lines});
      if (i>=3 && !H.ttl) nodes.push({id:"wh", name:"Warehouse", role:"logs_raw", col:2, sys:true, inside:true, via:"logs", hot:!!lines});
      if (i>=4 && !H.ttl) nodes.push({id:"bk", name:"Backups", role:"35 days", col:3, file:true, inside:true, via:"wh", hot:!!lines});
      if (i>=5) nodes.push(H.scope ? {id:"ct", name:"Contractor", role:"no grant", col:1, row:1, person:true, via:"logs", blocked:"access denied"} : {id:"ct", name:"Contractor", role:"searches an ex", col:1, row:1, person:true, inside:true, via:"logs", hot:!!lines});
      var c;
      switch(i){
        case 0: c = S("Sep 20 · 14:00","A payment fails and Ana turns on DEBUG","Policy says “Do not log personal data.” The flag doesn’t read policy.","The policy protects us.","A policy is a sentence. The logger is code."); break;
        case 1: c = H.redact ? OK("Habit on","Debug lines, without the person","The logger strips tagged fields before writing. Ana still sees what failed.","Debugging needs the raw payload.","It needs the shape of the payload.") : S("Blind spot · Debug logging","Full request bodies go to the log","Emails, addresses, last four digits — and password-reset links with live tokens.","Logs are internal.","Logs are one of the commonest places raw personal data ends up."); break;
        case 2: c = H.redact && !H.expire ? OK("Redaction on","14:30 — fixed. The flag stays on, harmlessly.","Nobody turns it off, but the lines it writes hold no people.","",""): H.expire ? OK("Habit on","Bug fixed. The flag turns itself off tomorrow.","A 24-hour TTL means forgetting costs a day, not a fortnight.","",""): S("Blind spot · The forgotten switch","14:30 — fixed. The flag stays on.","Nobody owns turning it off. It will run for eleven days.","Someone will clean up.","Nobody’s job is nobody’s job."); break;
        case 3: c = H.redact && !H.ttl ? OK("Redaction on","02:00 — logs are shipped, with nobody in them","The vendor and the warehouse get error shapes, not customers.","","") : S(H.ttl ? "Habit on" : "Blind spot · Copies you forgot","02:00 — logs are shipped", H.ttl ? "To the observability vendor for 30 days, and nowhere else." : "To the observability vendor, and every night a copy lands in the warehouse “for analytics” — with no TTL.","Logs are temporary.","Every sink keeps its own clock."); if (H.ttl) c.safe = true; break;
        case 4: c = H.redact && !H.ttl ? OK("Redaction on","Sep 26 — snapshots of clean logs","The backups copy lines that hold no personal data.","","") : H.ttl ? OK("Habit on","No snapshots of logs","Logs aren’t in the warehouse, so they aren’t in its backups.","","") : S("Blind spot · Backups","Sep 26 — the warehouse is snapshotted","Now the lines exist in backups for 35 days, beyond any delete you run on the table.","Delete the table and it’s gone.","Backups remember what tables forget."); break;
        case 5: c = H.redact && !H.scope ? OK("Redaction on","Oct 1 — a contractor searches an ex-partner’s email, and finds nothing","1,214 people can still search the logs — access is its own problem — but the logs never held her email.","Broad access is harmless if the data is clean.","Clean data limits the damage; it doesn’t fix the access.") : H.scope ? OK("Habit on","A curious search is refused","A support contractor tries to look up someone they know. No grant, no result — and an alert.","Broad access helps support.","Case-bound access helps support without helping curiosity.") : S("Blind spot · Insider curiosity","Oct 1 — a contractor searches an ex-partner’s email","1,214 people can search these logs. One of them does something no policy anticipated.","We trust our staff.","Trust is not an access model."); break;
        default: c = lines ? S("Oct 1 · 17:00","The flag is found — " + (H.expire ? "after 1 day" : "after 11 days"), n(lines) + " lines with personal data, in " + places + " place" + (places>1?"s":"") + ". Deleting the app logs touches one of them.","We’ll just delete the logs.","You’ll delete one copy of the logs.") : OK("Same incident, habits on","Nothing personal was ever written","The bug was fixed on the same afternoon. The logs held the error, not the customer.","","");
      }
      if (c.myth === "") { c.myth = "Good engineers don’t make this mistake."; c.real = "Good systems make the mistake cheap."; }
      return { cap:c, art:{ title:"checkout-api · logs", html:"<div class=\"tl-log\">" + L + "</div>" }, traceH:"Where the lines live", trace:tr, nodes:nodes,
        meters:[{v:lines,l:"log lines holding personal data"},{v:places,l:"places those lines now live"},{v:readers,l:"people who can search them"}] };
    }
  };

  /* ── 4 · The family TV (shared devices, household linkage) ─── */
  T.family = { name:"The family TV",
    box:"DANA’S OWN PHONE", out:"THE FAMILY’S SCREENS",
    habits:[
      { id:"generic", t:"Generic lock-screen text", d:"“Your order is out for delivery” — never the product." },
      { id:"noinfer", t:"No sensitive inferences for ads", d:"Health and pregnancy categories are excluded from targeting." },
      { id:"nohouse", t:"No household linking", d:"Shared IP and evening timing never join devices into one person." },
      { id:"profile", t:"Family profile on shared devices", d:"The family iPad isn’t signed in as Dana." }
    ],
    steps:[["SEP 10 22:10","A private purchase"],["SEP 10 22:11","The model infers"],["SEP 11 01:00","The graph links"],["SEP 11 07:45","The lock screen"],["SEP 11 20:30","Movie night"],["SEP 11 20:31","A question"]],
    label:function(){ return null; },
    world:function(i,H){
      var infer = i>=1 && !H.noinfer, link = i>=2 && !H.nohouse;
      var notif = i>=3 && !H.generic && !H.profile, ad = i>=4 && infer && link;
      var screens = (notif?1:0) + (ad?1:0), people = screens ? (ad ? 4 : 3) : 0, infs = (infer ? 1 : 0) + (link ? 1 : 0);
      var art = "";
      if (i<3) art = "<div class=\"tl-phone\"><b>Dana’s phone</b><p>Search: pregnancy test · 1 item · Checkout ✓</p>" + (infer ? "<p class=\"tl-pill hot\">segment: likely_expecting</p>" : "") + "</div>";
      else if (i===3) art = "<div class=\"tl-lock\"><b>Family iPad · lock screen · 07:45</b><p>" + (notif ? "<span class=\"hotx\">📦 Your pregnancy test is out for delivery</span>" : (H.profile ? "No notifications for this profile" : "📦 Your order is out for delivery")) + "</p></div>";
      else art = "<div class=\"tl-tv\"><b>Living-room TV · 20:30</b><p>" + (ad ? "<span class=\"hotx\">Ad: “Prenatal vitamins for the first trimester”</span>" : "Ad: “Weekend sale on garden furniture”") + "</p></div>";
      var tr = [{a:"22:10", b:"purchase on phone", c:""}];
      if (infer) tr.push({a:"22:11", b:"inference: likely expecting", c:"hot"});
      if (link) tr.push({a:"01:00", b:"home IP → iPad, TV linked", c:"hot"});
      if (notif) tr.push({a:"07:45", b:"product name on iPad", c:"hot"});
      if (ad) tr.push({a:"20:30", b:"prenatal ad on TV", c:"hot"});
      var nodes = [{id:"pr", name:"Dana", role:"phone", col:0, person:true, inside:true}, {id:"rt", name:"Retailer", role: infer ? "infers pregnancy" : "sells a test", col:1, sys:true, via:"pr", hot:infer}];
      if (i>=2) nodes.push({id:"ipad", name:"Family iPad", role: H.profile ? "family profile" : "signed in as Dana", col:2, outside:true, via:"rt", hot:notif, blocked: link ? "" : ""});
      if (i>=2) nodes.push({id:"tv", name:"TV", role: link ? "linked by home IP" : "not linked", col:3, outside:true, via: link ? "rt" : null, hot:ad});
      if (i>=5) nodes.push({id:"mil", name:"Mother-in-law", role: screens ? "sees it first" : "sees a sofa ad", col:4, person:true, outside:true, via:"tv", hot:!!screens});
      var c;
      switch(i){
        case 0: c = S("Sep 10 · 22:10","Dana buys a pregnancy test on her phone","She hasn’t told anyone. She bought it on her own phone, late, on purpose.","It’s between me and the shop.","It’s between the shop and everything it links to."); break;
        case 1: c = infer ? S("Blind spot · Inference","22:11 — the model files her as “likely expecting”","One purchase becomes a sensitive fact she never shared. Inference counts as collection.","We only use what customers give us.","You used what she gave to create what she didn’t.") : OK("Habit on","The purchase stays a purchase","Pregnancy is a category the ad system may not infer.","",""); break;
        case 2: c = link ? S("Blind spot · Household leakage","01:00 — the graph links the family’s screens to her","Same home IP, same evenings: the family iPad and the living-room TV join her profile.","Cross-device is a convenience.","Cross-device moves a secret from one screen to every screen.") : OK("Habit on","No link is made","Sharing a router isn’t consent to share a profile.","",""); break;
        case 3: c = notif ? S("Blind spot · Shared devices","07:45 — the family iPad lights up","It’s signed into her account. The lock screen names the product to whoever walks past.","Notifications are for the user.","On a shared device, the user is whoever is looking.") : OK("Habit on","07:45 — nothing revealing", H.profile ? "The iPad runs a family profile; her orders don’t notify there." : "The notification says an order is coming. Nothing more.","",""); break;
        case 4: c = ad ? S("Blind spot · Inference transfer","20:30 — movie night, and an ad for prenatal vitamins","What one device revealed now follows her to the biggest screen in the house.","Ads are harmless.","An ad can be an announcement.") : OK("Habit on","20:30 — an ordinary ad","Garden furniture. Nobody learns anything.","",""); break;
        default: c = screens ? S("Sep 11 · 20:31","“Dana — is there something you want to tell us?”","She didn’t tell her family. The system did. " + (screens===2 ? "Two screens" : "One screen") + ", " + people + " people, one sentence she didn’t get to say herself.","Nothing leaked; no data left the company.","Context collapse doesn’t need a breach.") : OK("Same evening, habits on","Her news is still hers","The shop sold a product. Nobody else in the house learned anything.","","");
      }
      if (c.myth === "") { c.myth = "Privacy is about hackers."; c.real = "Most privacy harm happens exactly as designed."; }
      return { cap:c, art:{ title:"What each screen showed", html:art }, traceH:"How the secret travelled", trace:tr, nodes:nodes,
        meters:[{v:screens,l:"shared screens that revealed it"},{v:people,l:"people who could learn before she told them"},{v:infs,l:"things inferred about her that she never said"}] };
    }
  };

  /* ── 5 · The CSV that escaped (exports) ──────────────────────── */
  T.csv = { name:"The CSV that escaped",
    box:"UNDER COMPANY CONTROL", out:"OUTSIDE ANY CONTROL",
    habits:[
      { id:"agg", t:"Export aggregates, not rows", d:"Dashboards export counts. Row-level exports need a ticket and a reason." },
      { id:"dlp", t:"Identifying columns can’t leave", d:"Names become internal IDs; email, phone and health flags are stripped on export; DLP blocks attachments that carry them." },
      { id:"link", t:"Share links, not files", d:"The consultant gets an expiring, logged, revocable link." },
      { id:"ai", t:"Approved AI only", d:"A company AI tool with no training on inputs and zero retention." }
    ],
    steps:[["OCT 6 16:50","Board deck due"],["OCT 6 16:52","Export → CSV"],["OCT 6 17:05","Email to consultant"],["OCT 6 19:30","To a personal drive"],["OCT 6 21:10","Ask a chatbot"],["OCT 9 10:00","A deletion request"]],
    label:function(){ return null; },
    world:function(i,H){
      var rows = H.agg ? 0 : 48210, pii = !H.agg && !H.dlp;
      var dl = i>=1, mail = i>=2 && !H.link, drive = i>=3, bot = i>=4 && !H.ai;
      var hot = function(on){ return on && pii; };
      var out = (mail?1:0) + (drive?1:0) + (bot?1:0);
      var outPII = pii ? out : 0;
      var nodel = pii ? (mail?1:0) + (drive?1:0) + (bot?1:0) + (dl?1:0) : 0;
      var cols = H.agg ? "<table class=\"tl-tbl\"><tr><th>Month</th><th>Churned</th><th>Rate</th></tr>" + row(["Jul","1,204","2.1%"]) + row(["Aug","1,377","2.4%"]) + row(["Sep","1,512","2.6%"]) + "</table>"
        : "<table class=\"tl-tbl\"><tr><th>" + (H.dlp ? "customer_id" : "name") + "</th>" + (H.dlp ? "" : "<th>email</th><th>phone</th><th>health</th>") + "<th>plan</th><th>churn_risk</th></tr>" + row([H.dlp ? "c_48c1" : "J. Park"].concat(H.dlp ? [] : ["j.park@…","+1 212 …","yes"]).concat(["Plus","0.81"]), pii) + row([H.dlp ? "c_91f0" : "R. Osei"].concat(H.dlp ? [] : ["r.osei@…","+44 7 …","no"]).concat(["Basic","0.77"]), pii) + "</table><p class=\"tl-small\">… 48,208 more rows</p>";
      var tr = [];
      if (dl) tr.push({a:"~/Downloads", b:"churn_candidates.csv", c: hot(true)?"hot":""});
      if (i>=2) tr.push(H.link ? {a:"link", b:"expires in 7 days", c:""} : {a:"email", b:"consultant’s inbox", c: hot(true)?"hot":""});
      if (drive) tr.push({a:"personal drive", b:"synced to 3 devices", c: hot(true)?"hot":""});
      if (i>=4) tr.push(H.ai ? {a:"company AI", b:"not retained", c:""} : {a:"public chatbot", b:"retained per its terms", c: hot(true)?"hot":""});
      var nodes = [{id:"leo", name:"Leo", role:"analyst", col:0, person:true, inside:true}, {id:"bi", name:"Dashboard", role:"BI tool", col:1, sys:true, inside:true, via:"leo"}];
      if (dl) nodes.push({id:"f", name:"CSV", role: n(rows || 3) + " rows", col:2, file:true, inside:true, via:"bi", hot:pii});
      if (i>=2) nodes.push(H.link ? {id:"con", name:"Consultant", role:"expiring link", col:2, row:1, person:true, inside:true, via:"f"} : {id:"con", name:"Consultant", role:"has the file", col:3, person:true, outside:true, via:"f", hot:pii});
      if (drive) nodes.push({id:"drv", name:"Drive", role:"personal", col:3, row:1, sys:true, outside:true, via:"f", hot:pii});
      if (i>=4) nodes.push(H.ai ? {id:"ai", name:"Company AI", role:"no retention", col:1, row:1, sys:true, inside:true, via:"f"} : {id:"ai", name:"Chatbot", role:"public", col:4, row:1, sys:true, outside:true, via:"drv", hot:pii});
      var c;
      switch(i){
        case 0: c = S("Oct 6 · 16:50","Leo needs one churn chart for tomorrow’s board deck","The dashboard has the chart. The export button is right there.","It’s one chart.","It’s whatever the export button gives you."); break;
        case 1: c = pii ? S("Blind spot · Exports","16:52 — the export is every row","48,210 customers: name, email, phone, plan — and a health add-on flag. A CSV escapes every control the dashboard had.","The dashboard is access-controlled.","The file isn’t.") : OK("Habit on","16:52 — the export is what the chart needs", H.agg ? "Monthly counts and rates. No person in the file." : "Internal IDs instead of names; no email, phone or health flag.","",""); break;
        case 2: c = mail ? S("Blind spot · Attachments","17:05 — emailed to a consultant", pii ? "A copy now lives in someone else’s mailbox, with its own backups and retention." : "A copy now lives in someone else’s mailbox — at least without contact details.","Email is between two people.","Email is between two companies’ servers.") : OK("Habit on","17:05 — a link, not a file","Logged, expiring in 7 days, revocable tomorrow.","",""); break;
        case 3: c = pii ? S("Blind spot · Personal cloud","19:30 — uploaded to a personal drive to finish at home","It syncs to a laptop, a tablet and a phone Northstar has never heard of.","It’s my own account.","That’s the problem: it’s not the company’s.") : OK("Habit on","19:30 — a personal drive, but no people in the file","The upload is still against policy, but what syncs to his devices identifies no one.","",""); break;
        case 4: c = bot && !pii ? OK("Habit on","21:10 — a public chatbot, but no people in the prompt","It’s still company data on someone else’s terms; it just isn’t personal data.","","") : bot ? S("Blind spot · AI input","21:10 — pasted into a public chatbot: “summarise the churn drivers”", pii ? "Prompts are records. Depending on the provider’s terms they may be retained, reviewed, or used for training." : "Prompts are records, retained on someone else’s terms.","The chatbot forgets.","Its terms decide what it forgets.") : OK("Habit on","21:10 — the company AI tool","Inputs aren’t retained or used for training.","",""); break;
        default: c = outPII ? S("Oct 9 · A deletion request arrives","J. Park asks to be deleted. Where is she?","In the CRM, the warehouse — and in " + outPII + " cop" + (outPII>1?"ies":"y") + " nobody inventoried. No system can find them; no request can reach them.","We can honour deletion.","You can honour it where you can find it.") : OK("Same evening, habits on","Every copy is accounted for","The deletion request reaches every place the data is.","","");
      }
      if (c.myth === "") { c.myth = "Leaks are breaches."; c.real = "Most leaks are ordinary work, done quickly."; }
      return { cap:c, art:{ title:"churn_candidates.csv", html:cols }, traceH:"Copies, in order", trace:tr, nodes:nodes,
        meters:[{v:outPII,l:"copies with names, contacts or health flags outside company control"},{v:pii ? rows : 0,l:"identifiable people in each copy"},{v:nodel,l:"copies no deletion request can reach"}] };
    }
  };

  /* ── 6 · Forget me — except… (partial failures, resurrection) ── */
  T.forget = { name:"Forget me, except",
    box:"WHAT THE ORCHESTRATOR TRACKS", out:"WHAT IT NEVER HEARS ABOUT", band:"bottom",
    habits:[
      { id:"verify", t:"Verify, then say done", d:"A canary re-query at T+72h. The ‘deleted’ email waits for it." },
      { id:"vendor", t:"Vendor deletes with attestation", d:"Retries until the vendor confirms; escalates to a person after three failures." },
      { id:"tomb",   t:"Tombstones, re-applied on restore", d:"Every restore replays the deletion log before the database goes live." },
      { id:"shred",  t:"Crypto-shred per person", d:"Dana’s data is encrypted with her own key. Destroy the key and every copy — backups too — is unreadable." }
    ],
    steps:[["NOV 2 10:00","Dana deletes her account"],["NOV 2 10:01","22 of 26 succeed"],["NOV 2 10:05","“Your data is deleted”"],["NOV 2 10:30","Vendor returns 500"],["NOV 14 03:00","Restore from backup"],["NOV 17 09:00","“We miss you, Dana”"]],
    label:function(k,H){ if (k===2 && H.verify) return "“Deletion in progress”"; return null; },
    world:function(i,H){
      var shred = H.shred;
      var idx = i>=1 && !shred && !(H.verify && i>=4) ? 1 : 0;                 /* search index timed out */
      var vend = i>=3 && !H.vendor && !shred ? 1 : 0;  /* dropped after 3 retries */
      var back = i>=4 && !H.tomb && !shred ? 1 : 0;    /* resurrected account */
      var copies = idx + vend + back + (i>=1 && !shred ? 1 : 0); /* +1: the Sep 18 snapshot itself */
      var lied = i>=2 && !H.verify && (idx || vend || back) ? 1 : 0;
      var days = i>=5 && back ? 15 : (i>=2 && (idx||vend) ? "not yet" : 0);
      var L = logl("10:00:00","delete_request(dana.k) · 26 systems discovered");
      if (i>=1) L += shred ? logl("10:00:02","KMS: key user/dana.k destroyed · all ciphertext unreadable") : logl("10:01:12","22 verified · 2 vendor pending · search_index TIMEOUT · 1 unknown", true);
      if (i>=2) L += H.verify ? logl("10:05:00","email: “Your deletion is in progress; we’ll confirm within 3 days.”") : logl("10:05:00","email: “Your data has been deleted.”", !!(idx||!shred));
      if (i>=3) L += H.vendor || shred ? logl("10:30:10","crm_vendor: 500 · retry 1/∞ … confirmed 14:02 · attestation stored") : logl("10:30:10","crm_vendor: 500 ×3 · retries exhausted · job marked done", true);
      if (i>=4 && H.verify && !shred) L += logl("NOV 5 10:00","canary: search_index still returns dana.k · re-run · verified");
      if (i>=4) L += H.tomb || shred ? logl("03:00:00","restore snapshot 2026-10-28 · replaying 1,902 tombstones · dana.k stays deleted") : logl("03:00:00","restore snapshot 2026-10-28 · users table live · dana.k present", true);
      if (i>=5) L += back ? logl("09:00:00","marketing: winback campaign → dana.k@…", true) : logl("09:00:00","marketing: winback campaign (dana.k not in audience)");
      var tr = [];
      tr.push({a:"primary DB", b: shred ? "unreadable" : "deleted", c:""});
      if (i>=1) tr.push({a:"search index", b: idx ? "timed out" : "deleted", c: idx?"hot":""});
      if (i>=3) tr.push({a:"CRM vendor", b: vend ? "never confirmed" : "attested", c: vend?"hot":""});
      if (i>=1) tr.push({a:"Oct 28 snapshot", b: shred ? "unreadable" : "still has Dana", c: shred?"":"hot"});
      if (i>=4) tr.push({a:"restored DB", b: back ? "Dana is back" : "tombstones applied", c: back?"hot":""});
      var nodes = [{id:"dana", name:"Dana", role:"customer", col:0, person:true}, {id:"orc", name:"Orchestrator", role:"26 systems", col:1, sys:true, inside:true, via:"dana"}];
      if (i>=1) nodes.push({id:"idx", name:"Search", role: idx ? "timed out" : "deleted", col:2, sys:true, inside:true, via:"orc", hot:!!idx});
      if (i>=3) nodes.push({id:"crm", name:"CRM vendor", role: vend ? "has her" : "attested", col:3, sys:true, inside:true, via:"orc", hot:!!vend});
      if (i>=1) nodes.push({id:"bk", name:"Snapshot", role: shred ? "unreadable" : "Oct 28", col:2, row:1, file:true, outside:true, via:"orc", hot:!shred});
      if (i>=4) nodes.push({id:"db", name:"Restored DB", role: back ? "Dana is back" : "tombstoned", col:3, row:1, sys:true, outside:true, via:"bk", hot:!!back});
      if (i>=5 && back) nodes.push({id:"mk", name:"Email", role:"“We miss you”", col:4, row:1, file:true, outside:true, via:"db", hot:true});
      var c;
      switch(i){
        case 0: c = S("Nov 2 · 10:00","Dana taps “Delete my account”","The orchestrator discovers 26 systems that hold her.","Delete is a button.","Delete is a distributed transaction."); break;
        case 1: c = shred ? OK("Habit on","One key destroyed, every copy unreadable","Dana’s data everywhere was encrypted with her key. Timeouts don’t matter: without the key, nothing can be read.","Deletion must reach every byte.","It only has to reach one key.") : S("Blind spot · Partial failures","10:01 — 22 verified, 2 pending, 1 timeout, 1 unknown","The search index timed out. The job moves on.","It mostly worked.","“Mostly deleted” means “not deleted”."); break;
        case 2: c = H.verify ? OK("Habit on","10:05 — “in progress”, not “done”","She hears the truth, and gets the confirmation only after the canary check passes.","Customers want speed.","Customers want it to be true.") : S("Blind spot · Declaring victory","10:05 — “Your data has been deleted.”","The email goes out five minutes after the request — before anyone checked.","The job returned success.","The job returned; that isn’t the same thing."); break;
        case 3: c = vend ? S("Blind spot · Retries give up","10:30 — the CRM vendor returns 500, three times","The retry budget runs out and the job is marked done. Nobody is paged.","Retries handle failures.","Retries handle the failures they don’t give up on.") : OK("Habit on","The vendor confirms at 14:02","Retries continued until an attestation came back.","",""); break;
        case 4: c = back ? S("Blind spot · Resurrection","Nov 14 — an outage, and a restore from Oct 28","The snapshot predates her deletion. Dana’s account is live again, and no one notices.","Backups are a safety net.","Backups are a time machine.") : OK("Habit on","Nov 14 — a restore that remembers", shred ? "The snapshot holds her data encrypted with a key that no longer exists." : "Tombstones replay before the database goes live. Dana stays deleted.","",""); break;
        default: c = back ? S("Nov 17 · 09:00","“We miss you, Dana.”","A win-back email goes to a person who was told she no longer exists here. That is how she finds out.","Deletion is done when the ticket closes.","Deletion is done when you can prove it — and it stays done.")
               : copies ? S("Nov 17 · Better, not finished","Dana stays deleted — except where you said she would be", (idx||vend ? "Some systems never confirmed. " : "") + "The Oct 28 snapshot still holds her until it ages out, 35 days after it was taken. Say so in the confirmation, and keep the tombstone until then.","Deleted means gone everywhere.","Deleted means gone where you can prove it, and scheduled everywhere else.")
               : OK("Same request, habits on","Dana stays forgotten","Every copy is gone or unreadable, and the email she got was true.","","");
      }
      if (c.myth === "") { c.myth = "It worked because nothing failed."; c.real = "It worked because failure was designed for."; }
      return { cap:c, art:{ title:"deletion orchestrator · dana.k", html:"<div class=\"tl-log\">" + L + "</div>" }, traceH:"Where Dana still is", trace:tr, nodes:nodes,
        meters:[{v:copies,l:"copies still holding Dana"},{v:lied,l:"promises made before they were true"},{v:days,l:"days before anyone noticed"}] };
    }
  };

  /* ── 7 · Dana's week (passwords, 2FA, passkeys, recovery) ─────── */
  T.auth = { name:"Dana’s week",
    box:"NORTHSTAR", out:"THE ATTACKER’S SIDE",
    habits:[
      { id:"passkey", t:"Sign in with a passkey", d:"No password to leak or type. The passkey is bound to northstar.com, so the device won’t offer it to a look-alike site." },
      { id:"match",   t:"Number matching on push", d:"The authenticator app asks for the number shown on the sign-in screen. If you didn’t start the sign-in, you don’t have the number." },
      { id:"recover", t:"Recovery as strong as sign-in", d:"No “text me a code” reset. Recovery needs a second passkey or a verified help-desk check." },
      { id:"nophone", t:"Security data stays security data", d:"The phone number collected for sign-in is never copied to marketing or ad audiences." }
    ],
    steps:[["OCT 12","An old breach"],["OCT 13 08:40","The password works"],["OCT 13 08:41","14 push prompts"],["OCT 14 09:02","The perfect fake"],["OCT 15 22:30","The side door"],["OCT 16 07:15","Inside her account"],["OCT 20 10:00","The number, reused"]],
    label:function(k,H){ if (k===1 && H.passkey) return "Nothing to stuff"; if (k===2 && (H.passkey||H.match)) return "Prompts can’t be approved"; if (k===3 && H.passkey) return "The fake gets nothing"; if (k===4 && H.recover) return "No side door"; return null; },
    world:function(i,H){
      var pk = H.passkey, pw = !pk;
      var stuffIn = i>=1 && pw, fatigueIn = i>=2 && pw && !H.match, phishIn = i>=3 && pw, simIn = i>=4 && !H.recover;
      var ways = (fatigueIn?1:0) + (phishIn?1:0) + (simIn?1:0), inside = i>=5 && ways > 0;
      var phone = H.recover ? 0 : 1, reuse = i>=6 && phone && !H.nophone;
      var secrets = (i>=0 && pw ? 1 : 0) + (i>=3 && pw ? 1 : 0) + (i>=4 && !H.recover ? 1 : 0);
      var art;
      if (i===0) art = "<div class=\"tl-log\">" + logl("combo_2019.txt","dana.k@…:Tulip2019!", true) + logl("","3.1 million more lines") + "</div><p class=\"tl-small\">" + (pk ? "Dana’s Northstar account has no password. This line opens nothing there." : "She reused it for her Northstar account.") + "</p>";
      else if (i===1) art = "<div class=\"tl-log\">" + (pw ? logl("08:40:11","POST /login dana.k · password OK · second factor required", true) : logl("08:40:11","POST /login dana.k · account uses passkeys · no password accepted")) + "</div>";
      else if (i===2) art = pk ? "<div class=\"tl-lock\"><b>Dana’s phone · 08:41</b><p>No prompts. A passkey sign-in starts on the device you’re holding; nobody can push one at you.</p></div>"
        : H.match ? "<div class=\"tl-lock\"><b>Authenticator · 08:41</b><p>Sign-in request · <strong>Enter the number shown on the sign-in screen</strong> [ __ ]</p><p class=\"tl-small\">Dana didn’t start a sign-in, so she has no number. She taps Deny.</p></div>"
        : "<div class=\"tl-lock\"><b>Authenticator · 08:41</b><p><span class=\"hotx\">Approve sign-in? ×14</span></p><p class=\"tl-small\">At the fourteenth, over breakfast, she taps Approve to make it stop.</p></div>";
      else if (i===3) art = pk ? "<div class=\"tl-phone\"><b>northstar-account.help</b><p>“Sign in with a passkey” → <strong>No passkeys available for this site.</strong></p><p class=\"tl-small\">The passkey belongs to northstar.com. The look-alike has nothing to ask for and nothing to relay.</p></div>"
        : "<div class=\"tl-phone\"><b>northstar-account.help</b><p>Password <span class=\"hotx\">••••••••••</span> · Authenticator code <span class=\"hotx\">482 913</span></p><p class=\"tl-small\">The page relays both to the real site within seconds and keeps the session cookie.</p></div>";
      else if (i===4) art = H.recover ? "<div class=\"tl-lock\"><b>Help desk · 22:30</b><p>“Reset needs your second passkey or a video check with ID.” The caller hangs up.</p></div>"
        : "<div class=\"tl-lock\"><b>SMS · 22:34 · to Dana’s ported number</b><p><span class=\"hotx\">Your Northstar reset code is 771 204</span></p><p class=\"tl-small\">The attacker talked the carrier into moving Dana’s number to a new SIM.</p></div>";
      else if (i===5) art = inside ? "<table class=\"tl-tbl\"><tr><th>The session can read</th><th>Includes</th></tr>" + row(["Order history","Sep 10 · 22:10"], true) + row(["Saved addresses","home, work"], true) + row(["Nova conversations","since Sep 22"], true) + row(["Northstar Pay","card ••4417"], true) + "</table><p class=\"tl-small\">Delivery address changed; two gift cards ordered.</p>" : "<p>Her account is untouched. The attacker never got a session.</p>";
      else art = reuse ? "<table class=\"tl-tbl\"><tr><th>crm_contact</th><th>phone</th><th>source</th></tr>" + row(["dana.k","+34 6…","mfa_enrolment"], true) + "</table><p class=\"tl-small\">Synced to the ad audience “high-income professionals”.</p>" : (phone ? "<p>The sign-in phone number stays in the identity system and nowhere else.</p>" : "<p>Northstar never asked for Dana’s phone number: nothing to reuse.</p>");
      var tr = [];
      tr.push(pw ? {a:"password", b:"reused · leaked", c:"hot"} : {a:"password", b:"none", c:"off"});
      if (pw) tr.push({a:"authenticator", b: H.match ? "push + number match" : "push approve/deny", c: fatigueIn ? "hot" : ""});
      if (pw) tr.push({a:"6-digit code", b:"phishable", c: phishIn ? "hot" : ""});
      if (pk) tr.push({a:"passkey", b:"bound to northstar.com", c:""});
      tr.push(H.recover ? {a:"recovery", b:"second passkey / ID check", c:""} : {a:"recovery", b:"SMS code", c: simIn ? "hot" : ""});
      var nodes = [{id:"dana", name:"Dana", role:"customer", col:0, person:true}, {id:"sso", name:"Sign-in", role: pk ? "passkeys" : "password + app", col:1, sys:true, inside:true, via:"dana", hot: ways > 0 && i>=2}];
      if (i>=5) nodes.push({id:"pay", name:"Her account", role: inside ? "open" : "untouched", col:2, sys:true, inside:true, via:"sso", hot:inside});
      if (i>=6) nodes.push({id:"crm", name:"CRM", role: reuse ? "+ ad audience" : "no phone", col:2, row:1, sys:true, inside:true, via:"sso", hot:reuse});
      if (i>=1) nodes.push(ways || (i===1 && stuffIn) ? {id:"atk", name:"Attacker", role: ways ? ways + " way" + (ways>1?"s":"") + " in" : "has the password", col:3, person:true, outside:true, via:"sso", hot:true} : {id:"atk", name:"Attacker", role:"no way in", col:3, person:true, outside:true, via:"sso", blocked:"refused"});
      nodes.push({id:"combo", name:"Old leak", role: pw ? "has her password" : "useless here", col:4, file:true, outside:true, via: i>=1 ? "atk" : null, hot:pw});
      if (i>=3) nodes.push({id:"fake", name:"Fake page", role: phishIn ? "relayed a code" : "got nothing", col:3, row:1, sys:true, outside:true, via:"atk", hot:phishIn});
      if (i>=4) nodes.push({id:"sim", name:"Carrier", role: simIn ? "ported her SIM" : "not useful", col:4, row:1, sys:true, outside:true, via:"atk", hot:simIn});
      var c;
      switch(i){
        case 0: c = pk ? OK("Habit on","Oct 12 — a 2019 breach, and nothing to reuse","A shopping site Dana used in 2019 leaks its passwords. Her Northstar account has no password, so the leaked one opens nothing here.","A strong password protects me.","A password is only as strong as the weakest site that stored it.")
                       : S("Oct 12 · An old breach","A 2019 shopping-site breach puts Dana’s password in a combo list","She reused it for her Northstar account. Nobody at Northstar knows; the list circulates for years.","My password is strong.","A strong password reused is a shared password."); break;
        case 1: c = pw ? S("Blind spot · Credential stuffing","08:40 — a bot tries the list. Dana’s password works.","Only the second factor stands between the attacker and her account now. That’s what 2FA is for — until the next three doors.","2FA means I’m safe.","2FA means the password alone is no longer enough. Which second factor matters.")
                       : OK("Habit on","08:40 — the bot finds no password field for Dana","Passkey accounts don’t accept a password, so there is nothing to stuff.","",""); break;
        case 2: c = pk ? OK("Habit on","08:41 — no prompts to spam","A passkey sign-in starts on the device in your hand; nobody can push an approval at you.","","")
                 : H.match ? OK("Habit on","08:41 — the prompt asks for a number Dana doesn’t have","Number matching turns “Approve?” into a question only the person at the sign-in screen can answer.","Push is convenient and safe.","Push is safe when approving needs something the attacker has and the phone owner doesn’t.")
                 : S("Blind spot · Push fatigue","08:41 — fourteen “Approve sign-in?” prompts","At breakfast, Dana taps Approve to make them stop. The attacker is in.","I’d never approve a prompt I didn’t start.","Most people approve the fourteenth."); break;
        case 3: c = pk ? OK("Habit on","Oct 14 — a perfect fake, and nothing to steal","The passkey only works on northstar.com. The look-alike page can’t ask for it, and there’s no code to relay.","Careful people spot fakes.","Passkeys don’t need anyone to spot anything.")
                 : S("Blind spot · Real-time phishing","Oct 14 — a pixel-perfect Northstar sign-in page takes her password and 6-digit code", H.match ? "Number matching doesn’t help here: Dana is signing in on purpose, on the fake, which shows her the real number." : "Authenticator codes last about 30 seconds — long enough for the page to relay them to the real site and keep the session.","A code from an authenticator app can’t be phished.","Anything you can type into a page can be typed into the wrong page."); break;
        case 4: c = simIn ? S("Blind spot · Weakest recovery path", "Oct 15 — the attacker ports Dana’s number and resets by SMS", pk ? "Her passkey can’t be phished, but “Forgot your sign-in? Text me a code” goes around it." : "The carrier moved her number to the attacker’s SIM. The reset code arrives there.","My account has strong sign-in.","Your account is as strong as its easiest recovery.")
                 : OK("Habit on","Oct 15 — the side door is locked","Recovery needs a second passkey or an ID check. A ported phone number opens nothing.","Recovery must be easy.","Recovery must be as hard to fake as sign-in."); break;
        case 5: c = inside ? S("Oct 16 · Inside","Her orders, addresses, assistant chats and wallet","The attacker changes the delivery address and orders gift cards. " + ways + " door" + (ways>1?"s were":" was") + " open; the attacker needed one.","It’s only a shopping account.","A shopping account holds a purchase she has told no one about.")
                 : OK("Same week, habits on","Her account is untouched","Every door the attacker tried was closed, and Dana did nothing heroic.","",""); break;
        default: c = reuse ? S("Blind spot · Purpose drift","Oct 20 — the sign-in phone number turns up in marketing","A CRM sync copies “verified phone” from the identity system into ad audiences. Security data became targeting data.","We only collected it for security.","Collected for security and used for ads is still used for ads.")
                 : OK(phone ? "Habit on" : "No phone collected","Oct 20 — the number stays where it was given", phone ? "The identity system’s phone field isn’t in any sync to marketing." : "Passkeys and strong recovery never needed Dana’s phone number.","","");
      }
      if (c.myth === "") { c.myth = "Security and privacy are different teams."; c.real = "A sign-in method decides both what can be stolen and what gets collected."; }
      return { cap:c, art:{ title: ["combo list","login log","Dana’s phone","the look-alike page","recovery","her account","crm_contacts"][i], html:art }, traceH:"Dana’s sign-in factors", trace:tr, nodes:nodes,
        meters:[{v:ways,l:"ways in that worked"},{v:secrets,l:"secrets an attacker could steal or replay"},{v:inside ? 4 : 0,l:"kinds of Dana’s data the attacker could read"},{v:reuse ? 3 : phone,l:"places Dana’s phone number is kept"}] };
    }
  };


  /* ── 8 · One sentence to Nova (AI assistant, RAG, provider, memory, agent) ── */
  T.nova = { name:"One sentence to Nova",
    box:"NORTHSTAR", out:"OUTSIDE NORTHSTAR",
    habits:[
      { id:"redact", t:"Strip identity before the provider", d:"Names, emails and order IDs are removed before the prompt leaves for the model API. The question itself has to go — it is what Nova must answer." },
      { id:"logs",   t:"Logs live 30 days; no training without opt-in", d:"Conversation logs expire after 30 days and never enter a training set unless Dana opted in." },
      { id:"memory", t:"Memory asks first", d:"Nova offers “Remember that you’re pregnant?” and saves nothing sensitive without a yes. Every memory is visible and deletable." },
      { id:"agent",  t:"Purchases wait for her confirmation", d:"The reorder tool can prepare a basket. Paying needs Dana to confirm the item and the price." }
    ],
    steps:[["SEP 22 21:04","Dana asks Nova"],["21:04:01","Retrieval"],["21:04:02","The model provider"],["21:04:03","The logs"],["21:04:05","Memory"],["21:05","“Reorder my vitamins”"],["OCT 1","A training run"],["NOV 2","She deletes her account"]],
    label:function(k,H){ if (k===4 && H.memory) return "Nova asks first"; if (k===5 && H.agent) return "Basket waits for her"; if (k===6 && H.logs) return "Not in training"; return null; },
    world:function(i,H){
      var sent = i>=2, logged = i>=3, mem = i>=4 && !H.memory, act = i>=5 && !H.agent, trained = i>=6 && !H.logs, del = i>=7;
      var provNow = sent && !del;                         /* the provider's 30-day abuse window ends Oct 22 */
      var logsNow = logged && !(del && H.logs);           /* 30-day logs have expired by Nov 2; 400-day logs have not — and the deletion job never reaches them */
      var memNow = mem && !del;                           /* memory rows are deleted with the account */
      var places = (provNow ? 1 : 0) + (logsNow ? 1 : 0) + (memNow ? 1 : 0) + (trained ? 1 : 0);
      var readers = logged && !H.logs ? 64 : 0;
      var unreach = (logged && !H.logs ? 1 : 0) + (trained ? 1 : 0);
      var acts = act ? 1 : 0;
      var art;
      if (i===0) art = "<div class=\"tl-phone\"><b>Storefront app · Nova</b><p>“I’m 7 weeks pregnant and getting migraines. Which painkillers are safe? Also, reorder my prenatal vitamins.”</p></div>";
      else if (i===1) art = "<div class=\"tl-log\">" + logl("21:04:01","retrieve(user=dana.k, q=“painkillers pregnancy”)") + logl("","→ 3 help articles (vector store)") + logl("","→ orders: prenatal vitamins (Aug 28), pregnancy test (Sep 10)", true) + "</div><p class=\"tl-small\">Retrieval pastes what it finds into the prompt, every time.</p>";
      else if (i===2) art = "<div class=\"tl-log\">" + logl("POST","lumen-model-api /v1/chat") + (H.redact ? logl("user","[customer]") + logl("text","“I’m 7 weeks pregnant and getting migraines…”") + logl("context","[order: prenatal vitamins] [order: pregnancy test]") : logl("user","Dana K. · dana.k@example.com", true) + logl("text","“I’m 7 weeks pregnant and getting migraines…”", true) + logl("context","order #81723 · prenatal vitamins · pregnancy test", true)) + "</div><p class=\"tl-small\">Provider terms: no training; kept 30 days for abuse monitoring.</p>";
      else if (i===3) art = "<div class=\"tl-log\">" + (H.logs ? logl("log","user: u_5e1b · prompt + answer · expires Oct 22") + logl("","purposes: [service_delivery]") : logl("log","user: dana.k · prompt + answer · kept 400 days", true) + logl("","purposes: [service_delivery, model_training]", true) + logl("","sampled for quality review by 64 staff", true)) + "</div>";
      else if (i===4) art = mem ? "<div class=\"tl-lock\"><b>Nova memory · saved silently</b><p><span class=\"hotx\">Dana is pregnant (due around May). Gets migraines.</span></p></div>" : "<div class=\"tl-lock\"><b>Nova</b><p>“Want me to remember that you’re pregnant, for future answers?”</p><p class=\"tl-small\">Dana taps Not now. Nothing is saved.</p></div>";
      else if (i===5) art = act ? "<div class=\"tl-log\">" + logl("tool","checkout.place_order(sku=PRN-VIT-120, qty=1, pay=card ••4417)", true) + logl("","✓ paid · $41.90 · the 120-count pack she never buys", true) + "</div>" : "<div class=\"tl-lock\"><b>Nova · basket prepared</b><p>Prenatal vitamins, 60 count · $24.00 · <strong>Confirm?</strong></p><p class=\"tl-small\">Dana confirms. The tool could prepare; only she could pay.</p></div>";
      else if (i===6) art = "<div class=\"tl-log\">" + (trained ? logl("train","nova-ft-2026-10 · 2.1M logged conversations", true) + logl("","includes dana.k · Sep 22", true) : logl("train","nova-ft-2026-10 · opted-in conversations only") + logl("","dana.k not included")) + "</div>";
      else art = "<div class=\"tl-log\">" + logl("NOV 2","delete_account(dana.k)") + logl("profile","deleted") + logl("memory", mem ? "deleted" : "nothing saved") + logl("prompt logs", H.logs ? "expired Oct 22" : "not wired to deletion · still held", !H.logs) + logl("provider","30-day window ended Oct 22 (per contract)") + logl("model weights", trained ? "cannot be deleted · next retrain will exclude her" : "never trained on her", trained) + "</div>";
      var tr = [{a:"Nova request", b:"in memory, seconds", c:""}];
      if (sent) tr.push({a:"model provider", b: del ? "window ended" : (H.redact ? "text, no identity" : "text + identity"), c: provNow && !H.redact ? "hot" : ""});
      if (logged) tr.push({a:"prompt logs", b: H.logs ? "30 days" : "400 days", c: logsNow && !H.logs ? "hot" : ""});
      if (i>=4) tr.push({a:"memory", b: mem ? (del ? "deleted" : "“is pregnant”") : "nothing saved", c: memNow ? "hot" : ""});
      if (i>=6) tr.push({a:"model weights", b: trained ? "trained on it" : "not trained", c: trained ? "hot" : ""});
      var nodes = [{id:"dana", name:"Dana", role:"customer", col:0, person:true}, {id:"nova", name:"Nova", role:"assistant", col:1, sys:true, inside:true, via:"dana"}];
      if (i>=1) nodes.push({id:"vec", name:"Retrieval", role:"orders + articles", col:1, row:1, sys:true, inside:true, via:"nova"});
      if (logged) nodes.push({id:"log", name:"Logs", role: H.logs ? "30 days" : "400 days", col:2, sys:true, inside:true, via:"nova", hot: logsNow && !H.logs, gone: del && H.logs});
      if (i>=4) nodes.push(mem ? {id:"mem", name:"Memory", role:"“is pregnant”", col:2, row:1, sys:true, inside:true, via:"nova", hot: memNow, gone: del} : {id:"mem", name:"Memory", role:"asked first", col:2, row:1, sys:true, inside:true, via:"nova", blocked:"not saved"});
      if (i>=5) nodes.push(act ? {id:"chk", name:"Checkout", role:"paid", col:3, row:1, sys:true, inside:true, via:"mem", hot:true} : {id:"chk", name:"Checkout", role:"waits for Dana", col:3, row:1, sys:true, inside:true, via:"mem"});
      if (i>=6) nodes.push(trained ? {id:"ft", name:"Fine-tune", role:"weights", col:3, sys:true, inside:true, via:"log", hot:true} : {id:"ft", name:"Fine-tune", role:"opt-in only", col:3, sys:true, inside:true, via:"log", blocked:"excluded"});
      if (sent) nodes.push({id:"llm", name:"Provider", role: del ? "expired" : (H.redact ? "no identity" : "30-day window"), col:4, sys:true, outside:true, via:"nova", hot: provNow && !H.redact, gone: del});
      var c;
      switch(i){
        case 0: c = S("Sep 22 · 21:04","Dana asks Nova something she hasn’t told anyone","Seven weeks pregnant, migraines, which painkillers are safe — and could it reorder her vitamins. One sentence. Watch it become several records.","It’s a private chat.","It is a request that several systems will keep, each on its own clock."); break;
        case 1: c = S("How it works · Retrieval","21:04:01 — Nova fetches her orders to personalise the answer","Retrieval-augmented generation pastes documents and records into the prompt at answer time. The model doesn’t “know” her orders; it is shown them, every time. So access control belongs at retrieval, per user.","The model has learned about her.","The model is being handed her data, request by request."); break;
        case 2: c = H.redact ? OK("Habit on","21:04:02 — the question leaves; her identity doesn’t","The provider needs the question to answer it. It doesn’t need her name, email or order numbers, so those are stripped first. Redaction is measured, not assumed: Northstar’s redactor catches about 97% of identifiers on its test set.","Redaction makes it anonymous.","It removes who asked. The question is still sensitive, and still leaves.") : S("Blind spot · Third-party model","21:04:02 — the prompt, her name and her orders go to the model provider","The provider’s terms promise no training. They also keep prompts 30 days for abuse monitoring — a copy outside Northstar that no deletion request reaches until it expires.","“Zero retention” means zero.","Read the terms: retention windows, reviewers, subprocessors."); break;
        case 3: c = H.logs ? OK("Habit on","21:04:03 — logged for 30 days, for service only","Logs exist to debug and to handle abuse reports. After 30 days they’re gone, and they never feed training without an opt-in.","We need everything to improve the model.","You need consented examples, not everyone’s worst questions.") : S("Blind spot · Conversation logs","21:04:03 — logged for 400 days, tagged for training, read by reviewers","The model doesn’t remember the conversation. The logs do: 400 days, a model-training purpose added on Sep 12, and a quality-review sample read by 64 people.","The AI remembers everything.","The model remembers little; the logs remember everything they were told to."); break;
        case 4: c = mem ? S("Blind spot · Memory","21:04:05 — a memory row: “Dana is pregnant”","Memory is a database row saved for future conversations — not a change to the model. Saved silently, it turns one question into a standing fact about her.","Memory is inside the model.","Memory is a row. It can be shown, edited and deleted — if you build that.") : OK("Habit on","21:04:05 — Nova asks before remembering","Dana says not now. A sensitive fact is saved only on a yes, and she can see and delete every memory.","Asking is friction.","Asking is the feature."); break;
        case 5: c = act ? S("Blind spot · Agent actions","21:05 — the agent orders and pays","“Reorder my vitamins” becomes checkout.place_order with her saved card — the wrong pack size, charged instantly. An agent acts with whatever permissions it was given.","The assistant only does what I asked.","It does what its tools allow, as it understood you.") : OK("Habit on","21:05 — a basket, waiting for her","The tool prepares the order. Paying needs Dana to confirm the item and the price: a human approval boundary around an irreversible action.","Confirmation slows agents down.","Confirmation is where the person stays in charge."); break;
        case 6: c = trained ? S("Blind spot · Training data","Oct 1 — a fine-tuning run includes her conversation","Her words now shape model weights. Some training text can be memorised and extracted; most isn’t. Nobody can list which.","It’s diluted among millions.","Dilution is not deletion, and memorisation is measured, not assumed.") : OK("Habit on","Oct 1 — trained on opted-in conversations only","Her conversation was never eligible, so there is nothing to unlearn.","","") ; break;
        default: c = unreach ? S("Nov 2 · The deletion","Dana deletes her account. Two copies don’t hear it.", (logged && !H.logs ? "The 400-day prompt logs aren’t wired to the deletion orchestrator. " : "") + (trained ? "The fine-tuned weights can’t be edited to remove her; the honest promise is that the next model is retrained without her. " : "") + "The provider’s copy expired on Oct 22 — if the contract was honoured.","Delete my account deletes my data.","It deletes what the deletion path reaches — and a trained model is not on that path.")
                     : OK("Same evening, habits on","Nov 2 — her deletion reaches everything that holds her","Logs expired, memory never saved, no training use, the provider’s window long closed. The confirmation email can be true.","","");
      }
      if (c.myth === "") { c.myth = "AI privacy is a model problem."; c.real = "It is mostly an ordinary data problem: logs, copies, retention and permissions."; }
      return { cap:c, art:{ title: ["Nova chat","retrieval log","provider request","conversation log","memory","agent tool call","training manifest","deletion receipts"][i], html:art }, traceH:"Where Dana’s sentence lives", trace:tr, nodes:nodes,
        meters:[{v:places,l:"places her sentence is stored now"},{v:readers,l:"people who may read it in review"},{v:unreach,l:"copies her deletion can’t reach"},{v:acts,l:"actions taken without her confirmation"}] };
    }
  };

  /* ── static fallback: the same world(), written out as a sequence ── */
  function staticHTML(id){
    var tr = T[id]; if (!tr) return "";
    var all = {}; tr.habits.forEach(function(h){ all[h.id] = true; });
    var N = tr.steps.length, s = "<ol class=\"tl-seq\">";
    tr.steps.forEach(function(st, k){
      var c = tr.world(k, {}).cap;
      s += "<li><span class=\"tl-seq-when\">" + esc(st[0]) + "</span><b>" + esc(c.title) + "</b> " + esc(c.body) + (c.real ? " <em>" + esc(c.real) + "</em>" : "") + "</li>";
    });
    s += "</ol>";
    var base = tr.world(N - 1, {}).meters, fixed = tr.world(N - 1, all).meters;
    s += "<table class=\"st-t tl-seq-m\"><caption>Where it ends — as it usually goes, and with every habit on</caption><thead><tr><th scope=\"col\">Counter</th><th scope=\"col\">As it usually goes</th><th scope=\"col\">With the habits</th></tr></thead><tbody>";
    base.forEach(function(m, j){ s += "<tr><th scope=\"row\">" + esc(m.l) + "</th><td>" + esc(n(m.v)) + "</td><td>" + esc(n(fixed[j].v)) + "</td></tr>"; });
    s += "</tbody></table><p class=\"tl-seq-h\"><b>The habits:</b> " + tr.habits.map(function(h){ return "<span><b>" + esc(h.t) + ".</b> " + h.d + "</span>"; }).join(" ") + "</p>";
    return s;
  }
  T._static = staticHTML;
  root.EA_TRAILS = T;
  if (!hasDom) return;

  /* ── engine ─────────────────────────────────────────────────── */
  function map(tr, w){
    var nodes = w.nodes, two = nodes.some(function(p){ return p.row; });
    var W = 700, H = two ? 262 : 186, X = function(p){ return 72 + p.col * 138; }, Y = function(p){ return p.row ? 188 : 94; };
    var s = "<" + "svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Who holds it: " + esc(nodes.map(function(p){ return p.name + " (" + p.role + ")"; }).join(", ")) + "\">";
    var ins = nodes.filter(function(p){ return p.inside && !p.blocked; }), outs = nodes.filter(function(p){ return p.outside; });
    if (outs.length && tr.band === "bottom") { s += "<rect x=\"6\" y=\"150\" width=\"" + (W - 12) + "\" height=\"" + (H - 158) + "\" rx=\"16\" fill=\"#fbe8de\" opacity=\".55\"/><text x=\"20\" y=\"170\" font-family=\"JetBrains Mono,monospace\" font-size=\"10\" fill=\"#b23a0a\" letter-spacing=\"1\">" + esc(tr.out) + "</text>"; }
    else if (outs.length) { var ox = Math.min.apply(null, outs.map(X)) - 60; s += "<rect x=\"" + ox + "\" y=\"8\" width=\"" + (W - ox - 6) + "\" height=\"" + (H - 16) + "\" rx=\"16\" fill=\"#fbe8de\" opacity=\".55\"/><text x=\"" + (W - 16) + "\" y=\"24\" text-anchor=\"end\" font-family=\"JetBrains Mono,monospace\" font-size=\"10\" fill=\"#b23a0a\" letter-spacing=\"1\">" + esc(tr.out) + "</text>"; }
    if (ins.length) { var a = Math.min.apply(null, ins.map(X)) - 52, b = Math.max.apply(null, ins.map(X)) + 52, rows = ins.some(function(p){ return p.row; }); s += "<rect x=\"" + a + "\" y=\"32\" width=\"" + (b - a) + "\" height=\"" + (tr.band === "bottom" ? 114 : rows ? H - 44 : H - 50) + "\" rx=\"16\" fill=\"none\" stroke=\"#9aa0a8\" stroke-dasharray=\"5 5\"/><text x=\"" + (a + 10) + "\" y=\"26\" font-family=\"JetBrains Mono,monospace\" font-size=\"10\" fill=\"#63666c\" letter-spacing=\"1\">" + esc(tr.box) + "</text>"; }
    var by = {}; nodes.forEach(function(p){ by[p.id] = p; });
    nodes.forEach(function(p){ if (!p.via || !by[p.via]) return; var f = by[p.via], x1 = X(f), y1 = Y(f), x2 = X(p), y2 = Y(p);
      var col = p.blocked ? "#1d5bd8" : p.hot ? "#b23a0a" : "#9aa0a8";
      var lift = 34 + 30 * Math.max(0, Math.abs(p.col - f.col) - 1);
      var d = y1 === y2 ? "M" + (x1 + 32) + "," + (y1 - (lift > 34 ? 20 : 0)) + " C" + (x1 + 70) + "," + (y1 - lift) + " " + (x2 - 70) + "," + (y2 - lift) + " " + (x2 - 32) + "," + (y2 - (lift > 34 ? 20 : 0)) : "M" + x1 + "," + (y1 + 32) + " C" + x1 + "," + (y1 + 70) + " " + x2 + "," + (y2 - 70) + " " + x2 + "," + (y2 - 32);
      s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + col + "\" stroke-width=\"2\"" + (p.blocked ? " stroke-dasharray=\"4 5\"" : "") + "/>";
      if (p.blocked) s += "<text x=\"" + ((x1 + x2) / 2) + "\" y=\"" + (Math.min(y1, y2) - 30) + "\" text-anchor=\"middle\" font-size=\"12\" fill=\"#1d5bd8\">&#10005; " + esc(p.blocked) + "</text>"; });
    nodes.forEach(function(p){
      var x = X(p), y = Y(p), st = p.blocked ? "#1d5bd8" : p.hot ? "#b23a0a" : "#63666c", fl = p.blocked ? "#e3ebfb" : p.hot ? "#fbe8de" : "#f4f0e7";
      s += "<g opacity=\"" + (p.gone ? .38 : 1) + "\">";
      if (p.file) s += "<path d=\"M" + (x - 24) + "," + (y - 30) + " h34 l14,14 v46 h-48 z\" fill=\"" + fl + "\" stroke=\"" + st + "\" stroke-width=\"2\"/>";
      else if (p.sys) s += "<rect x=\"" + (x - 40) + "\" y=\"" + (y - 26) + "\" width=\"80\" height=\"52\" rx=\"10\" fill=\"" + fl + "\" stroke=\"" + st + "\" stroke-width=\"2\"/>";
      else s += "<circle cx=\"" + x + "\" cy=\"" + y + "\" r=\"30\" fill=\"" + fl + "\" stroke=\"" + st + "\" stroke-width=\"2\"" + (p.blocked ? " stroke-dasharray=\"4 4\"" : "") + "/>";
      s += "<text x=\"" + x + "\" y=\"" + (y + 4) + "\" text-anchor=\"middle\" font-size=\"12\" font-weight=\"700\" fill=\"#121315\">" + esc(p.name) + "</text>";
      s += "<text x=\"" + x + "\" y=\"" + (y + (p.sys || p.file ? 46 : 48)) + "\" text-anchor=\"middle\" font-size=\"11\" fill=\"" + (p.hot ? "#b23a0a" : "#4a4d53") + "\">" + esc(p.role) + "</text>";
      if (p.note && !p.gone) s += "<text x=\"" + x + "\" y=\"" + (y - 38) + "\" text-anchor=\"middle\" font-family=\"JetBrains Mono,monospace\" font-size=\"9.5\" fill=\"#b23a0a\">" + esc(p.note) + "</text>";
      s += "</g>"; });
    return s + "</" + "svg>";
  }
  function mount(root){
    var id = root.getAttribute("data-trail"), tr = T[id]; if (!tr) return;
    var H = {}, step = 0, timer = null, N = tr.steps.length;
    tr.habits.forEach(function(h){ H[h.id] = false; });
    root.innerHTML =
      "<div class=\"tl-ctl\"><div class=\"tl-nav\"><button type=\"button\" class=\"btn\" data-a=\"prev\">&larr; Back</button><button type=\"button\" class=\"btn btn--solid\" data-a=\"next\">Next &rarr;</button><button type=\"button\" class=\"btn\" data-a=\"play\">&#9654; Play the trail</button></div><span class=\"tl-tag\" data-r=\"mode\"></span></div>" +
      "<div class=\"tl-rail\" role=\"tablist\" aria-label=\"" + esc(tr.name) + ", moment by moment\" style=\"--n:" + N + "\"><span class=\"tl-fill\" aria-hidden=\"true\"></span></div>" +
      "<div class=\"tl-stage\" role=\"tabpanel\" id=\"tlp-" + id + "\" aria-label=\"" + esc(tr.name) + ": the selected moment\"><div class=\"tl-cap\" data-r=\"cap\"></div>" +
      "<div class=\"tl-doc\"><div class=\"tl-doc-bar\"><span class=\"dots\" aria-hidden=\"true\"><i></i><i></i><i></i></span><span data-r=\"atitle\"></span></div><div class=\"tl-doc-body\" data-r=\"art\"></div><div class=\"tl-hist\"><div class=\"tl-hist-h\"><span data-r=\"th\"></span></div><div class=\"tl-film\" data-r=\"trace\"></div></div></div>" +
      "<div class=\"tl-people\" tabindex=\"0\" role=\"region\" aria-label=\"" + esc(tr.name) + ": who holds it\" data-r=\"map\"></div>" +
      "<div class=\"tl-meters\" data-r=\"meters\"></div>" +
      "<div class=\"tl-rules\"><h4>Replay it with the habits that would have prevented it</h4><div class=\"tl-rgrid\" style=\"--h:" + Math.min(tr.habits.length, 4) + "\">" + tr.habits.map(function(h){ return "<button type=\"button\" class=\"tl-rule\" role=\"switch\" aria-checked=\"false\" data-h=\"" + h.id + "\"><span class=\"sw\" aria-hidden=\"true\"></span><span><b>" + h.t + "</b><span>" + h.d + "</span></span></button>"; }).join("") + "</div></div></div>";
    var q = function(k){ return root.querySelector("[data-r=\"" + k + "\"]"); }, rail = root.querySelector(".tl-rail"), fill = root.querySelector(".tl-fill");
    tr.steps.forEach(function(s, k){ var b = document.createElement("button"); b.type = "button"; b.className = "tl-stop"; b.setAttribute("role","tab"); b.setAttribute("aria-controls", "tlp-" + id); b.innerHTML = "<i>" + (k+1) + "</i><b>" + s[0] + "</b><span></span>"; b.addEventListener("click", function(){ stop(); go(k); }); rail.appendChild(b); });
    function any(){ for (var k in H) if (H[k]) return true; return false; }
    var last = null, registered = false;
    function go(i){
      step = Math.max(0, Math.min(N - 1, i));
      var w = tr.world(step, H), c = w.cap;
      last = w;
      rail.querySelectorAll(".tl-stop").forEach(function(b, k){ var l = tr.label(k, H); b.querySelector("span").textContent = l || tr.steps[k][1]; b.setAttribute("aria-selected", String(k === step)); b.setAttribute("aria-label", (k+1) + " of " + N + ", " + tr.steps[k][0] + ": " + (l || tr.steps[k][1])); b.classList.toggle("done", k < step); b.classList.toggle("safe", any()); b.tabIndex = k === step ? 0 : -1; });
      fill.style.width = "calc((100% - 100% / var(--n)) * " + (step / (N - 1)) + ")"; fill.style.background = any() ? "var(--coolc)" : "";
      q("cap").innerHTML = "<span class=\"tl-tag" + (c.safe ? " safe" : "") + "\">" + esc(c.tag) + "</span><div>" + (/\d/.test(c.tag) ? "" : "<p class=\"tl-when\">" + esc(tr.steps[step][0]) + "</p>") + "<h3>" + esc(c.title) + "</h3><p>" + esc(c.body) + "</p><div class=\"tl-myth\"><div><b>What it feels like</b>" + esc(c.myth) + "</div><div class=\"real" + (c.safe ? " safe" : "") + "\"><b>What is true</b>" + esc(c.real) + "</div></div></div>";
      q("atitle").textContent = w.art.title; q("art").innerHTML = w.art.html; q("th").textContent = w.traceH;
      q("trace").innerHTML = w.trace.map(function(v){ return "<span class=\"tl-v " + (v.c || "") + "\">" + esc(v.a) + "<br>" + esc(v.b) + "</span>"; }).join("");
      q("map").innerHTML = map(tr, w);
      var M = q("meters"); M.style.setProperty("--m", w.meters.length);
      var base = any() ? tr.world(step, {}).meters : null;
      M.innerHTML = w.meters.map(function(m, j){ var z = m.v === 0 || m.v === "—" || m.v === "minutes", was = base && String(base[j].v) !== String(m.v) ? "<div class=\"was\">without the habits: <b>" + esc(n(base[j].v)) + "</b></div>" : ""; return "<div class=\"tl-m\"><div class=\"n " + (z ? "zero" : "hot") + "\">" + esc(n(m.v)) + "</div><div class=\"l\">" + esc(m.l) + "</div>" + was + "</div>"; }).join("");
      var on = tr.habits.filter(function(h){ return H[h.id]; }).map(function(h){ return h.t.toLowerCase(); });
      var md = q("mode"); md.textContent = on.length ? "Replaying with: " + on.join(" · ") : "As it usually goes"; md.className = "tl-tag" + (on.length ? " safe" : "");
      root.querySelector("[data-a=prev]").disabled = step === 0; root.querySelector("[data-a=next]").disabled = step === N - 1;
      if (registered) window.EA.changed("trail-" + id);
    }
    function stop(){ if (timer) { clearInterval(timer); timer = null; root.querySelector("[data-a=play]").innerHTML = "&#9654; Play the trail"; } }
    root.querySelector("[data-a=prev]").addEventListener("click", function(){ stop(); go(step - 1); });
    root.querySelector("[data-a=next]").addEventListener("click", function(){ stop(); go(step + 1); });
    root.querySelector("[data-a=play]").addEventListener("click", function(){ if (timer) { stop(); return; } if (RM) { go(N - 1); return; } go(0); this.innerHTML = "&#10074;&#10074; Pause"; timer = setInterval(function(){ if (step >= N - 1) { stop(); return; } go(step + 1); }, 3400); });
    rail.addEventListener("keydown", function(e){
      var k = e.key === "ArrowRight" ? step + 1 : e.key === "ArrowLeft" ? step - 1 : e.key === "Home" ? 0 : e.key === "End" ? N - 1 : null;
      if (k === null) return;
      e.preventDefault(); stop(); go(k); rail.querySelectorAll(".tl-stop")[step].focus();
    });
    root.querySelectorAll(".tl-rule").forEach(function(b){ b.addEventListener("click", function(){ var k = b.getAttribute("data-h"); H[k] = !H[k]; b.setAttribute("aria-checked", String(H[k])); go(step); }); });
    go(0);
    /* state: "<step>.<habit bits>", e.g. "3.1010" */
    var E = window.EA;
    if (E && E.fig) {
      E.fig("trail-" + id, {
        get: function(){ return step + "." + tr.habits.map(function(h){ return H[h.id] ? 1 : 0; }).join(""); },
        set: function(s){ var p = String(s).split("."), bits = p[1] || ""; tr.habits.forEach(function(h, j){ H[h.id] = bits.charAt(j) === "1"; }); root.querySelectorAll(".tl-rule").forEach(function(b){ b.setAttribute("aria-checked", String(!!H[b.getAttribute("data-h")])); }); stop(); go(parseInt(p[0], 10) || 0); },
        reset: function(){ stop(); tr.habits.forEach(function(h){ H[h.id] = false; }); root.querySelectorAll(".tl-rule").forEach(function(b){ b.setAttribute("aria-checked", "false"); }); go(0); },
        read: function(){
          var c = last.cap, on = tr.habits.filter(function(h){ return H[h.id]; }).map(function(h){ return h.t; });
          return "<b>Moment " + (step + 1) + " of " + N + " · " + esc(tr.steps[step][0]) + ".</b> " + esc(c.title) + ". " + esc(c.real || "") + " <span class=\"fig-read-m\">" + last.meters.map(function(m){ return esc(n(m.v)) + " " + esc(m.l); }).join(" · ") + ".</span>" + (on.length ? " Habits on: " + esc(on.join(", ")) + "." : "");
        }
      });
      registered = true;
    }
  }
  document.querySelectorAll(".tl[data-trail]").forEach(mount);
  /* trails.js loads last: every figure has mounted, so a deep link can now scroll. */
  if (window.EA && window.EA.ready) window.EA.ready();
})(typeof window !== "undefined" ? window : globalThis);
