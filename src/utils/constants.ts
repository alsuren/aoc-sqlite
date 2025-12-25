// Default template shown when no solution exists
// Max line length: 30 chars (fits before mobile breakpoint)
export const DEFAULT_SOLUTION = `-- input_data table: line
-- output: progress, result
INSERT INTO output
  (progress, result)
SELECT 1.0, 'answer here'
FROM input_data LIMIT 1;
`

export const MAX_DEFAULT_LINE_LENGTH = 30
