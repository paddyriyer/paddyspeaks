\set ON_ERROR_STOP on
SET TIME ZONE 'UTC';
DROP SCHEMA IF EXISTS r3 CASCADE; CREATE SCHEMA r3; SET search_path = r3;

-------------------- R3-01 booking (OLTP core) --------------------
CREATE TABLE event (event_id BIGINT PRIMARY KEY, venue_id BIGINT NOT NULL, name TEXT NOT NULL, onsale_at TIMESTAMPTZ NOT NULL, starts_at TIMESTAMPTZ NOT NULL);
CREATE TABLE event_seat (
  event_id BIGINT NOT NULL REFERENCES event, seat_id BIGINT NOT NULL, price_tier_id INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','held','sold')),
  hold_id UUID, held_until TIMESTAMPTZ, version INT NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, seat_id),
  CHECK ((status = 'held') = (hold_id IS NOT NULL AND held_until IS NOT NULL)));
CREATE TABLE booking (booking_id BIGSERIAL PRIMARY KEY, buyer_id BIGINT NOT NULL, event_id BIGINT NOT NULL REFERENCES event,
  status TEXT NOT NULL CHECK (status IN ('confirmed','partially_cancelled','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE booking_item (booking_item_id BIGSERIAL PRIMARY KEY, booking_id BIGINT NOT NULL REFERENCES booking,
  event_id BIGINT NOT NULL, seat_id BIGINT NOT NULL, price_cents INT NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('active','moved','cancelled')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(), valid_to TIMESTAMPTZ,
  FOREIGN KEY (event_id, seat_id) REFERENCES event_seat);
CREATE UNIQUE INDEX one_active_item_per_seat ON booking_item (event_id, seat_id) WHERE status = 'active';
CREATE TABLE booking_audit (audit_id BIGSERIAL PRIMARY KEY, booking_id BIGINT NOT NULL, booking_item_id BIGINT,
  action TEXT NOT NULL, actor TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}', at TIMESTAMPTZ NOT NULL DEFAULT now());

INSERT INTO event VALUES (1, 9, 'Final', '2026-09-14 10:00', '2026-10-01 19:00');
INSERT INTO event_seat (event_id, seat_id, price_tier_id, status) SELECT 1, g, CASE WHEN g <= 2 THEN 1 ELSE 2 END, 'available' FROM generate_series(1,4) g;

-- hold: two buyers race for seat 4; the conditional UPDATE lets exactly one win
WITH h AS (UPDATE event_seat SET status='held', hold_id='00000000-0000-0000-0000-00000000000a', held_until=now()+interval '8 minutes', version=version+1
           WHERE event_id=1 AND seat_id = ANY('{4}') AND (status='available' OR (status='held' AND held_until < now())) RETURNING seat_id)
SELECT 'buyer A held', count(*) FROM h;
WITH h AS (UPDATE event_seat SET status='held', hold_id='00000000-0000-0000-0000-00000000000b', held_until=now()+interval '8 minutes', version=version+1
           WHERE event_id=1 AND seat_id = ANY('{4}') AND (status='available' OR (status='held' AND held_until < now())) RETURNING seat_id)
SELECT 'buyer B held', count(*) FROM h;
-- confirm A
BEGIN;
UPDATE event_seat SET status='sold', hold_id=NULL, held_until=NULL, version=version+1
 WHERE event_id=1 AND seat_id=4 AND status='held' AND hold_id='00000000-0000-0000-0000-00000000000a' AND held_until >= now();
INSERT INTO booking (buyer_id, event_id, status, idempotency_key) VALUES (501, 1, 'confirmed', 'chk-A-1') RETURNING booking_id;
INSERT INTO booking_item (booking_id, event_id, seat_id, price_cents, status) VALUES (1, 1, 4, 9000, 'active');
INSERT INTO booking_audit (booking_id, booking_item_id, action, actor) VALUES (1, 1, 'confirmed', 'buyer:501');
COMMIT;
-- retry of the same checkout is rejected by the idempotency key
INSERT INTO booking (buyer_id, event_id, status, idempotency_key) VALUES (501, 1, 'confirmed', 'chk-A-1') ON CONFLICT (idempotency_key) DO NOTHING;
SELECT 'bookings', count(*) FROM booking;

-------------------- R3-01 analytics --------------------
CREATE TABLE dim_event (event_key INT PRIMARY KEY, event_id BIGINT, name TEXT, onsale_at TIMESTAMPTZ);
CREATE TABLE dim_price_tier (tier_key INT PRIMARY KEY, price_tier_id INT, tier_name TEXT, valid_from TIMESTAMPTZ, valid_to TIMESTAMPTZ);
CREATE TABLE fact_inventory_snapshot (snapshot_at TIMESTAMPTZ, event_key INT, tier_key INT, capacity INT, sold INT, held INT,
  PRIMARY KEY (snapshot_at, event_key, tier_key));
CREATE TABLE fact_hold (hold_id UUID PRIMARY KEY, event_key INT, buyer_id BIGINT, seats INT, created_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('converted','expired','released','open')), outcome_at TIMESTAMPTZ);
INSERT INTO dim_event VALUES (1, 1, 'Final', '2026-09-14 10:00');
INSERT INTO dim_price_tier VALUES (1, 1, 'Floor', '2026-01-01', NULL), (2, 2, 'Upper', '2026-01-01', NULL);
INSERT INTO fact_inventory_snapshot VALUES ('2026-09-14 11:00',1,1,2,1,1), ('2026-09-14 11:00',1,2,2,2,0), ('2026-09-14 10:00',1,1,2,0,2);
INSERT INTO fact_hold VALUES (gen_random_uuid(),1,1,2,'2026-09-14 10:01','converted','2026-09-14 10:05'),
 (gen_random_uuid(),1,2,1,'2026-09-14 10:20','expired','2026-09-14 10:28'),
 (gen_random_uuid(),1,3,1,'2026-09-14 10:50','released','2026-09-14 10:52'),
 (gen_random_uuid(),1,4,1,'2026-09-14 11:30','expired','2026-09-14 11:38');
-- Q1 sell-through by event and tier, latest snapshot
SELECT e.name, t.tier_name, ROUND(100.0 * s.sold / NULLIF(s.capacity, 0), 1) AS sell_through_pct
FROM fact_inventory_snapshot s
JOIN dim_event e USING (event_key) JOIN dim_price_tier t USING (tier_key)
WHERE s.snapshot_at = (SELECT MAX(snapshot_at) FROM fact_inventory_snapshot x WHERE x.event_key = s.event_key)
ORDER BY 1, 2;
-- Q2 hold abandonment in the first hour of on-sale (closed holds only)
SELECT e.name,
       COUNT(*) FILTER (WHERE h.outcome IN ('expired','released')) AS abandoned,
       COUNT(*) FILTER (WHERE h.outcome <> 'open') AS closed_holds,
       ROUND(100.0 * COUNT(*) FILTER (WHERE h.outcome IN ('expired','released')) / NULLIF(COUNT(*) FILTER (WHERE h.outcome <> 'open'), 0), 1) AS abandonment_pct
FROM fact_hold h JOIN dim_event e USING (event_key)
WHERE h.created_at >= e.onsale_at AND h.created_at < e.onsale_at + INTERVAL '1 hour'
GROUP BY e.name;

-------------------- R3-02 trips + SCD2 --------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for the EXCLUDE constraint on a BIGINT key
CREATE TABLE dim_driver (driver_sk BIGSERIAL PRIMARY KEY, driver_id BIGINT NOT NULL, service_tier TEXT NOT NULL, vehicle_type TEXT,
  valid_from TIMESTAMPTZ NOT NULL, valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity', is_current BOOLEAN NOT NULL,
  EXCLUDE USING gist (driver_id WITH =, tstzrange(valid_from, valid_to) WITH &&));

CREATE TABLE dim_city (city_key INT PRIMARY KEY, city_name TEXT, tz TEXT);
CREATE TABLE fact_trip (   -- accumulating snapshot, grain: one row per trip
  trip_id BIGINT PRIMARY KEY, city_key INT NOT NULL, driver_id BIGINT, rider_id BIGINT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL, matched_at TIMESTAMPTZ, arrived_at TIMESTAMPTZ, started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, cancelled_by TEXT CHECK (cancelled_by IN ('rider','driver','system')),
  surge_multiplier NUMERIC(4,2), fare_cents INT, last_event_lsn BIGINT NOT NULL);
INSERT INTO dim_city VALUES (1,'Lisbon','Europe/Lisbon'),(2,'Austin','America/Chicago');
INSERT INTO dim_driver (driver_id, service_tier, valid_from, valid_to, is_current) VALUES
 (42,'standard','2026-01-01','2026-09-10',false),(42,'premium','2026-09-10','infinity',true),(43,'standard','2026-01-01','infinity',true);
INSERT INTO fact_trip VALUES
 (1,1,42,7,'2026-09-08 08:00','2026-09-08 08:01','2026-09-08 08:07','2026-09-08 08:08','2026-09-08 08:30',NULL,NULL,1.0,1500,1),
 (2,1,42,8,'2026-09-11 09:00','2026-09-11 09:02','2026-09-11 09:06','2026-09-11 09:07','2026-09-11 09:20',NULL,NULL,1.3,1800,2),
 (3,1,42,9,'2026-09-11 18:00','2026-09-11 18:01',NULL,NULL,NULL,'2026-09-11 18:04','rider',1.0,NULL,3),
 (4,2,43,9,'2026-09-11 18:00','2026-09-11 18:03','2026-09-11 18:12','2026-09-11 18:13','2026-09-11 18:40',NULL,NULL,2.1,4200,4);
-- Q1 weekly completion rate by city and the driver's tier AT THE TIME OF THE TRIP
SELECT date_trunc('week', t.requested_at AT TIME ZONE c.tz)::date AS local_week, c.city_name, d.service_tier,
       COUNT(*) AS trips, COUNT(t.completed_at) AS completed,
       ROUND(100.0 * COUNT(t.completed_at) / COUNT(*), 1) AS completion_pct
FROM fact_trip t
JOIN dim_city c USING (city_key)
LEFT JOIN dim_driver d ON d.driver_id = t.driver_id AND t.requested_at >= d.valid_from AND t.requested_at < d.valid_to
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
-- Q2 median minutes from request to pickup, by city and local hour
SELECT c.city_name, EXTRACT(HOUR FROM t.requested_at AT TIME ZONE c.tz)::int AS local_hour,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM t.started_at - t.requested_at) / 60) AS median_min_to_pickup
FROM fact_trip t JOIN dim_city c USING (city_key)
WHERE t.started_at IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;

-------------------- R3-03 food delivery --------------------
CREATE TABLE fact_order_status_event (order_id BIGINT, status TEXT, source_app TEXT, device_ts TIMESTAMPTZ, server_ts TIMESTAMPTZ, event_id TEXT PRIMARY KEY);
CREATE TABLE fact_order (order_id BIGINT PRIMARY KEY, restaurant_id BIGINT, placed_at TIMESTAMPTZ, prep_started_at TIMESTAMPTZ, ready_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ);
INSERT INTO fact_order VALUES (1,77,'2026-09-14 12:00','2026-09-14 12:03','2026-09-14 12:15','2026-09-14 12:40'),
 (2,77,'2026-09-14 13:00','2026-09-14 13:01','2026-09-14 13:21','2026-09-14 13:50'),
 (3,77,'2026-09-15 12:00','2026-09-15 12:02','2026-09-15 12:10','2026-09-15 12:30');
INSERT INTO fact_order_status_event VALUES
 ('1','placed','customer','2026-09-14 12:00','2026-09-14 12:00:01','a'),('1','accepted','restaurant','2026-09-14 12:01','2026-09-14 12:01:02','b'),
 ('1','ready','restaurant','2026-09-14 12:15','2026-09-14 12:15:01','c'),('1','delivered','courier','2026-09-14 12:40','2026-09-14 12:40:03','d');
-- Q1 P90 prep minutes per restaurant per week
SELECT restaurant_id, date_trunc('week', placed_at)::date AS week,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ready_at - prep_started_at) / 60) AS p90_prep_min
FROM fact_order WHERE ready_at IS NOT NULL AND prep_started_at IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;
-- Q2 time in each state, from the authoritative (server-time) timeline
SELECT order_id, status, server_ts AS entered_at,
       LEAD(server_ts) OVER (PARTITION BY order_id ORDER BY server_ts, event_id) - server_ts AS time_in_state
FROM fact_order_status_event ORDER BY order_id, entered_at;

-------------------- R3-04 payments ledger --------------------
CREATE TABLE capture (capture_id BIGINT PRIMARY KEY, payment_intent_id BIGINT NOT NULL, psp TEXT NOT NULL, psp_reference TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0), currency CHAR(3) NOT NULL, captured_at TIMESTAMPTZ NOT NULL, UNIQUE (psp, psp_reference));
CREATE TABLE refund (refund_id BIGSERIAL PRIMARY KEY, capture_id BIGINT NOT NULL REFERENCES capture, idempotency_key TEXT NOT NULL UNIQUE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0), status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE ledger_entry (entry_id BIGSERIAL PRIMARY KEY, journal_id UUID NOT NULL, account TEXT NOT NULL, amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL, posted_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE fx_rate (rate_date DATE, currency CHAR(3), usd_per_unit NUMERIC(18,10), minor_units SMALLINT, PRIMARY KEY (rate_date, currency));
CREATE TABLE psp_settlement_line (psp TEXT, psp_reference TEXT, kind TEXT, amount_minor BIGINT, currency CHAR(3), settled_on DATE, PRIMARY KEY (psp, psp_reference, kind));
INSERT INTO capture VALUES (1,10,'pspA','A-1',10000,'EUR','2026-09-14 08:00'),(2,11,'pspA','A-2',5000,'EUR','2026-09-14 09:00'),(3,12,'pspB','B-1',250000,'JPY','2026-09-14 10:00'),(4,13,'pspB','B-2',700,'USD','2026-09-14 23:30');
INSERT INTO fx_rate VALUES ('2026-09-14','EUR',1.10,2),('2026-09-14','JPY',0.0068,0),('2026-09-14','USD',1,2);
INSERT INTO psp_settlement_line VALUES ('pspA','A-1','capture',10000,'EUR','2026-09-15'),('pspA','A-2','capture',4900,'EUR','2026-09-15'),
 ('pspB','B-1','capture',250000,'JPY','2026-09-16'),('pspB','B-9','capture',1200,'USD','2026-09-16');

-- refund with cap under concurrency: lock the capture row, then check the cap in the same transaction
BEGIN;
SELECT capture_id FROM capture WHERE capture_id = 1 FOR UPDATE;
INSERT INTO refund (capture_id, idempotency_key, amount_minor, status)
SELECT 1, 'rf-1', 6000, 'pending'
WHERE (SELECT COALESCE(SUM(amount_minor), 0) FROM refund WHERE capture_id = 1 AND status <> 'failed') + 6000
      <= (SELECT amount_minor FROM capture WHERE capture_id = 1)
ON CONFLICT (idempotency_key) DO NOTHING;
COMMIT;
BEGIN;
SELECT capture_id FROM capture WHERE capture_id = 1 FOR UPDATE;
INSERT INTO refund (capture_id, idempotency_key, amount_minor, status)
SELECT 1, 'rf-2', 6000, 'pending'
WHERE (SELECT COALESCE(SUM(amount_minor), 0) FROM refund WHERE capture_id = 1 AND status <> 'failed') + 6000
      <= (SELECT amount_minor FROM capture WHERE capture_id = 1)
ON CONFLICT (idempotency_key) DO NOTHING;
COMMIT;
SELECT 'refunds on capture 1', count(*), sum(amount_minor) FROM refund;
UPDATE refund SET status='succeeded', created_at='2026-09-14 15:00';

-- ledger postings for charge 100.00 EUR and partial refund 60.00 EUR; every journal sums to zero
INSERT INTO ledger_entry (journal_id, account, amount_minor, currency) VALUES
 ('11111111-1111-1111-1111-111111111111','psp_receivable:pspA', 10000,'EUR'),('11111111-1111-1111-1111-111111111111','rider_revenue', -10000,'EUR'),
 ('22222222-2222-2222-2222-222222222222','rider_revenue', 6000,'EUR'),('22222222-2222-2222-2222-222222222222','psp_receivable:pspA', -6000,'EUR');
SELECT 'unbalanced journals', count(*) FROM (SELECT journal_id FROM ledger_entry GROUP BY journal_id, currency HAVING SUM(amount_minor) <> 0) x;

-- Q1 daily net revenue by currency and in USD (captures minus succeeded refunds, booked on the capture's UTC day)
WITH moves AS (
  SELECT (c.captured_at AT TIME ZONE 'UTC')::date AS day, c.currency, c.amount_minor FROM capture c
  UNION ALL
  SELECT (r.created_at AT TIME ZONE 'UTC')::date, c.currency, -r.amount_minor FROM refund r JOIN capture c USING (capture_id) WHERE r.status = 'succeeded'
)
SELECT m.day, m.currency, SUM(m.amount_minor) AS net_minor,
       ROUND(SUM(m.amount_minor) / POWER(10::numeric, f.minor_units) * f.usd_per_unit, 2) AS net_usd,
       f.currency IS NULL AS fx_rate_missing          -- never drop a day silently because a rate is missing
FROM moves m LEFT JOIN fx_rate f ON f.rate_date = m.day AND f.currency = m.currency
GROUP BY m.day, m.currency, f.currency, f.minor_units, f.usd_per_unit ORDER BY 1, 2;

-- Q2 reconciliation: internal captures vs PSP settlement lines
SELECT COALESCE(c.psp, s.psp) AS psp, COALESCE(c.psp_reference, s.psp_reference) AS psp_reference,
       c.amount_minor AS ours, s.amount_minor AS theirs,
       CASE WHEN s.psp_reference IS NULL AND c.captured_at > TIMESTAMPTZ '2026-09-16 00:00' - INTERVAL '2 days' THEN 'pending_settlement'
            WHEN s.psp_reference IS NULL THEN 'missing_at_psp'
            WHEN c.capture_id IS NULL     THEN 'missing_internally'
            WHEN c.amount_minor <> s.amount_minor OR c.currency <> s.currency THEN 'amount_mismatch'
            ELSE 'matched' END AS recon_state
FROM capture c
FULL OUTER JOIN (SELECT * FROM psp_settlement_line WHERE kind = 'capture') s
  ON s.psp = c.psp AND s.psp_reference = c.psp_reference
ORDER BY 1, 2;
