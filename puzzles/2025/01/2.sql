/*
You're sure that's the right password, but the door won't open. You knock, but nobody answers. You build a snowman while you think.

As you're rolling the snowballs for your snowman, you find another security document that must have fallen into the snow:

"Due to newer security protocols, please use password method 0x434C49434B until further notice."

You remember from the training seminar that "method 0x434C49434B" means you're actually supposed to count the number of times any click causes the dial to point at 0, regardless of whether it happens during a rotation or at the end of one.

Following the same rotations as in the above example, the dial points at zero a few extra times during its rotations:

    The dial starts by pointing at 50.
    The dial is rotated L68 to point at 82; during this rotation, it points at 0 once.
    The dial is rotated L30 to point at 52.
    The dial is rotated R48 to point at 0.
    The dial is rotated L5 to point at 95.
    The dial is rotated R60 to point at 55; during this rotation, it points at 0 once.
    The dial is rotated L55 to point at 0.
    The dial is rotated L1 to point at 99.
    The dial is rotated L99 to point at 0.
    The dial is rotated R14 to point at 14.
    The dial is rotated L82 to point at 32; during this rotation, it points at 0 once.

In this example, the dial points at 0 three times at the end of a rotation, plus three more times during a rotation. So, in this example, the new password would be 6.

Be careful: if the dial were pointing at 50, a single rotation like R1000 would cause the dial to point at 0 ten times before returning back to 50!

Using password method 0x434C49434B, what is the password to open the door?
*/

INSERT INTO output (progress, result)
WITH RECURSIVE
parsed as (
    -- we always start at 50
    select 50 as val
    union all
    select  CASE SUBSTR(line, 1, 1)
        when 'L' then -1 * cast(substr(line, 2) as integer)
        when 'R' then 1 * cast(substr(line, 2) as integer)
        END as val
    from input_data
),
rolling_sum as (
    select sum(val) over (ROWS UNBOUNDED PRECEDING) as val from parsed
),
pairs as (
    select val as curr, lag(val, -1) over (ROWS UNBOUNDED PRECEDING) as next
    from rolling_sum
),
normalized as (
    select
        floor(case when curr < next then curr else next end / 100.0) * 100 as offset,
        curr - floor(case when curr < next then curr else next end / 100.0) * 100 as curr,
        next - floor(case when curr < next then curr else next end / 100.0) * 100 as next
    from pairs
    -- it would have been nice to tidy this up in the above expression, but it was not to be
    where pairs.next is not null
),
crossings as (
    select 
        *, 
        -- This is a bit of a mess
        CASE
            -- if we finish on 0 then it counts as a crossing (but if we started on 0 then it cancels out)
            when mod(next, 100) = 0 and mod(curr, 100) != 0 and curr > next
                then floor(curr/100.0) - floor(next/100.0) +1
            -- if we started on 0 then leaving it doesn't count as a crossing (but if we finish on 0 then it cancels out)
            when mod(curr, 100) = 0 and mod(next, 100) != 0 and curr > next 
                then floor(curr/100.0) - floor(next/100.0) -1
            when curr > next 
                then floor(curr/100.0) - floor(next/100.0)
            when curr < next 
                then floor(next/100.0) - floor(curr/100.0)
            when curr = next 
                then 0
        END as val
    from normalized
)
-- FIXME: find a better way to debug things.
-- For now, it's possible to debug two things at the same time by outputting them with UNION ALL, e.g.
--   SELECT 0.5 as progress, val as result from rolling_sum
--   UNION ALL
--   ...
select 1.0 as progress, cast(sum(val) as integer) as result from crossings
;
