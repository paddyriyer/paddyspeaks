-- Three signals, each weak alone. Computed BEFORE the mood is summed: once a
-- scripted voice is in a total, only the raw batches can take it out again.
CREATE TABLE session_integrity AS
WITH cadence AS (            -- humans jitter; scripts keep perfect time
    SELECT session_id,
           count(*)                                   AS batches,
           stddev_samp(gap_ms)                        AS gap_jitter_ms
    FROM (
        SELECT session_id,
               extract(epoch FROM client_sent_at
                   - lag(client_sent_at) OVER (PARTITION BY session_id
                                               ORDER BY client_sent_at)) * 1000 AS gap_ms
        FROM reaction_batch
    ) g
    WHERE gap_ms IS NOT NULL
    GROUP BY session_id
), fp_fanin AS (             -- one device fingerprint, many "people"
    SELECT device_fp, count(DISTINCT session_id) AS sessions_on_fp
    FROM reaction_batch
    GROUP BY device_fp
), s AS (
    SELECT DISTINCT ON (b.session_id)
           b.session_id, b.account_id, b.device_fp, b.asn,
           m.starts_at - a.created_at                 AS account_age
    FROM reaction_batch b
    JOIN dim_match m USING (match_id)
    LEFT JOIN dim_account a USING (account_id)
    ORDER BY b.session_id
)
SELECT s.session_id, s.asn,
       COALESCE(c.batches >= 20 AND c.gap_jitter_ms < 5, false)  AS metronomic,
       f.sessions_on_fp >= 25                                   AS shared_device,
       s.account_age < interval '1 day'                         AS new_account,
       -- two independent signals, never one: a six makes honest crowds synchronous too
       ( (COALESCE(c.batches >= 20 AND c.gap_jitter_ms < 5, false))::int
       + (f.sessions_on_fp >= 25)::int
       + (s.account_age < interval '1 day')::int ) >= 2          AS excluded
FROM s
JOIN fp_fanin f USING (device_fp)
LEFT JOIN cadence c USING (session_id);
