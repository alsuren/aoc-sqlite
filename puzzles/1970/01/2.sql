-- Progressive completion test
-- Uses a counter to simulate incremental progress
CREATE TABLE IF NOT EXISTS progress_counter (run_count INTEGER);

-- Initialize counter if needed
INSERT INTO progress_counter
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM progress_counter);

-- Increment the counter
UPDATE progress_counter SET run_count = run_count + 1;

-- Calculate progress based on run count (completes after 3 runs)
INSERT INTO output (progress, result)
SELECT 
  CAST(run_count AS REAL) / 3.0 as progress,
  CASE 
    WHEN run_count >= 3 THEN 'completed'
    ELSE 'working...'
  END as result
FROM progress_counter;
