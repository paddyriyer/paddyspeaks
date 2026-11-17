-- One person, one voice per media second. Taps measure intensity, not headcount:
-- eleven taps on fire is ONE fire voice with intensity 10 (capped).
CREATE VIEW reaction_voice AS
SELECT DISTINCT ON (b.session_id, b.match_id, b.media_sec)
       b.match_id, b.media_sec, b.region, b.session_id, b.account_id,
       b.device_fp, b.asn, b.edge_received_at, t.emoji,
       LEAST(t.taps, 10) AS intensity
FROM reaction_batch b
JOIN reaction_tap   t USING (session_id, batch_seq)
WHERE b.admission = 'admitted'
ORDER BY b.session_id, b.match_id, b.media_sec, t.taps DESC, t.emoji;
