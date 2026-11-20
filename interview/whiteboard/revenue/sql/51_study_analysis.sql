SELECT variant,
       task,
       count(*)                                                       AS n,
       round(100.0 * avg(correct::int))                               AS pct_correct,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)::int      AS median_s,
       round(100.0 * avg((NOT correct AND confidence >= 4)::int))     AS pct_confidently_wrong
FROM study_response
GROUP BY variant, task
ORDER BY task, variant DESC;
