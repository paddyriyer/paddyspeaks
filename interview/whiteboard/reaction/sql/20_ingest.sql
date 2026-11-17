-- Idempotent ingest. The stream sink calls this once per client batch.
-- A retry carries the same (session_id, batch_seq), so the second call
-- inserts nothing and returns FALSE: duplicates cannot inflate the mood.
CREATE FUNCTION ingest_batch(p JSONB) RETURNS BOOLEAN
LANGUAGE sql AS $$
    WITH b AS (
        INSERT INTO reaction_batch (session_id, batch_seq, account_id, device_fp, asn,
                                    region, match_id, media_sec,
                                    client_sent_at, edge_received_at, admission)
        VALUES ((p->>'session_id')::uuid, (p->>'batch_seq')::int,
                (p->>'account_id')::bigint, p->>'device_fp', (p->>'asn')::int,
                p->>'region', (p->>'match_id')::int, (p->>'media_sec')::int,
                (p->>'client_sent_at')::timestamptz, (p->>'edge_received_at')::timestamptz,
                p->>'admission')
        ON CONFLICT (session_id, batch_seq) DO NOTHING
        RETURNING session_id, batch_seq
    ), t AS (
        INSERT INTO reaction_tap (session_id, batch_seq, emoji, taps)
        SELECT b.session_id, b.batch_seq, e.key, LEAST(e.value::int, 50)
        FROM b CROSS JOIN jsonb_each_text(p->'taps') AS e
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM b);
$$;
