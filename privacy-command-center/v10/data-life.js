/* Northstar — CONNECTED LIFE (synthetic).
 *
 * Northstar Home is Northstar's smart-home product: a Matter hub, an app, a
 * door lock and a video doorbell of its own, professional alarm monitoring
 * through a partner, Routines, and Nova Home — the assistant, now able to
 * operate devices. This file does two things.
 *
 *   1. It adds Northstar Home to the organisation the rest of the Command
 *      Center already describes: a business unit, teams, a product, features,
 *      systems, datasets, flows, two partners, controls and their tests,
 *      findings, a risk, two promises and the decisions they owe. From then on
 *      the knowledge graph, promises, decisions, reports and search treat it
 *      like any other product.
 *
 *   2. NS.life — ONE fictional household, the places its people move through,
 *      and the enlarged privacy graph:
 *        Person → Household → Place → Device → Sensor → Account → Network →
 *        Cloud → Integration → Vendor → Inference → Automation → Physical action
 *      The Connected Life pages in the Command Center and the essay's chapter
 *      “The house is a data system” read these same records
 *      (articles/every-arrow/northstar.js is generated from them).
 *
 * Rules this file keeps:
 *   - Everyone here is invented. Dana is the essay's Dana; her household is new.
 *   - Real consumer platforms (a voice assistant, a phone maker's home app, a
 *     thermostat ecosystem) appear ONLY as the ecosystems of devices the
 *     household owns, by generic description. None is a Northstar vendor or
 *     system, and no record claims anything about how a real company processes
 *     data. Where the essay names a platform it cites that platform's own
 *     documentation.
 *   - Northstar's partners here (Keystone Monitoring, CodeHand) are fictional.
 *   - Unknown is a value: null means nobody at Northstar can answer, which the
 *     pages show as a finding.
 */
(function () {
'use strict';
var NS = window.NS;
function add(list, items) { if (list) items.forEach(function (x) { list.push(x); }); }

/* ═══════════════ 1 · Northstar Home joins the organisation ═══════════════ */
add(NS.bus, [{ id: 'bu_home', name: 'Home & Devices', lead: 'T. Nakamura' }]);
add(NS.teams, [
  { id: 't_home',   name: 'Home Platform', bu: 'bu_home', oncall: '#home-platform' },
  { id: 't_access', name: 'Home Access',   bu: 'bu_home', oncall: '#home-access' }
]);
add(NS.products, [{ id: 'p_home', name: 'Northstar Home', bu: 'bu_home', team: 't_home', users: 3100000 }]);
add(NS.features, [
  { id: 'f_hub',       name: 'Home hub & Matter bridge',          product: 'p_home', status: 'live' },
  { id: 'f_access',    name: 'Door access & guest codes',         product: 'p_home', status: 'live' },
  { id: 'f_doorbell',  name: 'Video doorbell & familiar faces',   product: 'p_home', status: 'live' },
  { id: 'f_presence',  name: 'Presence & geofencing',             product: 'p_home', status: 'live' },
  { id: 'f_routines',  name: 'Routines',                          product: 'p_home', status: 'live' },
  { id: 'f_novahome',  name: 'Nova Home (assistant that operates devices)', product: 'p_home', status: 'beta' },
  { id: 'f_monitor',   name: 'Professional alarm monitoring',     product: 'p_home', status: 'live' }
]);
add(NS.systems, [
  { id: 's_hubcloud',  name: 'Home Hub Cloud',               kind: 'service', team: 't_home',   region: 'us-east', product: 'p_home', feature: 'f_hub' },
  { id: 's_hubbackup', name: 'Hub configuration backups',     kind: 'store',   team: 't_home',   region: 'us-east', product: 'p_home', parent: 's_hubcloud' },
  { id: 's_access',    name: 'Access Service (locks & codes)', kind: 'service', team: 't_access', region: 'us-east', product: 'p_home', feature: 'f_access' },
  { id: 's_accesslog', name: 'Access event log',              kind: 'store',   team: 't_access', region: 'us-east', product: 'p_home', parent: 's_access' },
  { id: 's_video',     name: 'Doorbell video store',          kind: 'store',   team: 't_access', region: 'us-east', product: 'p_home', feature: 'f_doorbell' },
  { id: 's_faces',     name: 'Familiar-faces index',          kind: 'store',   team: 't_access', region: 'us-east', product: 'p_home', parent: 's_video' },
  { id: 's_presence',  name: 'Presence Service',              kind: 'service', team: 't_home',   region: 'us-east', product: 'p_home', feature: 'f_presence' },
  { id: 's_routines',  name: 'Routine Engine',                kind: 'service', team: 't_home',   region: 'us-east', product: 'p_home', feature: 'f_routines' },
  { id: 's_energy',    name: 'Energy readings store',         kind: 'store',   team: 't_home',   region: 'us-east', product: 'p_home', parent: 's_hubcloud' },
  { id: 's_novahome',  name: 'Nova Home agent',               kind: 'service', team: 't_nova',   region: 'us-west', product: 'p_home', feature: 'f_novahome' }
]);
/* Endpoints that live in the household, not in a data centre. app.js registers them. */
NS.endpoints = (NS.endpoints || []).concat([
  { id: 'n_hub',    name: 'Home hub (in the household)',      kind: 'device' },
  { id: 'n_lock',   name: 'Front-door lock (on the door)',    kind: 'device' },
  { id: 'n_bell',   name: 'Video doorbell (on the porch)',    kind: 'device' },
  { id: 'n_fabric', name: 'Other Matter controllers in the home (the household’s choice)', kind: 'device' }
]);
add(NS.datasets, [
  { id: 'd_accesslog', name: 'access_events', system: 's_accesslog', product: 'p_home', owner: 't_access', kind: 'table',
    why: 'Show a household who opened its door, and settle disputes about access.',
    subjects: 'Residents, and everyone they give a code to', people: 7400000, purposes: ['service_delivery', 'account_security'],
    fields: [['household_id', 2, 'id'], ['code_holder', 3, 'id'], ['method', 1, 'attr'], ['door', 1, 'attr'], ['ts', 2, 'qid'], ['outcome', 1, 'attr']],
    retention: { required: 90, actual: 730, ttl: false }, age: 730, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 64, accessServices: 5, deletion: 'household deletion job', deletionVerified: false, lastAudit: '2026-04-02', consent: 'account owner only (code holders are never asked)' },
  { id: 'd_clips', name: 'doorbell_clips', system: 's_video', product: 'p_home', owner: 't_access', kind: 'object store',
    why: 'Let a household see who came to the door.',
    subjects: 'Residents, visitors, couriers, neighbours and passers-by', people: 9800000, purposes: ['service_delivery'],
    fields: [['household_id', 2, 'id'], ['video', 3, 'attr'], ['audio', 3, 'attr'], ['ts', 2, 'qid'], ['motion_zone', 1, 'attr']],
    retention: { required: 30, actual: 60, ttl: true }, age: 60, regions: ['us-east'], encryption: 'AES-256 at rest · end-to-end optional (off by default)', keyOwner: 'Platform KMS',
    accessPeople: 38, accessServices: 3, deletion: 'per-clip delete + household deletion', deletionVerified: true, lastAudit: '2026-08-19', consent: 'account owner; bystanders none' },
  { id: 'd_faces', name: 'familiar_faces', system: 's_faces', product: 'p_home', owner: 't_access', kind: 'vector index',
    why: 'Announce known visitors by name.',
    subjects: 'Anyone whose face the doorbell sees more than twice', people: 2100000, purposes: ['service_delivery'],
    fields: [['household_id', 2, 'id'], ['face_template', 4, 'id'], ['label', 3, 'attr'], ['first_seen', 2, 'qid']],
    retention: { required: 30, actual: 180, ttl: false }, age: 180, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 9, accessServices: 2, deletion: 'label delete (templates of unlabelled faces kept)', deletionVerified: false, lastAudit: null, consent: 'account owner opt-in; the people in the index are never asked' },
  { id: 'd_presence', name: 'presence_events', system: 's_presence', product: 'p_home', owner: 't_home', kind: 'table',
    why: 'Run routines when someone arrives or leaves.',
    subjects: 'Household members with location on', people: 5200000, purposes: ['service_delivery'],
    fields: [['household_id', 2, 'id'], ['member_id', 2, 'id'], ['device_id', 2, 'id'], ['event', 2, 'attr'], ['ts', 2, 'qid'], ['home_geofence', 3, 'qid']],
    retention: { required: 30, actual: 400, ttl: false }, age: 400, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 41, accessServices: 6, deletion: 'household deletion job', deletionVerified: false, lastAudit: '2026-05-11', consent: 'OS location permission (Always)' },
  { id: 'd_routinelog', name: 'routine_runs', system: 's_routines', product: 'p_home', owner: 't_home', kind: 'table',
    why: 'Show what a routine did and why.',
    subjects: 'Households using Routines', people: 3100000, purposes: ['service_delivery', 'account_security'],
    fields: [['household_id', 2, 'id'], ['routine_id', 1, 'attr'], ['trigger', 2, 'attr'], ['actions', 2, 'attr'], ['ts', 2, 'qid']],
    retention: { required: 90, actual: 90, ttl: true }, age: 90, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 22, accessServices: 2, deletion: 'TTL', deletionVerified: true, lastAudit: '2026-09-02', consent: 'n/a (service)' },
  { id: 'd_hubbackup', name: 'hub_config_backups', system: 's_hubbackup', product: 'p_home', owner: 't_home', kind: 'snapshot',
    why: 'Restore a household’s hub after a hardware swap.',
    subjects: 'Households, their members, and every code holder', people: 3100000, purposes: ['service_delivery'],
    fields: [['household_id', 2, 'id'], ['members', 3, 'id'], ['lock_codes', 4, 'attr'], ['presence_groups', 2, 'attr'], ['fabrics', 2, 'attr']],
    retention: { required: 30, actual: 365, ttl: false }, age: 365, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 6, accessServices: 1, deletion: 'snapshot expiry (tombstones not re-applied)', deletionVerified: false, lastAudit: null, consent: 'n/a (service)' },
  { id: 'd_energy', name: 'energy_readings', system: 's_energy', product: 'p_home', owner: 't_home', kind: 'time series',
    why: 'Show households what uses power.',
    subjects: 'Households with an energy monitor', people: 900000, purposes: ['service_delivery', 'analytics'],
    fields: [['household_id', 2, 'id'], ['circuit', 1, 'attr'], ['watts_1min', 2, 'qid'], ['ts', 2, 'qid']],
    retention: { required: 395, actual: 395, ttl: true }, age: 395, regions: ['us-east'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 30, accessServices: 3, deletion: 'household deletion job', deletionVerified: true, lastAudit: '2026-07-21', consent: 'account owner' }
]);
add(NS.vendors, [
  { id: 'v_keystone', name: 'Keystone Monitoring', role: 'Professional alarm monitoring and installer network', region: 'us', declared: true,
    data: ['alarm_events', 'arming_state', 'alarm_clip', 'address', 'emergency_contacts'], identifiers: ['i_customer'], tier: 3, people: 420000, frequency: 'event',
    retention: { contract: 365, actual: null }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2024-05-01', expires: '2027-05-01', dpa: true },
    deletionApi: false, securityReview: '2026-02-11', privacyReview: '2025-08-20', consentDep: null, optOutPropagates: false, attestation: null, lastAudit: null, purpose: 'service_delivery' },
  { id: 'v_codehand', name: 'CodeHand', role: 'Scheduling for cleaning and home-services agencies', region: 'us', declared: true,
    data: ['address', 'lock_code_schedule', 'job_times', 'worker_name'], identifiers: ['i_customer'], tier: 3, people: 38000, frequency: 'api',
    retention: { contract: 30, actual: null }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2025-10-14', expires: '2026-10-14', dpa: true },
    deletionApi: true, securityReview: '2025-09-30', privacyReview: null, consentDep: null, optOutPropagates: false, attestation: null, lastAudit: null, purpose: 'service_delivery' }
]);
add(NS.flows, [
  { id: 'flh1', from: 'n_hub', to: 's_hubcloud', fields: ['device_states', 'events', 'member_ids'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: 'see datasets', owner: 't_home', recipient: 'Northstar', control: 'c_tls', status: 'reviewed', deletion: 'household deletion job' },
  { id: 'flh2', from: 'n_lock', to: 's_access', fields: ['code_holder', 'method', 'ts', 'outcome'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'account owner', enc: 'Thread + TLS 1.3 via hub', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: '730 d', owner: 't_access', recipient: 'Access Service', control: 'c_code_expiry', status: 'reviewed', deletion: 'household deletion job' },
  { id: 'flh3', from: 'n_app', to: 's_presence', fields: ['member_id', 'device_id', 'enter/exit', 'ts'], identifier: 'i_device', tier: 3, purpose: 'service_delivery', consent: 'OS location permission', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: '400 d', owner: 't_home', recipient: 'Presence Service', control: 'c_presence_ttl', status: 'reviewed', deletion: 'household deletion job' },
  { id: 'flh4', from: 'n_app', to: 'v_geogrid', fields: ['home_geofence enter/exit', 'maid'], identifier: 'i_maid', tier: 3, purpose: 'unknown', consent: 'OS location permission only', enc: 'TLS', boundary: 'third_party', regionFrom: 'user', regionTo: 'unknown', retention: 'unknown', owner: null, recipient: 'GeoGrid SDK', control: null, status: 'unknown', deletion: 'unknown', flags: ['undeclared'] },
  { id: 'flh5', from: 's_presence', to: 's_routines', fields: ['member_id', 'enter/exit', 'ts'], identifier: 'i_customer', tier: 2, purpose: 'service_delivery', consent: 'n/a', enc: 'mTLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'retry queue 45 min', owner: 't_home', recipient: 'Routine Engine', control: null, status: 'unreviewed', deletion: 'n/a' },
  { id: 'flh6', from: 's_routines', to: 'n_hub', fields: ['command: disarm / unlock / announce'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'us-east', regionTo: 'user', retention: 'none (transit)', owner: 't_home', recipient: 'Home hub', control: 'c_physical_confirm', status: 'reviewed', deletion: 'n/a' },
  { id: 'flh7', from: 'n_bell', to: 's_video', fields: ['video', 'audio', 'ts'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'account owner; bystanders none', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: '60 d', owner: 't_access', recipient: 'Doorbell video store', control: 'c_privacy_zone', status: 'reviewed', deletion: 'per-clip delete' },
  { id: 'flh8', from: 's_video', to: 's_faces', fields: ['face_template', 'first_seen'], identifier: null, tier: 4, purpose: 'service_delivery', consent: 'owner opt-in; the person seen: none', enc: 'mTLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '180 d', owner: 't_access', recipient: 'Familiar-faces index', control: 'c_face_consent', status: 'unreviewed', deletion: 'label delete only' },
  { id: 'flh9', from: 'v_codehand', to: 's_access', fields: ['create/revoke code', 'unlock'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'account owner (OAuth)', enc: 'TLS 1.3', boundary: 'third_party', regionFrom: 'us', regionTo: 'us-east', retention: '30 d (contract)', owner: 't_access', recipient: 'Access Service', control: 'c_code_expiry', status: 'reviewed', deletion: 'API', flags: ['scope: lock.operate'] },
  { id: 'flh10', from: 'n_hub', to: 'v_keystone', fields: ['alarm_events', 'arming_state', 'alarm_clip'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'account owner', enc: 'TLS 1.2', boundary: 'third_party', regionFrom: 'user', regionTo: 'us', retention: '365 d (contract)', owner: 't_home', recipient: 'Keystone Monitoring', control: 'c_installer_expiry', status: 'reviewed', deletion: 'none (no API)' },
  { id: 'flh11', from: 's_hubcloud', to: 's_hubbackup', fields: ['members', 'lock_codes', 'presence_groups', 'fabrics'], identifier: 'i_customer', tier: 4, purpose: 'service_delivery', consent: 'n/a', enc: 'AES-256', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '365 d', owner: 't_home', recipient: 'Hub configuration backups', control: 'c_backup_reapply', status: 'reviewed', deletion: 'snapshot expiry' },
  { id: 'flh12', from: 's_novahome', to: 'n_hub', fields: ['tool call: lock / lights / thermostat / window', 'memory'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'account owner', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'us-west', regionTo: 'user', retention: 'memory: unknown', owner: 't_nova', recipient: 'Home hub', control: 'c_physical_confirm', status: 'unreviewed', deletion: 'unknown' },
  { id: 'flh13', from: 'n_hub', to: 'n_fabric', fields: ['lock state', 'occupancy', 'thermostat mode', 'commands'], identifier: null, tier: 3, purpose: 'service_delivery', consent: 'whichever adult added the ecosystem', enc: 'Matter (CASE sessions)', boundary: 'trust', regionFrom: 'user', regionTo: 'user', retention: 'outside Northstar — unknown', owner: 't_home', recipient: 'Other ecosystems on the Matter fabric', control: 'c_fabric_review', status: 'reviewed', deletion: 'remove the fabric from the device' },
  { id: 'flh14', from: 'n_hub', to: 's_energy', fields: ['circuit', 'watts_1min'], identifier: 'i_customer', tier: 2, purpose: 'service_delivery', consent: 'account owner', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: '395 d', owner: 't_home', recipient: 'Energy readings store', control: 'c_retention_scan', status: 'reviewed', deletion: 'household deletion job' }
]);
add(NS.controls, [
  { id: 'c_code_expiry', name: 'Guest and contractor codes expire', domain: 'Access', level: 1, health: 'failing', owner: 't_access', scope: 'lock codes', evidence: 'Expiry is optional in the app; 61% of guest codes have none', statement: 'Codes for non-residents should carry an end date.' },
  { id: 'c_physical_confirm', name: 'Step-up confirmation for physical actions', domain: 'Access', level: 3, health: 'failing', owner: 't_access', scope: 'app unlock only', evidence: 'App unlock asks for the phone passcode; routines, voice and integrations skip it', statement: 'Unlock, open, disarm and start need a fresh, strong confirmation.' },
  { id: 'c_fabric_review', name: 'Fabric and member review', domain: 'Access', level: 0, health: 'unknown', owner: 't_home', scope: 'all hubs', evidence: 'Help-centre article “Who can control your home?”', statement: 'Households are advised to review linked ecosystems.' },
  { id: 'c_presence_ttl', name: 'Presence history expires after 30 days', domain: 'Retention', level: 0, health: 'failing', owner: 't_home', scope: 'presence_events', evidence: 'Retention standard RS-7 (no job)', statement: 'Presence events are deleted after 30 days.' },
  { id: 'c_privacy_zone', name: 'Doorbell privacy zones and bystander masking', domain: 'Collection', level: 2, health: 'failing', owner: 't_access', scope: 'doorbells', evidence: 'Setting exists; off by default; set up in 8% of homes', statement: 'Mask the street and neighbouring property.' },
  { id: 'c_face_consent', name: 'No face template without the person’s own enrolment', domain: 'Biometrics', level: 0, health: 'unknown', owner: 't_access', scope: 'familiar faces', evidence: 'Design principle in the feature brief', statement: 'Only people who enrol themselves are recognised.' },
  { id: 'c_installer_expiry', name: 'Installer and partner access expires', domain: 'Access', level: 1, health: 'failing', owner: 't_home', scope: 'installer and dealer roles', evidence: 'Installer role has no end date', statement: 'Installer access ends 14 days after installation.' }
]);
add(NS.findings, [
  { id: 'PRV-0301', sev: 'HIGH', title: 'A former resident can still see and operate the front door through another ecosystem',
    kind: 'STALE ACCESS + PHYSICAL ACTION', linddun: ['Linking', 'Detecting', 'Unawareness'], harms: ['Physical safety', 'Surveillance', 'Exposure'],
    detector: 'Fabric census: locks with more than one Matter fabric whose other household still lists a removed member', people: 41000,
    entities: ['p_home', 'f_hub', 'n_hub', 'n_fabric', 'flh13', 's_access', 'c_fabric_review'],
    human: 'Someone who moved out — sometimes someone the household is now afraid of — can see whether the door is locked and whether anyone is home.',
    mitigations: ['Show every fabric on the lock and who can use it', 'Prompt to review fabrics when a member is removed', 'Grant other fabrics View, not Operate, by default', 'One-tap “remove every other controller”'],
    owner: 't_home', due: '2026-10-08', enforcement: 0, status: 'open', opened: '2026-09-18' },
  { id: 'PRV-0302', sev: 'HIGH', title: 'Welcome-home routine replays stale presence and disarms the alarm',
    kind: 'AUTOMATION PRIVILEGE + FAILURE MODE', linddun: ['Non-compliance'], harms: ['Physical safety', 'Exposure'],
    detector: 'Routine audit: disarm actions fired more than 10 minutes after the triggering presence event', people: 64000,
    entities: ['f_routines', 's_routines', 's_presence', 'flh5', 'flh6', 'd_routinelog', 'c_physical_confirm'],
    human: 'A house can disarm itself and unlock its garage door 40 minutes after the resident drove past, while nobody is home.',
    mitigations: ['Drop presence events older than 2 minutes for security actions', 'Require two signals (phone + hub Bluetooth) to disarm', 'Log the identity and its confidence with every run', 'Never unlock from a routine without a confirmation'],
    owner: 't_home', due: '2026-10-03', enforcement: 3, status: 'open', opened: '2026-09-20' },
  { id: 'PRV-0303', sev: 'HIGH', title: 'Contractor and guest codes never expire',
    kind: 'STALE ACCESS', linddun: ['Non-compliance'], harms: ['Physical safety'],
    detector: 'Code census: non-resident codes older than 30 days with no end date', people: 910000,
    entities: ['f_access', 's_access', 'd_accesslog', 'v_codehand', 'c_code_expiry'],
    human: 'A plumber’s code from March still opens the door in September.',
    mitigations: ['End date required for any non-resident code', 'Codes tied to a schedule by default', 'Monthly “codes still valid” digest to the household'],
    owner: 't_access', due: '2026-10-10', enforcement: 1, status: 'open', opened: '2026-09-11' },
  { id: 'PRV-0304', sev: 'MEDIUM', title: 'Door history kept two years reconstructs residents’ movements',
    kind: 'RETENTION VIOLATION', linddun: ['Detecting', 'Data disclosure'], harms: ['Surveillance', 'Exposure'],
    detector: 'Retention scan: access_events oldest row 730 days against a 90-day need', people: 7400000,
    entities: ['d_accesslog', 's_accesslog', 'c_retention_scan'],
    human: 'Two years of who came and went, to the minute — a schedule of each person’s life, readable by anyone who breaks into the account.',
    mitigations: ['90-day TTL', 'Aggregate older history to counts', 'Per-person view limited to the person and admins'],
    owner: 't_access', due: '2026-10-24', enforcement: 0, status: 'open', opened: '2026-09-09' },
  { id: 'PRV-0305', sev: 'HIGH', title: 'Home arrivals and departures sent to an advertising location SDK',
    kind: 'PURPOSE DRIFT + UNDECLARED EGRESS', linddun: ['Linking', 'Identifying', 'Data disclosure'], harms: ['Surveillance', 'Secondary use', 'Linkability'],
    detector: 'Mobile traffic capture: GeoGrid host called on every home geofence event', people: 5200000,
    entities: ['p_home', 'flh4', 'v_geogrid', 'i_maid', 's_presence', 'c_sdk_inventory'],
    human: 'The moments a house becomes empty leave Northstar attached to an advertising ID.',
    mitigations: ['Remove GeoGrid from the Home app', 'Geofence on device only', 'SDK manifest gate'],
    owner: 't_home', due: '2026-10-01', enforcement: 2, status: 'open', opened: '2026-09-24' },
  { id: 'PRV-0306', sev: 'MEDIUM', title: 'Face templates made of people who never enrolled',
    kind: 'BIOMETRIC + BYSTANDER', linddun: ['Identifying', 'Unawareness'], harms: ['Surveillance', 'Biometric exposure'],
    detector: 'Index census: templates with no label older than 30 days', people: 2100000,
    entities: ['f_doorbell', 's_faces', 'd_faces', 'flh8', 'c_face_consent'],
    human: 'The courier, the neighbour and the babysitter are in a face index they have never heard of — and a face cannot be changed like a password.',
    mitigations: ['Only enrolled faces kept', 'Discard unlabelled templates within 24 h', 'On-device matching'],
    owner: 't_access', due: '2026-10-21', enforcement: 0, status: 'open', opened: '2026-09-15' },
  { id: 'PRV-0307', sev: 'HIGH', title: 'Cleaning-agency integration can unlock doors, not just manage codes',
    kind: 'EXCESSIVE SCOPE', linddun: ['Non-compliance'], harms: ['Physical safety'],
    detector: 'OAuth scope audit: partner tokens holding lock.operate', people: 38000,
    entities: ['v_codehand', 'flh9', 's_access', 'c_code_expiry'],
    human: 'An agency’s system — or anyone who steals its token — can open a client’s door remotely.',
    mitigations: ['Split scopes: codes.manage without lock.operate', 'Token bound to job windows', 'Household sees every partner action'],
    owner: 't_access', due: '2026-10-06', enforcement: 1, status: 'open', opened: '2026-09-22' },
  { id: 'PRV-0308', sev: 'HIGH', title: 'Hub restore brings back deleted codes and removed members',
    kind: 'DELETION RESURRECTION', linddun: ['Non-compliance'], harms: ['Physical safety', 'Exposure'],
    detector: 'Restore drill: deleted canary code present after restore', people: 3100000,
    entities: ['s_hubbackup', 'd_hubbackup', 'flh11', 'c_backup_reapply'],
    human: 'The code a household deleted in March works again after a hub replacement in October.',
    mitigations: ['Tombstones for codes, members and devices', 'Re-apply tombstones on every restore', 'Restore drill with canary codes'],
    owner: 't_home', due: '2026-10-05', enforcement: 3, status: 'open', opened: '2026-09-21' },
  { id: 'PRV-0309', sev: 'MEDIUM', title: 'Nova Home unlocks on a recognised voice',
    kind: 'WEAK IDENTITY + PHYSICAL ACTION', linddun: ['Non-compliance'], harms: ['Physical safety'],
    detector: 'Agent tool audit: lock.unlock callable without a PIN when voice match succeeds', people: 120000,
    entities: ['f_novahome', 's_novahome', 'flh12', 'c_physical_confirm'],
    human: 'A voice that sounds like a resident’s — a relative, a recording — can open the door.',
    mitigations: ['Voice never authorises unlock; ask for a PIN or a phone confirmation', 'Unlock is not an agent tool at all'],
    owner: 't_nova', due: '2026-10-15', enforcement: 3, status: 'open', opened: '2026-09-17' },
  { id: 'PRV-0310', sev: 'MEDIUM', title: 'Installer access to alarm accounts never expires',
    kind: 'STALE ACCESS', linddun: ['Non-compliance'], harms: ['Physical safety', 'Exposure'],
    detector: 'Access review: installer roles older than 14 days', people: 420000,
    entities: ['v_keystone', 'flh10', 'c_installer_expiry'],
    human: 'The company that fitted the alarm three years ago can still disarm it.',
    mitigations: ['Installer role expires after 14 days', 'Household approves each later session'],
    owner: 't_home', due: '2026-10-19', enforcement: 1, status: 'open', opened: '2026-09-12' },
  { id: 'PRV-0311', sev: 'MEDIUM', title: 'Calendar titles announced in shared rooms',
    kind: 'CONTEXT COLLAPSE', linddun: ['Data disclosure', 'Unawareness'], harms: ['Context collapse', 'Sensitive inference'],
    detector: 'Routine audit: announce actions reading calendar titles on shared speakers', people: 260000,
    entities: ['f_routines', 's_routines', 'c_physical_confirm'],
    human: 'A private appointment is read aloud to whoever is in the kitchen — a child, a guest, the babysitter.',
    mitigations: ['Announce “you have an appointment at 4”, never the title', 'Personal content only on the owner’s own device'],
    owner: 't_home', due: '2026-10-28', enforcement: 0, status: 'open', opened: '2026-09-19' }
]);
add(NS.risks, [
  { id: 'R-10', name: 'Door access and presence', asset: 'd_accesslog', findings: ['PRV-0301', 'PRV-0302', 'PRV-0303', 'PRV-0308'],
    f: { sens: 4, people: 3, ident: 4, link: 4, ret: 4, access: 3, third: 3, novel: 5, geo: 1, ctrl: 2, del: 1, verify: 1 },
    why: ['controls a physical door', 'reveals when a home is empty', 'codes never expire', 'other ecosystems can operate the lock', 'restores bring back deleted access', 'two years of movements retained'],
    mitigating: [['codes logged', true], ['app unlock needs a passcode', true], ['code expiry', false], ['identity confidence on routines', false], ['fabric review', false], ['tombstones on restore', false]] }
]);
add(NS.promises, [
  { id: 'PR-DOOR', text: 'Only the people you allow can open your door — and you can always see who did.',
    where: 'Northstar Home app › Access', audience: 'Northstar Home households, and everyone they give a code to',
    features: ['f_access', 'f_routines', 'f_hub', 'f_novahome'], purposes: ['service_delivery', 'account_security'], datasets: ['d_accesslog', 'd_hubbackup'],
    controls: ['c_code_expiry', 'c_physical_confirm', 'c_fabric_review', 'c_backup_reapply', 'c_installer_expiry'],
    findings: ['PRV-0301', 'PRV-0302', 'PRV-0303', 'PRV-0307', 'PRV-0308', 'PRV-0309', 'PRV-0310'],
    risk: 'R-10', decision: 'D-110', owner: 't_access' },
  { id: 'PR-HOMEDATA', text: 'What your home senses is used to run your home. It is never used for advertising.',
    where: 'Northstar Home onboarding, screen 3', audience: 'Everyone in a Northstar Home — residents, guests and visitors',
    features: ['f_presence', 'f_doorbell', 'f_routines'], purposes: ['service_delivery'], datasets: ['d_presence', 'd_faces', 'd_clips', 'd_energy'],
    controls: ['c_presence_ttl', 'c_face_consent', 'c_privacy_zone', 'c_sdk_inventory'],
    findings: ['PRV-0305', 'PRV-0306', 'PRV-0304', 'PRV-0311'],
    risk: null, decision: 'D-111', owner: 't_home' }
]);
add(NS.decisions, [
  { id: 'D-110', promise: 'PR-DOOR', risk: 'R-10', findings: ['PRV-0301', 'PRV-0302', 'PRV-0303', 'PRV-0308'],
    question: 'Make every software path that can open a door prove who is asking, expire, and stay deleted?',
    owner: 't_access', approver: 'CISO', status: 'owed', opened: '2026-09-22',
    consequence: 'A routine, a stale code, a former resident or a restored backup can open a family’s front door without anyone deciding it should.',
    options: [
      { id: 'A', title: 'Physical-action gate: fresh confirmation for unlock, open, disarm and start', privacy: 'Closes routine, voice and partner paths at once', product: 'One extra tap on arrival; “Welcome home” can no longer unlock by itself', cost: 'about 3 engineer-weeks',
        pros: ['One control for every path', 'Measurable: every physical action logs its identity'], cons: ['Arrival feels slower', 'Does not fix codes or restores'], tradeoff: 'A second of friction traded for no unattended unlock.' },
      { id: 'B', title: 'Expiring access: codes, installers and other fabrics expire unless renewed', privacy: 'Stale access ends by default', product: 'Households renew long-term guests', cost: 'about 2 engineer-weeks',
        pros: ['Fixes the most common failure', 'No change for residents'], cons: ['Renewal nags', 'Leaves routine and voice paths'], tradeoff: 'Occasional renewals traded for no forgotten keys.' },
      { id: 'C', title: 'Tombstones everywhere: deletes survive restore, sync and re-pairing', privacy: 'Removed people stay removed', product: 'None visible', cost: 'about one quarter',
        pros: ['Fixes resurrection for every object type'], cons: ['Longest', 'Needs a restore drill'], tradeoff: 'A quarter of work for deletes that hold.' }
    ],
    recommend: 'A', recommendText: 'A now for the paths that open doors; B this quarter; C before the next hub hardware swap.',
    dissent: 'Home Platform says the arrival tap will cut Routine use; the drop has not been measured.',
    uncertainty: 'What other ecosystems on the fabric keep, and who in those households can operate the lock, is outside Northstar’s view.',
    test: { text: 'Every unlock, open and disarm in 14 days carries an identity and a fresh confirmation; a restore drill with a deleted canary code shows the code absent.', control: 'c_physical_confirm' },
    testResult: 'fail', final: null },
  { id: 'D-111', promise: 'PR-HOMEDATA', risk: null, findings: ['PRV-0305', 'PRV-0306', 'PRV-0304'],
    question: 'Stop home presence leaving through the location SDK, and stop keeping faces and door history we don’t need?',
    owner: 't_home', approver: 'CPO', status: 'owed', opened: '2026-09-24',
    consequence: 'When a house is empty, whose face is at the door and who came home when are held longer and more widely than running a home needs.',
    options: [
      { id: 'A', title: 'Remove the SDK and enforce 30-day presence and 90-day door history', privacy: 'Ends the advertising path and most history', product: 'Activity feed shows 90 days, not two years', cost: 'about 2 engineer-weeks',
        pros: ['Fast', 'Closes three findings'], cons: ['Some households use old history for disputes'], tradeoff: 'Long history traded for not holding a schedule of every life.' },
      { id: 'B', title: 'Familiar faces for enrolled people only, matched on the doorbell', privacy: 'No bystander templates at all', product: 'Only people who enrol are named', cost: 'about 6 engineer-weeks',
        pros: ['Removes a biometric data class from the cloud'], cons: ['Fewer names announced'], tradeoff: 'Convenience traded for not recognising strangers.' },
      { id: 'C', title: 'Keep the data; add consent screens', privacy: 'Little: bystanders still cannot consent', product: 'More prompts', cost: 'about 1 engineer-week',
        pros: ['Cheapest'], cons: ['The people most affected never see the screen'], tradeoff: 'Paperwork instead of design.' }
    ],
    recommend: 'A', recommendText: 'A this sprint; B next quarter; not C.',
    dissent: 'Growth says door history drives engagement; not measured.', uncertainty: 'GeoGrid’s own retention of home events is unknown.',
    test: { text: 'No GeoGrid calls from the Home app for 14 days; presence oldest row ≤ 30 days; no unlabelled face template older than 24 h.', control: 'c_presence_ttl' },
    testResult: 'fail', final: null }
]);
if (NS.controlTests) {
  var T = {
    c_code_expiry:      ['2026-09-20', 'fail', 'Weekly code census', 'Census 2026-09-20: 61% of guest codes without an end date', '2026-09-27', []],
    c_physical_confirm: ['2026-09-23', 'fail', 'Audit of physical actions by path', 'Routines, voice and partner API unlock without confirmation', '2026-09-30', ['app unlock passes']],
    c_fabric_review:    [null, 'never', 'None — a help-centre article', 'Help article HA-212', null, []],
    c_presence_ttl:     [null, 'never', 'None — retention standard only', 'RS-7', null, []],
    c_privacy_zone:     ['2026-09-10', 'fail', 'Share of doorbells with a privacy zone', '8% of doorbells', '2026-10-10', []],
    c_face_consent:     [null, 'never', 'None — design principle', 'Feature brief FB-19', null, []],
    c_installer_expiry: ['2026-09-12', 'fail', 'Quarterly access review', 'Installer roles with no end date: all', '2026-12-12', []]
  };
  Object.keys(T).forEach(function (k) { var t = T[k]; NS.controlTests[k] = { last: t[0], result: t[1], method: t[2], evidence: t[3], next: t[4], exceptions: t[5] }; });
}
add(NS.drift, [
  { t: '2026-09-22T11:05', type: 'new scope', text: 'CodeHand’s integration token now includes lock.operate.', before: 'scopes: codes.manage', after: 'scopes: codes.manage, lock.operate', entities: ['v_codehand', 'PRV-0307'], sev: 'HIGH' },
  { t: '2026-09-20T08:30', type: 'config change', text: 'Presence retry window raised from 5 to 45 minutes.', before: 'retry: 5 min', after: 'retry: 45 min', entities: ['s_presence', 'PRV-0302'], sev: 'HIGH' }
]);
if (NS.indicators) NS.indicators.physical = { target: 0, dir: 'down', owner: 't_access', history: [9, 9, 10, 10, 11, 12, 12], coverage: { v: 0.7, of: 'physical-action paths inventoried (other ecosystems excluded)' } };

/* ═══════════════ 2 · The household, and the enlarged graph ═══════════════ */
var L = NS.life = {};

/* The enlarged model: every arrow in a connected life passes through some of these. */
L.chain = [
  ['person', 'Person', 'Who acts, and who is observed — often not the same person.'],
  ['household', 'Household', 'The group an account believes lives together.'],
  ['place', 'Place', 'A home, a car, a library, a hotel room.'],
  ['device', 'Device', 'What was bought, and by whom.'],
  ['sensor', 'Sensor', 'What the device can perceive: a microphone, a camera, motion, a radio.'],
  ['account', 'Account', 'Whose name the device is registered to.'],
  ['network', 'Network', 'What carries it, and who runs that.'],
  ['cloud', 'Cloud', 'Where it is processed and kept, if not on the device.'],
  ['integration', 'Integration', 'Another company’s system the household connected.'],
  ['vendor', 'Vendor', 'Whoever the company sends it on to.'],
  ['inference', 'Inference', 'What becomes knowable once it has moved.'],
  ['automation', 'Automation', 'A small program that acts on it.'],
  ['action', 'Physical action', 'A door, a lock, an alarm, a car, a call.']
];

/* The fourteen questions every arrow must answer. */
L.questions = [
  ['init', 'Who initiated it?'], ['about', 'Who is the data about?'], ['consent', 'Did that person consent, or only the device owner?'],
  ['raw', 'What raw data moves?'], ['infer', 'What can be inferred after it moves?'], ['where', 'Is processing local, cloud-based or both?'],
  ['join', 'Which identity joins it to a person or household?'], ['cross', 'Which boundaries does it cross?'],
  ['phys', 'Can it trigger a physical action?'], ['read', 'Who can read or replay its history?'], ['keep', 'How long does it remain?'],
  ['revoke', 'How is access revoked?'], ['fail', 'What happens during an outage, retry or partial failure?'], ['proof', 'What evidence proves the control worked?']
];
L.boundaries = [['room', 'Room'], ['household', 'Household'], ['network', 'Network'], ['company', 'Company'], ['jurisdiction', 'Jurisdiction']];

/* Roles are relationships to a device or an account, not properties of a person.
 * One person can hold several; the person observed is often not the one who agreed. */
L.roles = [
  ['owner', 'Device owner', 'Bought it; accepted its terms.'],
  ['admin', 'Administrator', 'Can add people, change settings and read history.'],
  ['subject', 'Data subject', 'The person the data is about.'],
  ['member', 'Household member', 'Lives there, in the account’s eyes.'],
  ['guest', 'Guest', 'Invited in; never asked by the device.'],
  ['bystander', 'Bystander', 'In range; not invited, not asked.'],
  ['installer', 'Installer', 'Set it up; may still have access.'],
  ['operator', 'Vendor operator', 'Works for a company that can see or act on it.']
];

L.places = [
  { id: 'pl_alder',   name: '14 Alder Lane',          kind: 'home',      note: 'Dana, Theo and, on weekdays, Mira.' },
  { id: 'pl_flat',    name: 'Ruth’s flat, Harbour Court', kind: 'home',  note: 'Theo’s mother lives alone; Grace, a care worker, visits on weekdays.' },
  { id: 'pl_car',     name: 'Theo’s car',             kind: 'vehicle',   note: 'Bought second-hand in 2024; phone-as-key.' },
  { id: 'pl_rental',  name: 'A rental car',           kind: 'vehicle',   note: 'Dana, for a work trip in October.' },
  { id: 'pl_office',  name: 'Dana’s office',          kind: 'work',      note: 'Managed network; managed laptop.' },
  { id: 'pl_library', name: 'Eastside Library',       kind: 'public',    note: 'Public Wi-Fi and public computers.' },
  { id: 'pl_hotel',   name: 'Harbor Hotel',           kind: 'public',    note: 'Captive portal; a TV you can cast to.' },
  { id: 'pl_cafe',    name: 'Airport café',           kind: 'public',    note: 'Open Wi-Fi with a common name.' }
];
L.rooms = [
  { id: 'rm_porch',   place: 'pl_alder', name: 'Porch & street', x: 0,   y: 0,   w: 600, h: 70,  outside: true },
  { id: 'rm_hall',    place: 'pl_alder', name: 'Hall',           x: 230, y: 70,  w: 120, h: 150 },
  { id: 'rm_living',  place: 'pl_alder', name: 'Living room',    x: 350, y: 70,  w: 250, h: 150 },
  { id: 'rm_garage',  place: 'pl_alder', name: 'Garage',         x: 0,   y: 70,  w: 230, h: 150 },
  { id: 'rm_kitchen', place: 'pl_alder', name: 'Kitchen',        x: 230, y: 220, w: 200, h: 130 },
  { id: 'rm_office',  place: 'pl_alder', name: 'Office nook',    x: 430, y: 220, w: 170, h: 130 },
  { id: 'rm_bed1',    place: 'pl_alder', name: 'Bedroom (Dana & Theo)', x: 0, y: 220, w: 230, h: 130 },
  { id: 'rm_bed2',    place: 'pl_alder', name: 'Mira’s room',   x: 0,   y: 350, w: 230, h: 110 },
  { id: 'rm_bath',    place: 'pl_alder', name: 'Bathroom',       x: 230, y: 350, w: 110, h: 110 },
  { id: 'rm_garden',  place: 'pl_alder', name: 'Garden',         x: 340, y: 350, w: 260, h: 110, outside: true },
  { id: 'rm_ruth',    place: 'pl_flat',  name: 'Ruth’s kitchen' }
];

/* People. `roles` holds relationships (a role → the thing it is held on). */
L.people = [
  { id: 'hp_dana',  name: 'Dana',  who: 'Lives here. Northstar customer. Owns the phone-maker ecosystem devices and the Northstar Home account.', age: 'adult', home: 'pl_alder',
    roles: [['owner', 'Northstar Home'], ['admin', 'Northstar Home'], ['member', 'Alder Lane'], ['subject', 'everything below']] },
  { id: 'hp_theo',  name: 'Theo',  who: 'Dana’s partner. Owns the voice-assistant speakers, the thermostat ecosystem account, the car and the router.', age: 'adult', home: 'pl_alder',
    roles: [['owner', 'voice assistant, thermostat, car, router'], ['admin', 'Northstar Home'], ['member', 'Alder Lane'], ['subject', 'presence, voice, car']] },
  { id: 'hp_mira',  name: 'Mira',  who: 'Theo’s daughter, 10. Here Monday to Thursday; with Alex Friday to Sunday.', age: 'child', home: 'pl_alder',
    roles: [['member', 'Alder Lane (child profile)'], ['subject', 'voice, door, tablet, TV']] },
  { id: 'hp_ruth',  name: 'Ruth',  who: 'Theo’s mother, 74. Lives alone; stays at Alder Lane some weekends.', age: 'older adult', home: 'pl_flat',
    roles: [['subject', 'sensors in her own flat, installed and owned by Theo'], ['guest', 'Alder Lane']] },
  { id: 'hp_alex',  name: 'Alex',  who: 'Mira’s other parent. Lived at Alder Lane until 2025; collects Mira on Fridays.', age: 'adult', home: null, former: true,
    roles: [['member', 'the thermostat ecosystem’s household (never removed)'], ['subject', 'doorbell on Fridays']] },
  { id: 'hp_lena',  name: 'Lena',  who: 'Dana’s friend. Stays over now and then.', age: 'adult', home: null,
    roles: [['guest', 'Alder Lane (guest Wi-Fi)'], ['subject', 'microphones, cameras, presence']] },
  { id: 'hp_ines',  name: 'Ines',  who: 'Babysitter, Tuesdays and Thursdays 15:30–19:00.', age: 'adult', home: null, worker: true,
    roles: [['guest', 'a scheduled door code'], ['subject', 'door, cameras, microphones — at work']] },
  { id: 'hp_kofi',  name: 'Kofi',  who: 'Cleaner, sent by an agency every other Friday.', age: 'adult', home: null, worker: true,
    roles: [['guest', 'a code issued by the agency’s app'], ['subject', 'door, cameras — at work']] },
  { id: 'hp_grace', name: 'Grace', who: 'Care worker who visits Ruth on weekdays.', age: 'adult', home: null, worker: true,
    roles: [['bystander', 'Ruth’s sensors'], ['subject', 'motion and speaker at her workplace']] },
  { id: 'hp_courier', name: 'A courier', who: 'Delivers a parcel on Tuesday.', age: 'adult', home: null,
    roles: [['bystander', 'the doorbell camera'], ['subject', 'video, audio, a face template']] },
  { id: 'hp_osei',  name: 'Mr Osei', who: 'Next door. His drive is in the doorbell’s view.', age: 'adult', home: null,
    roles: [['bystander', 'the doorbell camera'], ['subject', 'every time he leaves home']] },
  { id: 'hp_installer', name: 'The installer', who: 'Fitted the alarm for Keystone Monitoring in 2023.', age: 'adult', home: null,
    roles: [['installer', 'the alarm (access never expired)'], ['operator', 'Keystone dealer portal']] },
  { id: 'hp_agent', name: 'A support agent', who: 'Northstar Home support. Can open a household’s logs during a case.', age: 'adult', home: null,
    roles: [['operator', 'Northstar Home support console']] }
];

/* Devices. eco: whose ecosystem it belongs to — by kind, never as a Northstar vendor.
 * sensors / acts: what it can perceive and do. where: local | cloud | both. */
L.devices = [
  { id: 'dv_speaker',  name: 'Kitchen smart speaker', short: 'Smart speaker',   eco: 'Voice assistant (Theo’s account)', room: 'rm_kitchen', owner: 'hp_theo', sensors: ['microphone'], acts: ['announce', 'purchase', 'routine'], where: 'cloud', offline: 'No voice requests at all.' },
  { id: 'dv_kidspk',   name: 'Speaker in Mira’s room', short: 'Smart speaker',   eco: 'Voice assistant (child profile)',  room: 'rm_bed2',    owner: 'hp_theo', sensors: ['microphone'], acts: ['announce'], where: 'cloud', offline: 'No voice requests.' },
  { id: 'dv_display',  name: 'Kitchen display', short: 'Display',          eco: 'Thermostat ecosystem (Theo’s household)', room: 'rm_kitchen', owner: 'hp_theo', sensors: ['microphone', 'ambient light'], acts: ['show calendar', 'announce'], where: 'cloud', offline: 'Shows the clock.' },
  { id: 'dv_thermo',   name: 'Hall thermostat', short: 'Thermostat',          eco: 'Thermostat ecosystem (Theo’s household)', room: 'rm_hall', owner: 'hp_theo', sensors: ['temperature', 'occupancy'], acts: ['heating'], where: 'both', offline: 'Keeps its schedule locally.' },
  { id: 'dv_homepod',  name: 'Bedroom speaker', short: 'Speaker',          eco: 'Phone-maker ecosystem (Dana’s home)', room: 'rm_bed1', owner: 'hp_dana', sensors: ['microphone', 'temperature'], acts: ['announce', 'home hub'], where: 'both', offline: 'Local accessories only.' },
  { id: 'dv_hub',      name: 'Northstar Home hub', short: 'Northstar hub',       eco: 'Northstar Home', room: 'rm_hall', owner: 'hp_dana', sensors: ['Bluetooth', 'Thread radio'], acts: ['routines', 'Matter controller'], where: 'both', offline: 'Local routines run; cloud routines and remote access stop.' },
  { id: 'dv_lock',     name: 'Front-door lock', short: 'Door lock',          eco: 'Northstar Home (Matter)', room: 'rm_hall', owner: 'hp_dana', sensors: ['keypad', 'fingerprint', 'door contact'], acts: ['unlock'], where: 'both', offline: 'Keypad and fingerprint work; remote unlock does not; the log syncs later.' },
  { id: 'dv_bell',     name: 'Video doorbell', short: 'Doorbell',           eco: 'Northstar Home', room: 'rm_porch', owner: 'hp_dana', sensors: ['camera', 'microphone', 'motion', 'face matching'], acts: ['record', 'announce'], where: 'both', offline: 'Buffers 7 days of clips on the device.' },
  { id: 'dv_cam',      name: 'Living-room camera', short: 'Camera',       eco: 'Northstar Home', room: 'rm_living', owner: 'hp_dana', sensors: ['camera', 'microphone'], acts: ['record'], where: 'cloud', offline: 'Does not record.' },
  { id: 'dv_alarm',    name: 'Alarm panel and sensors', short: 'Alarm panel',  eco: 'Northstar Home + Keystone Monitoring', room: 'rm_hall', owner: 'hp_theo', sensors: ['motion', 'door contact', 'glass-break microphone'], acts: ['arm', 'disarm', 'siren', 'call monitoring'], where: 'both', offline: 'Siren works; the monitoring call uses a cellular backup.' },
  { id: 'dv_garage',   name: 'Garage door', short: 'Garage door',              eco: 'Northstar Home (Matter)', room: 'rm_garage', owner: 'hp_theo', sensors: ['door position'], acts: ['open'], where: 'local', offline: 'Wall button and local routines only.' },
  { id: 'dv_energy',   name: 'Energy monitor', short: 'Energy monitor',           eco: 'Northstar Home', room: 'rm_garage', owner: 'hp_dana', sensors: ['per-circuit power'], acts: [], where: 'cloud', offline: 'Buffers readings.' },
  { id: 'dv_motion',   name: 'Motion sensors', short: 'Motion sensor',           eco: 'Northstar Home (Thread)', room: 'rm_bath', owner: 'hp_dana', sensors: ['motion'], acts: [], where: 'local', offline: 'Local routines still see them.' },
  { id: 'dv_tv',       name: 'Living-room TV', short: 'TV',           eco: 'TV maker (content recognition on at setup)', room: 'rm_living', owner: 'hp_theo', sensors: ['content recognition', 'remote microphone'], acts: ['cast target'], where: 'cloud', offline: 'Plays local inputs.' },
  { id: 'dv_tablet',   name: 'Family tablet', short: 'Family tablet',            eco: 'Phone-maker ecosystem (family profile; Mira’s child profile)', room: 'rm_living', owner: 'hp_dana', sensors: ['Wi-Fi association'], acts: [], where: 'both', offline: '—' },
  { id: 'dv_router',   name: 'Router and mesh', short: 'Router',          eco: 'Internet provider', room: 'rm_office', owner: 'hp_theo', sensors: ['device list', 'DNS'], acts: ['guest network'], where: 'both', offline: '—' },
  { id: 'dv_dphone',   name: 'Dana’s phone', short: 'Dana’s phone',             eco: 'Phone-maker ecosystem', room: null, owner: 'hp_dana', sensors: ['GPS', 'Wi-Fi', 'Bluetooth'], acts: ['app unlock', 'key'], where: 'both', offline: 'Bluetooth unlock at the door.' },
  { id: 'dv_watch',    name: 'Dana’s watch', short: 'Watch',             eco: 'Phone-maker ecosystem', room: null, owner: 'hp_dana', sensors: ['heart rate', 'sleep', 'fall detection'], acts: ['emergency call'], where: 'both', offline: '—' },
  { id: 'dv_tphone',   name: 'Theo’s phone', short: 'Theo’s phone',             eco: 'Other phone platform', room: null, owner: 'hp_theo', sensors: ['GPS', 'Wi-Fi', 'Bluetooth'], acts: ['car key', 'garage'], where: 'both', offline: '—' },
  { id: 'dv_oldphone', name: 'Theo’s old phone (now Mira’s)', short: 'Old phone', eco: 'Other phone platform', room: null, owner: 'hp_theo', sensors: ['GPS', 'Wi-Fi', 'Bluetooth'], acts: ['app unlock'], where: 'both', offline: '—', note: 'Handed down to Mira on 14 October, still signed in as Theo and still “Theo” in the presence group.' },
  { id: 'dv_car',      name: 'Car head unit and app', short: 'Car',    eco: 'Carmaker connected services', room: null, owner: 'hp_theo', sensors: ['GPS', 'contacts sync', 'driver profiles'], acts: ['unlock', 'start', 'garage link'], where: 'cloud', offline: 'Key fob and phone key over Bluetooth.' },
  { id: 'dv_ruth',     name: 'Ruth’s sensors and speaker', short: 'Ruth’s sensors', eco: 'Northstar Home Care kit + voice assistant', room: null, place: 'pl_flat', owner: 'hp_theo', sensors: ['motion', 'fall detection', 'microphone'], acts: ['call Theo', 'drop-in'], where: 'both', offline: 'Fall detection calls over cellular.' }
];

/* What each sensor takes from someone who never enrolled. rooms '*' = anywhere in the house.
 * who: 'all' = anyone in range; 'code' = only people with a door code or fingerprint;
 * 'phone' = only people whose phone joins the Wi-Fi or advertises over Bluetooth. */
L.sense = [
  { id: 'se_bellcam',  dev: 'dv_bell',    rooms: ['rm_porch'], sensor: 'Camera', what: 'Video of their face and body', bio: false, keep: '60 days', replay: 'Both admins, and anyone a clip is shared with', control: 'A privacy zone over the street; 30-day clips', who: 'all' },
  { id: 'se_bellface', dev: 'dv_bell',    rooms: ['rm_porch'], sensor: 'Face matching', what: 'A face template, after a third visit', bio: true, keep: '180 days if nobody labels it', replay: 'The household sees a name once someone types one', control: 'Recognise only people who enrol themselves; match on the doorbell', who: 'all' },
  { id: 'se_bellmic',  dev: 'dv_bell',    rooms: ['rm_porch'], sensor: 'Microphone', what: 'What they say at the door', bio: false, keep: '60 days', replay: 'Both admins', control: 'Audio off by default', who: 'all' },
  { id: 'se_lock',     dev: 'dv_lock',    rooms: ['rm_hall'], sensor: 'Keypad and fingerprint', what: 'Their name, and every time they come in', bio: true, keep: '730 days', replay: 'Both admins; support during a case', control: '90-day history; codes that expire; fingerprints deleted when access ends', who: 'code' },
  { id: 'se_alarm',    dev: 'dv_alarm',   rooms: ['rm_hall', 'rm_living'], sensor: 'Motion', what: 'That someone is moving, and when', bio: false, keep: 'Panel log; Keystone 365 days', replay: 'Admins; Keystone operators', control: 'Interior motion ignored in home mode', who: 'all' },
  { id: 'se_thermo',   dev: 'dv_thermo',  rooms: ['rm_hall'], sensor: 'Occupancy', what: 'That someone is near', bio: false, keep: 'Outside Northstar', replay: 'The thermostat ecosystem’s household — Alex included', control: 'Remove members who left', who: 'all' },
  { id: 'se_speaker',  dev: 'dv_speaker', rooms: ['rm_kitchen'], sensor: 'Microphone', what: 'What is said after the wake word — often by accident', bio: true, keep: 'Until deleted (this household’s setting)', replay: 'Theo, and the other adult in the family', control: 'Auto-delete; mute; a guest mode where the platform has one', who: 'all' },
  { id: 'se_display',  dev: 'dv_display', rooms: ['rm_kitchen'], sensor: 'Microphone and screen', what: 'Their requests — and the family calendar, shown to them', bio: false, keep: 'Outside Northstar', replay: 'Its household', control: 'Guest mode; no calendar titles on shared screens', who: 'all' },
  { id: 'se_cam',      dev: 'dv_cam',     rooms: ['rm_living'], sensor: 'Camera and microphone', what: 'Video and audio, whenever the camera is on', bio: false, keep: '30 days', replay: 'Both admins', control: 'Off while anyone is home; a visible light; tell guests', who: 'all' },
  { id: 'se_tv',       dev: 'dv_tv',      rooms: ['rm_living'], sensor: 'Content recognition', what: 'What they watch', bio: false, keep: 'Outside Northstar', replay: 'The TV maker and its partners', control: 'Turn off viewing information', who: 'all' },
  { id: 'se_kidspk',   dev: 'dv_kidspk',  rooms: ['rm_bed2'], sensor: 'Microphone', what: 'What is said in a child’s bedroom after the wake word', bio: false, keep: 'Until a parent deletes it', replay: 'Theo', control: 'Child profile; auto-delete', who: 'all' },
  { id: 'se_garage',   dev: 'dv_garage',  rooms: ['rm_garage'], sensor: 'Door position', what: 'When the garage opened', bio: false, keep: '90 days', replay: 'Admins', control: 'Keep only what the household needs to see: when, not who', who: 'all' },
  { id: 'se_wifi',     dev: 'dv_router',  rooms: '*', sensor: 'Wi-Fi association', what: 'Their phone’s name, and every hour it is here', bio: false, keep: 'Router log 30 days', replay: 'Theo in the router app; the provider', control: 'Guest network with client isolation; private addresses; change the password when people leave', who: 'phone' },
  { id: 'se_ble',      dev: 'dv_hub',     rooms: '*', sensor: 'Bluetooth presence', what: 'That their phone or watch is nearby', bio: false, keep: 'Only if in the presence group', replay: '—', control: 'Presence for enrolled members only', who: 'phone' },
  { id: 'se_ruth',     dev: 'dv_ruth',    rooms: ['rm_ruth'], sensor: 'Motion, microphone, fall detection', what: 'Their movements and voice in Ruth’s kitchen', bio: false, keep: '90 days', replay: 'Theo and Dana', control: 'Ruth’s own pause; tell the people who work there', who: 'all' }
];
/* The people who walk into range, and what they bring with them. */
L.guests = [
  { pid: 'hp_lena',    room: 'rm_kitchen', phone: true,  code: false, moment: 'Lena is staying three weeks between flats — a housemate in all but the lease. She makes tea at seven.', agreed: 'Nothing. She joined the guest Wi-Fi.' },
  { pid: 'hp_mira',    room: 'rm_bed2',    phone: true,  code: true,  moment: 'Mira, ten, home from school, talking to the speaker in her room.', agreed: 'Her father agreed for her, as the account holder.' },
  { pid: 'hp_ines',    room: 'rm_kitchen', phone: true,  code: true,  moment: 'Ines, the babysitter, makes Mira’s dinner.', agreed: 'A door code. Nothing about the microphones or the camera.' },
  { pid: 'hp_kofi',    room: 'rm_living',  phone: true,  code: true,  moment: 'Kofi, from the cleaning agency, does every room.', agreed: 'His agency’s app terms, which never mention this house.' },
  { pid: 'hp_grace',   room: 'rm_ruth',    phone: true,  code: false, moment: 'Grace, Ruth’s care worker, makes lunch in Ruth’s kitchen.', agreed: 'Nothing. The sensors are Theo’s.' },
  { pid: 'hp_courier', room: 'rm_porch',   phone: false, code: false, moment: 'A courier waits at the door with a parcel.', agreed: 'Nothing.' },
  { pid: 'hp_alex',    room: 'rm_garage',  phone: true,  code: true,  moment: 'Alex collects the last boxes from the garage. Their phone rejoins the Wi-Fi by itself: the password never changed.', agreed: 'Everything — years ago, as a resident.' },
  { pid: 'hp_osei',    room: 'rm_porch',   phone: false, code: false, moment: 'Mr Osei backs out of his drive, as he does every morning.', agreed: 'Nothing. He lives next door.' }
];

L.accounts = [
  { id: 'ac_ns',     name: 'Northstar Home — “Alder Lane”', holder: 'hp_dana', admins: ['hp_dana', 'hp_theo'], members: ['hp_mira'], codes: ['hp_ines', 'hp_kofi', 'a plumber (March)'], other: ['installer role: Keystone', 'support: case sessions'] },
  { id: 'ac_voice',  name: 'Voice-assistant account + family',  holder: 'hp_theo', admins: ['hp_theo'], members: ['hp_dana', 'hp_mira (child profile)'], other: ['voice profile: Theo only', 'voice purchasing: on, no code'] },
  { id: 'ac_thermo', name: 'Thermostat ecosystem household',    holder: 'hp_theo', admins: ['hp_theo'], members: ['hp_alex (since 2022; never removed)'], other: ['linked to the lock as a second Matter controller'] },
  { id: 'ac_phone',  name: 'Phone-maker home — “Alder Lane”',   holder: 'hp_dana', admins: ['hp_dana'], members: ['hp_theo', 'hp_lena (invited for a weekend in May)'], other: ['location sharing with Theo'] },
  { id: 'ac_car',    name: 'Carmaker app',                      holder: 'hp_theo', admins: ['hp_theo'], members: ['previous owner’s account (never unlinked)'], other: ['garage link programmed'] },
  { id: 'ac_alarm',  name: 'Keystone monitoring account',       holder: 'hp_theo', admins: ['hp_theo', 'hp_installer (dealer)'], members: [], other: ['emergency contacts: Dana, Ruth'] }
];

/* Networks, and what each one sees. tracked = the eight things the Command Center's
 * Network context page tracks for every device that moves between them. */
L.networks = [
  { id: 'nw_home', name: 'Alder Lane Wi-Fi', place: 'pl_alder', trust: 'trusted', operator: 'Theo (router admin) and the internet provider',
    identity: 'Each device’s name and a per-network address the router remembers; one public IP for the whole house.',
    discovery: 'Every device can see the TV, printer, speakers and hub.',
    envelope: 'The router and the provider can see every device’s DNS lookups and destinations; the router app lists who is home.',
    portal: 'None.', autojoin: 'Yes — remembered.', randomize: 'Private address, fixed for this network.', persist: 'Household devices stay signed in.',
    history: 'Cast history on the TV; print queue on the printer.' },
  { id: 'nw_guest', name: 'Alder Lane guest Wi-Fi', place: 'pl_alder', trust: 'guest', operator: 'Theo',
    identity: 'The guest phone’s name (“Lena’s phone”) appears in the router app.',
    discovery: 'Client isolation is off: guests can see the TV and the printer.',
    envelope: 'Same router, same provider: destinations and timing are visible.', portal: 'None.', autojoin: 'Yes, once joined.',
    randomize: 'Private address.', persist: 'The TV remembers a guest who cast to it.', history: 'Cast and print jobs remain.' },
  { id: 'nw_office', name: 'Office network (managed)', place: 'pl_office', trust: 'managed', operator: 'Dana’s employer',
    identity: 'Her work account, via the managed laptop’s certificate.',
    discovery: 'Printers and meeting-room screens.',
    envelope: 'The employer can log DNS and destinations under her name, and a managed proxy can follow the laptop home.',
    portal: 'None; certificate login.', autojoin: 'Managed.', randomize: 'Disabled by policy.', persist: 'Always signed in.', history: 'Print jobs retained by the print server.' },
  { id: 'nw_library', name: 'Eastside Library Wi-Fi', place: 'pl_library', trust: 'public', operator: 'The library and its provider',
    identity: 'The library card number typed into the portal.',
    discovery: 'Other patrons’ devices, if the network allows it.',
    envelope: 'Destinations and timing, tied to a card number; the page content stays encrypted.',
    portal: 'Library card number and acceptance of terms.', autojoin: 'Yes, by name.', randomize: 'Rotating on open networks.', persist: 'Public computers keep downloads and sessions until they are wiped.', history: 'The public printer’s queue.' },
  { id: 'nw_hotel', name: 'Harbor Hotel Wi-Fi', place: 'pl_hotel', trust: 'public', operator: 'The hotel and its portal company',
    identity: 'Room number and surname.',
    discovery: 'The room TV offers casting; so may the room next door.',
    envelope: 'Destinations and timing tied to a named guest.', portal: 'Room number + surname.', autojoin: 'Yes, by name.', randomize: 'Rotating.', persist: 'The TV remembers accounts signed in on it.', history: 'Cast history on the room TV.' },
  { id: 'nw_cafe', name: 'Airport café Wi-Fi', place: 'pl_cafe', trust: 'public', operator: 'Unknown',
    identity: 'A randomized address; nothing else unless a portal asks.',
    discovery: 'Anyone on the same network.',
    envelope: 'Destinations and timing — and anyone can broadcast the same network name.', portal: 'Email address, sometimes.', autojoin: 'Yes: a familiar name is joined automatically.', randomize: 'Rotating.', persist: '—', history: '—' },
  { id: 'nw_hotspot', name: 'Dana’s phone hotspot', place: null, trust: 'personal', operator: 'Dana, and her mobile carrier',
    identity: 'The carrier knows the subscriber.', discovery: 'Only her own devices.', envelope: 'The carrier sees destinations and timing.', portal: 'None.', autojoin: 'Her laptop, yes.', randomize: '—', persist: '—', history: '—' },
  { id: 'nw_cell', name: 'Cellular', place: null, trust: 'carrier', operator: 'The mobile carrier',
    identity: 'The SIM and the phone’s hardware identity: always the subscriber.', discovery: 'None.',
    envelope: 'Destinations, timing and which cell tower — roughly where she is.', portal: 'None.', autojoin: 'Always.', randomize: 'Not possible.', persist: '—', history: '—' }
];
L.netTracked = [['identity', 'Network identity'], ['discovery', 'Local discovery'], ['envelope', 'DNS and metadata exposure'], ['portal', 'Captive portal'],
  ['autojoin', 'Automatic connection'], ['randomize', 'Device address randomization'], ['persist', 'Session persistence'], ['history', 'Print, cast and file-transfer history']];

/* The arrows. Each answers the fourteen questions; null = nobody at Northstar can answer. */
L.arrows = [
  { id: 'ar_voice', title: 'Mira asks the kitchen speaker for a song', path: ['person', 'device', 'sensor', 'account', 'network', 'cloud', 'inference'], outside: true, label: 'Configurable platform behaviour',
    init: 'Mira, by saying the wake word — or the TV saying something close to it.', about: 'Mira, and anyone talking behind her.',
    consent: 'Only Theo, when he set the speaker up. Mira is ten; her child profile changes the rules, not who agreed.', consentBy: 'owner',
    raw: 'Audio after the wake word, and a transcript.', infer: 'A child is home at 15:45 on a weekday; her tastes; who else was talking.',
    where: 'cloud', join: 'Theo’s voice-assistant account; a voice profile if one matches (Mira has none).', cross: ['room', 'household', 'network', 'company'],
    phys: 'Through routines: lights, heating, purchases.', read: 'Whoever can open the account’s voice history — Theo, and the other adult in the family.',
    keep: 'Until deleted — the setting this household chose.', revoke: 'Delete the history (recordings and transcripts); set auto-delete; review the child profile.',
    fail: 'Offline: nothing is heard or queued.', proof: 'A voice-history export that is empty after deletion — transcripts included.', src: ['ftcalexa23', 'alexaret'] },
  { id: 'ar_presence', title: 'Dana drives home', path: ['person', 'device', 'sensor', 'network', 'cloud', 'automation', 'action'],
    init: 'Dana’s phone, crossing the edge of a geofence around the house.', about: 'Dana — and, by elimination, whoever is still at home.',
    consent: 'Dana, by allowing location “Always”.', consentBy: 'subject',
    raw: 'Enter or exit, a member ID, a device ID, a time.', infer: 'Her commute, her working days, when the house is empty.',
    where: 'cloud', join: 'Her member ID in the Northstar Home household.', cross: ['network', 'company'],
    phys: 'Yes: “Welcome home” disarms the alarm and unlocks the garage entry.', read: 'Both admins in the activity feed; support during a case.',
    keep: '400 days, against a 30-day standard.', revoke: 'Turn off presence for this member; delete history.',
    fail: 'Events queue for up to 45 minutes when the phone is offline, then fire late.', proof: 'Routine log with the triggering event’s age and identity for every disarm.', flow: 'flh3', finding: 'PRV-0302' },
  { id: 'ar_sdk', title: 'The same arrival, copied to an advertising SDK', path: ['device', 'network', 'vendor', 'inference'],
    init: 'The location SDK inside the Northstar Home app.', about: 'Dana, and the household’s routine.',
    consent: 'Nobody agreed to this use; the OS permission was for the geofence.', consentBy: 'none',
    raw: 'Home-geofence enter/exit, an advertising ID.', infer: 'When the house is empty; where Dana lives; her daily pattern across apps.',
    where: 'cloud', join: 'Her advertising ID.', cross: ['network', 'company'],
    phys: 'No.', read: null, keep: null, revoke: 'Remove the SDK; reset the advertising ID.',
    fail: 'Retries until delivered.', proof: 'Traffic capture shows no calls to the SDK host for 14 days.', flow: 'flh4', finding: 'PRV-0305' },
  { id: 'ar_lock', title: 'Ines lets herself in', path: ['person', 'device', 'sensor', 'network', 'cloud', 'account'],
    init: 'Ines, typing her code.', about: 'Ines, and the fact that Mira is home with her.',
    consent: 'Ines was given a code, not a choice about her record.', consentBy: 'owner',
    raw: 'Code holder, method, time, outcome.', infer: 'Her hours, her pay by the hour, when the parents are out.',
    where: 'both', join: 'Her code, labelled with her name.', cross: ['household', 'network', 'company'],
    phys: 'It is one: the door opens.', read: 'Both admins; support during a case.',
    keep: '730 days.', revoke: 'Delete the code — on the lock, not only in the cloud.',
    fail: 'Offline, the keypad still works and the log syncs later; a code deleted in the cloud stays on the lock until then.', proof: 'Weekly census: codes on each lock reconciled against the household’s list of people.', flow: 'flh2', finding: 'PRV-0303' },
  { id: 'ar_bell', title: 'A courier rings the bell', path: ['person', 'place', 'device', 'sensor', 'cloud', 'inference'],
    init: 'Motion on the porch.', about: 'The courier; Mr Osei’s drive in the background; anyone walking past.',
    consent: 'None of them. Dana accepted the terms.', consentBy: 'none',
    raw: 'Video and audio; a face template if the face is seen more than twice.', infer: 'Who visits, when; when the neighbour leaves home.',
    where: 'both', join: 'The household; a face template, then a name if someone types one.', cross: ['room', 'household', 'network', 'company'],
    phys: 'No — but it reveals when nobody answers.', read: 'All admins, anyone the clip is shared with, support with consent.',
    keep: 'Clips 60 days; face templates 180.', revoke: 'Delete clips; turn off familiar faces (templates of unlabelled faces are kept).',
    fail: 'Offline, clips buffer on the doorbell for 7 days and upload later.', proof: 'Deletion receipts per clip; no unlabelled template older than 24 hours.', flow: 'flh7', finding: 'PRV-0306' },
  { id: 'ar_fabric', title: 'The lock tells another ecosystem it is locked', path: ['device', 'network', 'integration', 'account', 'person'],
    init: 'The Matter fabric, whenever the lock changes state.', about: 'Everyone who lives here.',
    consent: 'Theo added his thermostat ecosystem as a second controller. Nobody asked Dana.', consentBy: 'owner',
    raw: 'Lock state, occupancy, thermostat mode, commands — never audio.', infer: 'Whether anyone is home.',
    where: 'local', join: 'The other ecosystem’s household — which still includes Alex.', cross: ['household', 'company'],
    phys: 'Yes: that fabric holds Operate on the lock.', read: null,
    keep: null, revoke: 'Remove the fabric from the lock, or remove Alex from that household.',
    fail: 'Keeps working locally when the internet is down.', proof: 'Monthly fabric census on every lock: which controllers, which privilege, who is in them.', flow: 'flh13', finding: 'PRV-0301' },
  { id: 'ar_calendar', title: 'The kitchen reads out Dana’s appointment', path: ['account', 'integration', 'device', 'automation', 'action'],
    init: 'A routine at 07:30, reading the family calendar Dana shared a year ago.', about: 'Dana.',
    consent: 'Dana shared a calendar; she never agreed to have it read aloud.', consentBy: 'subject',
    raw: '“Prenatal appointment, 16:00.”', infer: 'She is pregnant — the thing she hasn’t told anyone.',
    where: 'cloud', join: 'The shared family calendar.', cross: ['room', 'household', 'company'],
    phys: 'A broadcast into a shared room.', read: 'Anyone in the kitchen.',
    keep: 'Spoken once; the routine log keeps it 90 days.', revoke: 'Stop sharing that calendar with the display; announce times, not titles.',
    fail: '—', proof: 'Routine audit: no announce action reads a calendar title on a shared device.', finding: 'PRV-0311' },
  { id: 'ar_tv', title: 'The TV recognises what is on screen', path: ['device', 'sensor', 'network', 'cloud', 'vendor', 'inference'], outside: true, label: 'Historical enforcement case (pattern)',
    init: 'Content recognition, every few seconds, whatever is showing.', about: 'Whoever is watching — often Mira, at 15:45.',
    consent: 'Theo, on a setup screen.', consentBy: 'owner',
    raw: 'Fingerprints of what is on screen; the household’s IP address.', infer: 'Viewing habits; a child watching alone; politics, religion, health.',
    where: 'cloud', join: 'The household IP address.', cross: ['household', 'network', 'company'],
    phys: 'No.', read: null, keep: null, revoke: 'Turn off viewing information in the TV’s settings.',
    fail: '—', proof: 'Outside Northstar: nothing it can prove.', src: ['vizio17'] },
  { id: 'ar_codehand', title: 'The cleaning agency schedules Kofi', path: ['integration', 'vendor', 'cloud', 'action'],
    init: 'CodeHand’s system, through an integration Dana approved.', about: 'Kofi, and the household.',
    consent: 'Dana approved “manage codes”. The token can also unlock.', consentBy: 'owner',
    raw: 'A code schedule, Kofi’s name, job times.', infer: 'When the house is empty on alternate Fridays.',
    where: 'cloud', join: 'The household ID, via the partner token.', cross: ['company'],
    phys: 'Yes: the token can unlock remotely.', read: 'The agency’s staff.',
    keep: '30 days, by contract; not verified.', revoke: 'Revoke the token; delete Kofi’s code on the lock.',
    fail: 'API retries; a revoke that fails leaves the code on the lock.', proof: 'Partner-scope audit: no partner token holds lock.operate.', flow: 'flh9', finding: 'PRV-0307' },
  { id: 'ar_nova', title: 'An invitation that talks to the house', path: ['account', 'integration', 'inference', 'automation', 'action'],
    init: 'Text in a calendar invite, read by Nova Home when Dana asks “what’s on today?”.', about: 'The household.',
    consent: 'Nobody. The sender is a stranger.', consentBy: 'none',
    raw: 'The invite’s description, which contains instructions.', infer: 'None needed.',
    where: 'cloud', join: 'Dana’s calendar.', cross: ['company', 'household'],
    phys: 'Yes, if the agent’s tools include the windows or the lock.', read: 'Nova Home’s memory, if it saved the instruction.',
    keep: null, revoke: 'Remove physical tools from the agent; require confirmation.',
    fail: '—', proof: 'Agent tool audit: no physical tool callable without a human confirmation outside the model.', flow: 'flh12', finding: 'PRV-0309', src: ['invite25', 'owasp'] },
  { id: 'ar_ruth', title: 'Ruth’s kitchen stays quiet until eleven', path: ['person', 'place', 'sensor', 'cloud', 'inference', 'automation', 'action'],
    init: 'No motion in Ruth’s kitchen by 10:00.', about: 'Ruth — and Grace, whose hours the same sensors record.',
    consent: 'Theo installed and owns the kit. Ruth said “fine” once; Grace was never asked.', consentBy: 'owner',
    raw: 'Motion events, falls, speaker requests.', infer: 'Ruth’s health and routine; Grace’s working hours.',
    where: 'both', join: 'Theo’s account.', cross: ['household', 'network', 'company'],
    phys: 'Calls Theo; after a fall, emergency services.', read: 'Theo and Dana.',
    keep: '90 days.', revoke: 'Ruth can pause it — if anyone showed her how.',
    fail: 'Fall calls go over cellular when the internet is down.', proof: 'A record of Ruth’s own agreement, and a pause she has used.' }
];

/* Automations: small programs with privileges. idConf: how sure the trigger is about who. */
L.automations = [
  { id: 'au_welcome', name: 'Welcome home', owner: 'hp_theo', created: '2025-11-02', lastReview: null,
    trigger: 'Any phone in the household presence group enters the home geofence', conditions: 'After 15:00',
    idSource: 'Phone geofence', idConf: 'low', idWhy: 'Any phone in the group — including Theo’s old phone, now Mira’s and still signed in as him — and late events replayed for up to 45 minutes.',
    actions: [['disarm', 'Disarm the alarm'], ['unlock', 'Unlock the garage entry door'], ['lights', 'Hall lights on'], ['announce', 'Announce the next calendar event in the kitchen']],
    devices: ['dv_alarm', 'dv_lock', 'dv_hub', 'dv_speaker'], privileges: ['alarm.disarm', 'lock.unlock (garage entry)', 'lights', 'speaker.announce', 'calendar.read'],
    bystanders: 'Whoever is in the kitchen hears the calendar: Mira, Ines, Ruth, a guest.', offline: 'Presence events queue up to 45 minutes, then fire.',
    audit: 'Runs logged 90 days — without the triggering identity or its age.', kill: 'In the app only.', confirm: 'None.',
    consequence: 'A late or wrong presence event disarms and unlocks an empty house, and reads a private appointment to a room.', finding: 'PRV-0302' },
  { id: 'au_night', name: 'Goodnight', owner: 'hp_theo', created: '2025-02-10', lastReview: '2026-06-01',
    trigger: 'Anyone says “goodnight” to the kitchen speaker', conditions: 'After 21:00',
    idSource: 'None (any voice)', idConf: 'none', idWhy: 'Anyone in the room — or the TV.',
    actions: [['lock', 'Lock the front door'], ['arm', 'Arm the alarm (home mode)'], ['heat', 'Heating down'], ['tv', 'TV off']],
    devices: ['dv_lock', 'dv_alarm', 'dv_thermo', 'dv_tv'], privileges: ['lock.lock', 'alarm.arm', 'heating', 'tv.power'],
    bystanders: 'None harmed: every action makes the house safer.', offline: 'Runs locally.', audit: 'Logged 90 days.', kill: 'App; wall switch.', confirm: 'None needed.',
    consequence: 'Low: it only closes things. Identity matters in one direction.', finding: null },
  { id: 'au_mira', name: 'Mira’s home', owner: 'hp_dana', created: '2026-01-08', lastReview: null,
    trigger: 'Mira’s code opens the front door, weekdays 15:00–17:00', conditions: 'No adult phone at home',
    idSource: 'Door code', idConf: 'medium', idWhy: 'Anyone who knows Mira’s code.',
    actions: [['notify', 'Notify Dana and Theo: “Mira is home — alone”'], ['lights', 'Hall lights on']],
    devices: ['dv_lock', 'dv_hub'], privileges: ['notify', 'lights'],
    bystanders: 'The notification text appears on Dana’s mirrored work laptop.', offline: 'Notification delayed until reconnect.', audit: 'Logged 90 days.', kill: 'App.', confirm: 'None.',
    consequence: '“A child is home alone” is published to every screen that mirrors a parent’s notifications.', finding: null },
  { id: 'au_away', name: 'Away for the weekend', owner: 'hp_theo', created: '2025-07-01', lastReview: '2026-03-02',
    trigger: 'Everyone’s phone outside the geofence for 2 hours', conditions: 'Friday–Sunday',
    idSource: 'Phone geofences', idConf: 'medium', idWhy: 'Phones, not people.',
    actions: [['eco', 'Heating to eco'], ['lights', 'Randomised lights'], ['arm', 'Arm the alarm (away)']],
    devices: ['dv_thermo', 'dv_hub', 'dv_alarm'], privileges: ['heating', 'lights', 'alarm.arm'],
    bystanders: 'The thermostat’s “Away” mode is visible to every member of its ecosystem household — including Alex.', offline: 'Runs locally.', audit: 'Logged 90 days.', kill: 'App.', confirm: 'None.',
    consequence: 'An empty house becomes visible to someone who no longer lives there.', finding: 'PRV-0301' },
  { id: 'au_nova', name: 'Nova: unlock for known voices', owner: 'hp_theo', created: '2026-08-15', lastReview: null,
    trigger: '“Nova, unlock the front door”', conditions: 'Voice matches an enrolled profile',
    idSource: 'Voice match', idConf: 'low', idWhy: 'A voice that sounds like Theo’s may match. Voice match is recognition, not authentication.',
    actions: [['unlock', 'Unlock the front door']],
    devices: ['dv_lock', 'dv_speaker'], privileges: ['lock.unlock'],
    bystanders: 'Anyone at the door who can be heard through the window.', offline: 'Unavailable.', audit: 'Agent log; retention unknown.', kill: 'App.', confirm: 'None for recognised voices.',
    consequence: 'A similar voice, or a recording, opens the door.', finding: 'PRV-0309' },
  { id: 'au_ruth', name: 'Check on Ruth', owner: 'hp_theo', created: '2026-02-20', lastReview: null,
    trigger: 'No motion in Ruth’s kitchen by 10:00', conditions: 'Every day',
    idSource: 'Motion (anyone)', idConf: 'none', idWhy: 'Grace moving in the kitchen counts as Ruth.',
    actions: [['call', 'Call Theo'], ['dropin', 'Open the speaker for a drop-in call']],
    devices: ['dv_ruth'], privileges: ['call', 'speaker.dropin'],
    bystanders: 'Grace, at work in Ruth’s kitchen.', offline: 'Cellular backup.', audit: 'Logged 90 days.', kill: 'Ruth’s own button — which no one showed her.', confirm: 'Drop-in opens without Ruth answering.',
    consequence: 'Care becomes monitoring when the person watched cannot see or stop it.', finding: null }
];

/* Physical-action register: every software path that can make something happen in the world.
 * cap: the capability; via: the path; who: who can invoke it; id: identity required;
 * assur: high | medium | low | none | unknown; outside: the path runs outside Northstar. */
L.capabilities = [['unlock', 'Unlocking'], ['open', 'Opening'], ['disarm', 'Disarming'], ['start', 'Starting'], ['purchase', 'Purchasing'], ['record', 'Recording'],
  ['broadcast', 'Broadcasting'], ['temperature', 'Changing temperature'], ['presence', 'Revealing presence'], ['emergency', 'Contacting emergency services']];
L.actions = [
  { id: 'pa01', cap: 'unlock', device: 'dv_lock', via: 'Northstar Home app', who: 'Admins (Dana, Theo)', id_: 'Account + phone passcode', assur: 'high', confirm: 'Passcode or biometric on the phone', offline: 'Bluetooth at the door; remote unavailable', audit: 'Access log, 730 d', owner: 't_access', finding: null },
  { id: 'pa02', cap: 'unlock', device: 'dv_lock', via: 'Keypad code', who: 'Anyone with one of 6 codes — one a plumber’s from March', id_: 'Knowledge of a code', assur: 'low', confirm: 'None', offline: 'Works; logs sync later', audit: 'Access log', owner: 't_access', finding: 'PRV-0303' },
  { id: 'pa03', cap: 'unlock', device: 'dv_lock', via: 'Fingerprint', who: 'Dana, Theo, Mira', id_: 'Biometric match on the lock', assur: 'medium', confirm: 'None', offline: 'Works', audit: 'Access log', owner: 't_access', finding: null },
  { id: 'pa04', cap: 'unlock', device: 'dv_lock', via: 'Nova Home voice', who: 'Any voice that matches an enrolled profile', id_: 'Voice match', assur: 'low', confirm: 'None', offline: 'Unavailable', audit: 'Agent log (retention unknown)', owner: 't_nova', finding: 'PRV-0309' },
  { id: 'pa05', cap: 'unlock', device: 'dv_lock', via: 'Routine “Welcome home”', who: 'Any phone in the presence group', id_: 'Geofence event', assur: 'low', confirm: 'None', offline: 'Replays queued events up to 45 min late', audit: 'Routine log without identity', owner: 't_home', finding: 'PRV-0302' },
  { id: 'pa06', cap: 'unlock', device: 'dv_lock', via: 'CodeHand partner API', who: 'The agency’s systems and staff', id_: 'OAuth token (scope lock.operate)', assur: 'medium', confirm: 'None', offline: 'Unavailable', audit: 'Partner API log', owner: 't_access', finding: 'PRV-0307' },
  { id: 'pa07', cap: 'unlock', device: 'dv_lock', via: 'Another Matter controller', who: 'Everyone in the other ecosystem’s household — Alex included', id_: 'That ecosystem’s own rules', assur: 'unknown', confirm: 'Unknown', offline: 'Works on the local fabric', audit: 'Outside Northstar', owner: 't_home', finding: 'PRV-0301', outside: true },
  { id: 'pa08', cap: 'open', device: 'dv_garage', via: 'Northstar Home app', who: 'Admins', id_: 'Account + passcode', assur: 'high', confirm: 'Passcode', offline: 'Local only', audit: 'Routine log', owner: 't_home', finding: null },
  { id: 'pa09', cap: 'open', device: 'dv_garage', via: 'Car link (programmed in the car)', who: 'Whoever drives the car — and the previous owner’s programming', id_: 'Possession of the car', assur: 'low', confirm: 'None', offline: 'Works (radio)', audit: 'None', owner: 't_home', finding: null, outside: true },
  { id: 'pa10', cap: 'disarm', device: 'dv_alarm', via: 'Panel keypad', who: 'Code holders', id_: 'Code', assur: 'low', confirm: 'None', offline: 'Works', audit: 'Panel log', owner: 't_home', finding: null },
  { id: 'pa11', cap: 'disarm', device: 'dv_alarm', via: 'Routine “Welcome home”', who: 'Any phone in the presence group', id_: 'Geofence event', assur: 'low', confirm: 'None', offline: 'Replays late', audit: 'Routine log without identity', owner: 't_home', finding: 'PRV-0302' },
  { id: 'pa12', cap: 'disarm', device: 'dv_alarm', via: 'Keystone dealer portal', who: 'The installer who fitted it in 2023', id_: 'Dealer login', assur: 'medium', confirm: 'None', offline: 'Unavailable', audit: 'Keystone’s log (not shared)', owner: 't_home', finding: 'PRV-0310' },
  { id: 'pa13', cap: 'start', device: 'dv_car', via: 'Routine “Warm the car” (carmaker integration)', who: 'Admins; the carmaker’s app users — including a previous owner’s account', id_: 'Carmaker token', assur: 'medium', confirm: 'None', offline: 'Unavailable', audit: 'Carmaker (outside Northstar)', owner: 't_home', finding: null, outside: true },
  { id: 'pa14', cap: 'purchase', device: 'dv_speaker', via: 'Nova Home “order more”', who: 'Any voice', id_: 'None under the spending limit', assur: 'none', confirm: 'PIN above 20 in local currency', offline: 'Unavailable', audit: 'Order history', owner: 't_nova', finding: null },
  { id: 'pa15', cap: 'record', device: 'dv_bell', via: 'Motion', who: 'Automatic', id_: '—', assur: 'none', confirm: '—', offline: 'Buffers 7 days on device', audit: 'Clip list', owner: 't_access', finding: 'PRV-0306' },
  { id: 'pa16', cap: 'record', device: 'dv_cam', via: 'App “camera on”', who: 'Admins, remotely', id_: 'Account + passcode', assur: 'high', confirm: 'Passcode', offline: 'Does not record', audit: 'Camera log', owner: 't_access', finding: null },
  { id: 'pa17', cap: 'broadcast', device: 'dv_speaker', via: 'Routine announce', who: 'Routines', id_: '—', assur: 'none', confirm: 'None', offline: 'Unavailable', audit: 'Routine log', owner: 't_home', finding: 'PRV-0311' },
  { id: 'pa18', cap: 'broadcast', device: 'dv_ruth', via: 'Drop-in call to Ruth’s speaker', who: 'Theo, Dana', id_: 'Account', assur: 'high', confirm: 'Ruth does not have to answer', offline: 'Unavailable', audit: 'Call log', owner: 't_home', finding: null },
  { id: 'pa19', cap: 'temperature', device: 'dv_thermo', via: 'Thermostat ecosystem app', who: 'Its household — Alex included', id_: 'That ecosystem’s rules', assur: 'unknown', confirm: 'None', offline: 'Local schedule', audit: 'Outside Northstar', owner: 't_home', finding: 'PRV-0301', outside: true },
  { id: 'pa20', cap: 'presence', device: 'dv_lock', via: 'Lock state on every fabric; activity feed', who: 'Admins; other ecosystems’ households', id_: '—', assur: 'unknown', confirm: '—', offline: '—', audit: 'Partly outside Northstar', owner: 't_home', finding: 'PRV-0301' },
  { id: 'pa21', cap: 'presence', device: 'dv_thermo', via: 'Home / Away mode', who: 'The thermostat ecosystem’s household', id_: '—', assur: 'unknown', confirm: '—', offline: '—', audit: 'Outside Northstar', owner: 't_home', finding: 'PRV-0301', outside: true },
  { id: 'pa22', cap: 'emergency', device: 'dv_alarm', via: 'Verified alarm → Keystone dispatch', who: 'Keystone operators', id_: 'Alarm + clip review', assur: 'medium', confirm: 'Operator reviews a clip first', offline: 'Cellular backup', audit: 'Keystone log', owner: 't_home', finding: null },
  { id: 'pa23', cap: 'emergency', device: 'dv_ruth', via: 'Fall detected, no answer for 60 s', who: 'Automatic', id_: '—', assur: 'none', confirm: '60-second cancel', offline: 'Cellular', audit: 'Call log', owner: 't_home', finding: null }
];

/* Sensor fusion. Streams are mundane alone; `needs` are all required, `adds` raise confidence.
 * Every inference carries provenance, confidence, permitted uses, correction and expiry. */
L.streams = [['thermo', 'Thermostat changes'], ['motion', 'Motion events'], ['door', 'Door openings'], ['garage', 'Garage activity'], ['energy', 'Electricity use'],
  ['wifi', 'Wi-Fi associations'], ['tv', 'TV activity'], ['voice', 'Voice commands'], ['location', 'Phone location'], ['sleep', 'Sleep and wearable data']];
L.inferences = [
  { id: 'hi_home',   claim: 'Someone is home right now', about: 'The household', needs: ['motion'], adds: ['wifi', 'door', 'energy'], base: 0.7, step: 0.09, sensitive: false,
    uses: 'Heating; the alarm’s mode', never: 'Anything that leaves the house', correct: 'The live view corrects itself', expiry: '15 minutes', appeal: '—' },
  { id: 'hi_empty',  claim: 'The house is empty on weekdays from 08:05', about: 'The household', needs: ['location', 'motion'], adds: ['door', 'garage', 'wifi'], base: 0.62, step: 0.1, sensitive: true,
    uses: 'Arming the alarm', never: 'Sharing with anyone — it is a burglar’s question', correct: 'Any motion cancels it', expiry: 'Live only; never stored', appeal: '—' },
  { id: 'hi_sleep',  claim: 'Dana and Theo sleep 23:30–06:40', about: 'Dana, Theo', needs: ['motion'], adds: ['sleep', 'energy', 'thermo'], base: 0.5, step: 0.12, sensitive: false,
    uses: 'The heating schedule, on the hub', never: 'Ads, insurers, employers', correct: 'Edit the schedule', expiry: '30 days', appeal: 'The household admins' },
  { id: 'hi_work',   claim: 'Dana works from home on Mondays and Fridays', about: 'Dana', needs: ['wifi'], adds: ['location', 'energy', 'motion'], base: 0.5, step: 0.12, sensitive: false,
    uses: 'None needed', never: 'Anything', correct: '—', expiry: 'Not kept', appeal: '—' },
  { id: 'hi_child',  claim: 'Mira is home alone 15:40–16:20 on Mondays and Wednesdays', about: 'Mira', needs: ['door'], adds: ['wifi', 'tv', 'voice', 'location'], base: 0.55, step: 0.1, sensitive: true,
    uses: 'Telling her parents, privately', never: 'Everything else', correct: 'Parents can dismiss it', expiry: 'Daily', appeal: 'Either parent' },
  { id: 'hi_ill',    claim: 'Someone in the house may be unwell', about: 'Unknown — which is the danger', needs: ['motion', 'voice'], adds: ['thermo', 'sleep', 'energy'], base: 0.35, step: 0.1, sensitive: true,
    uses: 'The person’s own reminders', never: 'Anyone else', correct: 'The person dismisses it', expiry: '7 days', appeal: 'The person it names — to Northstar support if it was shared' },
  { id: 'hi_faith',  claim: 'A weekly pattern consistent with religious observance', about: 'Ruth', needs: ['energy', 'voice'], adds: ['tv', 'motion'], base: 0.3, step: 0.1, sensitive: true,
    uses: 'None', never: 'Everything', correct: '—', expiry: 'Should never be computed', appeal: '—' },
  { id: 'hi_rel',    claim: 'Theo has been away overnight 9 of the last 14 nights', about: 'Theo, and Dana', needs: ['wifi', 'door'], adds: ['location', 'sleep', 'garage'], base: 0.4, step: 0.12, sensitive: true,
    uses: 'None', never: 'Everything', correct: '—', expiry: 'Should never be computed', appeal: '—' },
  { id: 'hi_vacant', claim: 'Vacant for nine days', about: 'The household', needs: ['door', 'motion'], adds: ['energy', 'thermo', 'garage', 'location'], base: 0.55, step: 0.1, sensitive: true,
    uses: 'Away mode, locally', never: 'Other ecosystems, partners, anyone outside', correct: '—', expiry: 'Ends on first entry', appeal: 'The household admins' },
  { id: 'hi_ruth',   claim: 'Ruth’s mornings start two hours later than her 90-day baseline', about: 'Ruth', needs: ['motion'], adds: ['voice', 'energy', 'sleep'], base: 0.45, step: 0.12, sensitive: true,
    uses: 'A check-in Ruth has agreed to', never: 'Insurers, landlords, anyone Ruth has not chosen', correct: 'Ruth can annotate: “I was at my sister’s”', expiry: '14 days', appeal: 'Ruth, and a person at Northstar she can reach' }
];

/* The engineering answers (Paddy's solutions table, 2026-09-29). One row per problem:
 * the solution in parts, where the essay explains it, where the Command Center runs it,
 * and the Northstar controls whose tests say how far along it is. */
L.solutions = [
  { id: 'so_contam', problem: 'Alexa, Google and Siri contamination', parts: ['Separate household profiles', 'Rotating identifiers', 'Local processing', 'Explicit integration boundaries', 'An approved-joins registry'], essay: 'home', route: 'life/graph', controls: ['c_id_scope', 'c_fabric_review'] },
  { id: 'so_guests', problem: 'Guests and bystanders', parts: ['Guest mode by default', 'Visible sensing indicators', 'Ephemeral processing', 'Privacy zones', 'No retained voice or video without need'], essay: 'guest', route: 'life/people', controls: ['c_privacy_zone', 'c_face_consent'] },
  { id: 'so_locks', problem: 'Smart locks and garage doors', parts: ['Passkeys or multi-factor sign-in', 'Time-limited codes', 'Step-up confirmation for remote access', 'Local authorisation', 'Access receipts', 'Immediate revocation'], essay: 'door', route: 'life/actions', controls: ['c_code_expiry', 'c_physical_confirm', 'c_installer_expiry'] },
  { id: 'so_chains', problem: 'Dangerous automation chains', parts: ['Least-privilege capabilities', 'Simulation before activation', 'Human approval for physical actions', 'Circuit breakers', 'A household kill switch'], essay: 'routine', route: 'life/routines', controls: ['c_physical_confirm'] },
  { id: 'so_nets', problem: 'Public and shared networks', parts: ['Treat every network as untrusted', 'Encrypt traffic', 'Minimise metadata', 'Disable unnecessary discovery', 'Separate IoT and guest networks'], essay: 'network', route: 'life/networks', controls: ['c_tls'] },
  { id: 'so_docs', problem: 'Google Docs history', parts: ['Share clean snapshots', 'Separate edit and history permissions', 'Scan historical versions', 'Impose retention', 'Provide verifiable redaction'], essay: 'history', route: null, controls: [] },
  { id: 'so_infer', problem: 'Sensor-fusion inference', parts: ['An inference registry: source, confidence, purpose, expiry, explanation, correction and appeal'], essay: 'infer', route: 'life/inferences', controls: ['c_presence_ttl'] },
  { id: 'so_cars', problem: 'Connected cars', parts: ['Guest profiles', 'Opt-in contact sync', 'Erase on return', 'An ownership-transfer workflow', 'Cloud-token revocation'], essay: 'house-guide', route: 'life/offboarding', controls: [] },
  { id: 'so_resale', problem: 'Device resale or household changes', parts: ['One complete offboarding action covering device, hub, account, integrations, vendors, codes, biometrics and backups'], essay: 'oldkeys', route: 'life/offboarding', controls: ['c_backup_reapply', 'c_code_expiry'] },
  { id: 'so_agents', problem: 'AI agents operating devices', parts: ['Scoped tools', 'Short-lived credentials', 'Action-risk tiers', 'Human confirmation', 'Immutable receipts', 'Rollback', 'Emergency disablement'], essay: 'routine', route: 'privacy/ai', controls: ['c_physical_confirm', 'c_ai_review'] }
];

/* Offboarding. Layers where access and data outlive a transition. */
L.layers = [['device', 'Device'], ['hub', 'Hub'], ['cloud', 'Cloud account'], ['integration', 'Integrations'], ['vendor', 'Vendors'], ['backup', 'Backups']];
/* For each transition: what remains at each layer under three levels of care.
 * r = what remains after a factory reset only; c = after the offboarding checklist;
 * t = after the checklist plus tombstones (removals re-applied on sync and restore). '' = nothing remains. */
L.transitions = [
  { id: 'tr_phone', title: 'Theo’s old phone becomes Mira’s', who: 'Theo; Mira', when: 'Oct 14',
    rows: {
      device: ['Nothing reset: still signed in as Theo — his mail, photos, messages and location sharing', '', ''],
      hub: ['Still “Theo” in the presence group: when Mira comes home, the house thinks Theo did', '', ''],
      cloud: ['Still Theo’s trusted device: it receives his sign-in codes', '', ''],
      integration: ['“Welcome home” disarms and unlocks for “Theo” — who is a ten-year-old', '', ''],
      vendor: ['The location SDK files Mira’s movements as Theo’s', 'The SDK’s copy of past arrivals (no deletion path)', 'The SDK’s copy of past arrivals (no deletion path)'],
      backup: ['Hub backup lists it as Theo’s', 'Hub backup lists it — a restore brings it back', ''] } },
  { id: 'tr_router', title: 'The old router, sold online', who: 'Theo; a stranger', when: 'Last year',
    rows: {
      device: ['The Wi-Fi password, the guest network, every family device’s name, the camera port forwards', '', ''],
      hub: ['—', '—', '—'],
      cloud: ['Still registered to Theo in the router maker’s app', '', ''],
      integration: ['—', '—', '—'],
      vendor: ['—', '—', '—'],
      backup: ['A configuration backup in the router app', 'The configuration backup stays until deleted', ''] } },
  { id: 'tr_car', title: 'Theo sells the car', who: 'Theo; the next owner', when: 'Planned',
    rows: {
      device: ['Contacts, recent destinations and the garage link stay in the head unit unless reset', '', ''],
      hub: ['“Warm the car” routine points at a car Theo no longer owns', '', ''],
      cloud: ['Theo’s carmaker account can still locate, unlock and start it', '', ''],
      integration: ['The garage opens for the car — and its new owner', '', ''],
      vendor: ['The carmaker keeps trip history under its own policy', 'Trip history under the carmaker’s policy (request deletion)', 'Trip history under the carmaker’s policy (request deletion)'],
      backup: ['—', '—', '—'] } },
  { id: 'tr_alex', title: 'Alex no longer lives here', who: 'Theo (admin); Alex', when: 'Since 2025',
    rows: {
      device: ['An old fingerprint on the lock', '', ''],
      hub: ['The thermostat ecosystem remains a controller of the lock', 'The fabric stays — with Alex removed from that household', 'The fabric stays — with Alex removed from that household'],
      cloud: ['Alex is still a member of the thermostat ecosystem household', '', ''],
      integration: ['Home/Away and lock state visible to Alex', '', ''],
      vendor: ['—', '—', '—'],
      backup: ['Hub backup still holds Alex’s old code', 'Hub backup still holds the old code — a restore brings it back', ''] } },
  { id: 'tr_codes', title: 'The plumber, the cleaner, the babysitter', who: 'Dana (admin)', when: 'Every job',
    rows: {
      device: ['Codes on the lock stay valid', 'Codes deleted — once the lock has synced', 'Codes deleted — once the lock has synced'],
      hub: ['Schedules remain', '', ''],
      cloud: ['Codes listed as active', '', ''],
      integration: ['CodeHand’s token can still unlock', '', ''],
      vendor: ['CodeHand keeps job history 30 days (contract)', 'Job history 30 days', 'Job history 30 days'],
      backup: ['Backups hold every code ever issued', 'Backups hold deleted codes', ''] } },
  { id: 'tr_house', title: 'Dana and Theo sell the house', who: 'Both; the buyers', when: 'Someday',
    rows: {
      device: ['Lock codes, fingerprints and face labels stay on the devices', '', ''],
      hub: ['The hub still belongs to Dana’s account — remotely controllable', '', ''],
      cloud: ['Clips, door history and energy data stay in Dana’s account', 'Exported, then deleted', 'Exported, then deleted'],
      integration: ['Three ecosystems still control the lock and garage', '', ''],
      vendor: ['Keystone still monitors the new owners’ alarm under Theo’s name', '', ''],
      backup: ['Hub backup can restore the old household onto the new owners’ hub', 'Backups expire in 365 days', ''] } }
];
L.care = [['r', 'As it usually goes'], ['c', 'Offboarding checklist'], ['t', 'Checklist + tombstones']];

/* The Command Center's offboarding workflows: steps across layers, with the last synthetic run. */
L.workflows = [
  { id: 'wf_member', name: 'Remove one household member without breaking everyone else',
    steps: [['cloud', 'Remove the member from the Northstar Home household', 'done'], ['hub', 'Remove them from presence groups and routines', 'done'], ['device', 'Delete their codes and fingerprints on every lock', 'done'],
      ['integration', 'Check every other controller’s household for them', 'unknown'], ['backup', 'Tombstone the member so a restore cannot bring them back', 'failed']] },
  { id: 'wf_former', name: 'Revoke a former partner or tenant',
    steps: [['cloud', 'Plan with the person at risk first: removal can notify the person removed', 'done'], ['cloud', 'Remove from every account: Northstar Home, the other ecosystems, location sharing', 'failed'],
      ['device', 'Delete codes and fingerprints; change the Wi-Fi password', 'done'], ['integration', 'Remove or downgrade other controllers on the lock', 'failed'], ['backup', 'Tombstone their identities', 'failed']] },
  { id: 'wf_codes', name: 'Expire guest and contractor codes',
    steps: [['cloud', 'End date on every non-resident code', 'failed'], ['device', 'Confirm deletion on the lock, not just in the cloud', 'done'], ['integration', 'Revoke partner tokens when the job ends', 'failed'], ['backup', 'Tombstone deleted codes', 'failed']] },
  { id: 'wf_transfer', name: 'Transfer ownership of the home',
    steps: [['cloud', 'Export, then delete the household’s history', 'unknown'], ['device', 'Factory-reset each device', 'unknown'], ['hub', 'Remove every fabric', 'unknown'], ['vendor', 'Close the monitoring contract', 'unknown'], ['backup', 'Delete hub backups', 'unknown']] },
  { id: 'wf_vehicle', name: 'Sell a vehicle',
    steps: [['device', 'Reset the head unit: contacts, destinations, garage link, profiles', 'unknown'], ['cloud', 'Remove the car from the carmaker account', 'unknown'], ['integration', 'Delete “Warm the car” and the garage link', 'done'], ['vendor', 'Ask the carmaker to delete trip history', 'unknown']] },
  { id: 'wf_device', name: 'Sell or hand down a phone, tablet, router or speaker',
    steps: [['cloud', 'Sign out and remove as a trusted device', 'done'], ['hub', 'Remove from presence groups', 'failed'], ['device', 'Factory reset', 'done'], ['backup', 'Tombstone in hub backups', 'failed']] },
  { id: 'wf_history', name: 'Delete voice, video, biometric and presence histories',
    steps: [['cloud', 'Doorbell clips', 'done'], ['cloud', 'Face templates — labelled and unlabelled', 'failed'], ['device', 'Fingerprints on the lock', 'done'], ['cloud', 'Presence history', 'done'],
      ['vendor', 'The location SDK’s copy of presence', 'unknown'], ['integration', 'Voice recordings and transcripts in the voice assistant', 'unknown'], ['backup', 'Backups', 'failed']] },
  { id: 'wf_restore', name: 'Keep old identities from returning on sync or restore',
    steps: [['backup', 'Tombstones for members, codes, devices and fabrics', 'failed'], ['hub', 'Re-apply tombstones after every restore', 'failed'], ['cloud', 'Restore drill with a deleted canary code, monthly', 'failed']] }
];

/* Dana's autumn at home: the moments the essay's chapter follows. */
L.timeline = [
  ['Sep 8',  'guest',   'Mira lets herself in at 15:40', 'The house concludes: a child is home alone.'],
  ['Sep 12', 'guest',   'Lena stays the night', 'Four devices hear her; she agreed to none of them.'],
  ['Sep 20', 'routine', '“Welcome home” fires at 16:52', 'Nobody is home. The alarm disarms; the garage door unlocks.'],
  ['Sep 23', 'infer',   'The kitchen reads out Dana’s appointment', '“Prenatal appointment, 16:00.” Ines and Mira are in the room.'],
  ['Oct 3',  'network', 'Dana opens her clinic portal on library Wi-Fi', 'The page is encrypted. The envelope is not.'],
  ['Oct 14', 'oldkeys', 'Theo hands his old phone to Mira', 'It is still “Theo” to the house.'],
  ['Oct 20', 'door',    'The cloud goes down for four hours', 'The keypad works. Remote unlock doesn’t. The deleted code still does.']
];
})();
