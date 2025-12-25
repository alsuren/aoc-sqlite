// Default template shown when no solution exists
// Max line length: 32 chars (fits before mobile breakpoint)
export const DEFAULT_SOLUTION = `-- Add your solution here.

INSERT INTO output
  (progress, result)
SELECT
  1.0, concat('answer: ', line)
FROM input_data
LIMIT 1;
`

export const MAX_DEFAULT_LINE_LENGTH = 32
