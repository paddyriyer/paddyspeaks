-- Replace the green "Data Verified" check with a sentence that can be wrong:
-- what was checked, for which period, when, and what failed.
SELECT d.display_name,
       format('%s · %s · month by %s (%s) · owner: %s · v%s',
              c.period, d.purpose, d.time_basis, d.time_zone, d.owner_role, d.version) AS context,
       format('%s of %s checks passed', count(*) FILTER (WHERE c.passed), count(*))   AS status,
       string_agg(CASE WHEN NOT c.passed THEN c.check_name || ': ' || c.detail END, '; ')
                                                                                       AS failing,
       to_char(max(c.checked_at) AT TIME ZONE d.time_zone, 'YYYY-MM-DD HH24:MI')
           || ' ' || d.time_zone                                                       AS as_of
FROM metric_definition d
JOIN metric_check c USING (metric_key)
WHERE c.period = '2026-10'
GROUP BY d.metric_key, d.display_name, c.period, d.purpose, d.time_basis, d.time_zone,
         d.owner_role, d.version
ORDER BY d.display_name;
