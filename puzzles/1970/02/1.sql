-- Test case that reads input and concatenates with a constant

SELECT 1.0 as progress, 
       (SELECT GROUP_CONCAT(line || ' world', '') FROM input_data) as result;
