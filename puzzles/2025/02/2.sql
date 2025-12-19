
WITH RECURSIVE ranges AS (
    SELECT
        SUBSTR(line, 1, INSTR(line, ',') - 1) AS part,
        SUBSTR(line, INSTR(line, ',') + 1) AS remainder
    FROM
        input_data
    UNION ALL
    SELECT
        SUBSTR(remainder, 0, case when INSTR(remainder, ',') then INSTR(remainder, ',') else length(remainder) + 1 end) AS part,
        SUBSTR(remainder, case when INSTR(remainder, ',') then INSTR(remainder, ',') else length(remainder) end + 1) AS remainder
    FROM
        ranges
    WHERE
        -- why is this the 'part' from the input and not the output? :@
        part != ''
),
clean_ranges as (
    select 
        cast(SUBSTR(part, 1, INSTR(part, '-') - 1) as integer) AS range_start,
        cast(SUBSTR(part, INSTR(part, '-') + 1) as integer) AS range_end
    from ranges where part != ''
),
vals (val, range_end) AS (
    SELECT
        range_start as val,
        range_end
    FROM
        clean_ranges
    UNION ALL
    SELECT
        val + 1,
        range_end
    FROM
        vals
    WHERE
        -- FIXME: why is this the column from the input and not the output? :@
        val + 1 <= range_end
),
str_vals as (
    select val, cast(val as text) as str_val
    from vals
),
split_vals as (
    select
        val,
        length(str_val) as len,
        length(str_val) / 2 as middle,
        substring(str_val, 0, 1 + length(str_val) / 2) as start_val,
        substring(str_val, 1 + length(str_val) / 2) as end_val
    from str_vals
),
filtered_vals as (
    select val, str_val,
    -- there doesn't seem to be a repeat(string, reps), so https://stackoverflow.com/questions/11568496/how-to-emulate-repeat-in-sqlite
    -- we use max(..., 2) to make sure there are at least 2 repeats
        replace(printf('%.' || max(length(str_val), 2) || 'c', '/'), '/', substring(str_val, 1, 1)) as eq_1,
        replace(printf('%.' || max((length(str_val) / 2), 2) || 'c', '/'), '/', substring(str_val, 1, 2)) as eq_2,
        replace(printf('%.' || max((length(str_val) / 3), 2) || 'c', '/'), '/', substring(str_val, 1, 3)) as eq_3,
        replace(printf('%.' || max((length(str_val) / 4), 2) || 'c', '/'), '/', substring(str_val, 1, 4)) as eq_4,
        replace(printf('%.' || max((length(str_val) / 5), 2) || 'c', '/'), '/', substring(str_val, 1, 5)) as eq_5,
        replace(printf('%.' || max((length(str_val) / 6), 2) || 'c', '/'), '/', substring(str_val, 1, 6)) as eq_6,
        replace(printf('%.' || max((length(str_val) / 7), 2) || 'c', '/'), '/', substring(str_val, 1, 7)) as eq_7,
        replace(printf('%.' || max((length(str_val) / 8), 2) || 'c', '/'), '/', substring(str_val, 1, 8)) as eq_8,
        replace(printf('%.' || max((length(str_val) / 9), 2) || 'c', '/'), '/', substring(str_val, 1, 9)) as eq_9
    from str_vals
)
insert into output

select 1.0 as progress, sum(val) 
from filtered_vals
where
    false 
    or str_val = eq_1
    or str_val = eq_2
    or str_val = eq_3
    or str_val = eq_4
    or str_val = eq_5
    or str_val = eq_6

-- select 
--     1.0 as progress, 
--     concat_ws(
--         ' ' ,
--         'val', val
--         ,
--         'eq_1', str_val == eq_1,
--         'eq_2', str_val == eq_2,
--         'eq_3', str_val == eq_3,
--         'eq_4', str_val == eq_4,
--         'eq_5', str_val == eq_5,
--         'eq_6', str_val == eq_6
--     ) 
-- from filtered_vals
-- where 
--     false
--     or str_val = eq_1
--     or str_val = eq_2
--     or str_val = eq_3
--     or str_val = eq_4
--     or str_val = eq_5
--     or str_val = eq_6
-- order by val

-- select 
--     1.0 as progress, 
--     concat_ws(
--         ' ' ,
--         'range_start', range_start,
--         'range_end', range_end
--     ) 
-- from clean_ranges
-- where range_start < 10001000 and 10001000 <= range_end
