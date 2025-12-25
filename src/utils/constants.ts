// Default template shown when no solution exists
export const DEFAULT_SOLUTION = `-- Read from input_data table (column: line)
-- Write to output table (columns: progress, result)
INSERT INTO output (progress, result)
SELECT 1.0, 'answer here' FROM input_data LIMIT 1;
`
