
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
    where length(str_val) % 2 == 0
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
    select val from str_vals
    where 
    -- there doesn't seem to be a repeat(string, reps), so https://stackoverflow.com/questions/11568496/how-to-emulate-repeat-in-sqlite
        str_val = replace(printf('%.' || length(str_val) || 'c', '/'), '/', substring(str_val, 0, 1))
)
insert into output 
select 1.0 as progress, sum(val) from filtered_vals
-- select 
--     1.0 as progress, 
--     concat_ws(
--         ' ' ,
--         'val', val
--     ) 
-- from filtered_vals
-- order by val

-- select 
--     1.0 as progress, 
--     concat_ws(
--         ' ' ,
--         'range_start', range_start,
--         'range_end', range_end
--     ) 
-- from clean_ranges
-- where range_start > range_end

-- limit 12
