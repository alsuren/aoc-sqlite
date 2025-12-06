-- Test case that reads input and concatenates with a constant
INSERT INTO output (progress, result)
SELECT 1.0 as progress, 
       GROUP_CONCAT(line || ' world', '') as result
FROM input_data;
