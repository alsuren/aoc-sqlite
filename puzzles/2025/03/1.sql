


INSERT INTO output (progress, result)
WITH RECURSIVE
split as (
  select
    row_number() over (order by '') as input_row,
    cast(substr(line, 1,1) as INTEGER) as val, 
    substr(line, 2) as rest
  from input_data
union all
  select
    input_row,
    cast(substr(rest, 1,1) as INTEGER) as val, 
    substr(rest, 2) as rest
  from split
  where substr(rest, 1,1) != ''
),

just_split as (
  select 
   row_number() OVER (partition by input_row order by '') as input_column, 
   input_row,
   val

  from split
)

,

joined as (
  select
    left_split.input_row,
    left_split.val as left_val,
    right_split.val as right_val
  from
    just_split as left_split
    join just_split as right_split
    on left_split.input_row = right_split.input_row -- cross product
    where left_split.input_column < right_split.input_column
),

maxes as (
  select max(10*left_val + right_val) as val from joined group by input_row
)

-- select 'split', concat_ws(' ', n, ':', c, rest) from split
-- select 1, max(c) from split group by n
-- union all
-- select 1, max(c) from split group by n

-- select 'just_split', concat_ws(
--     ' ',
--     input_row,
--     input_column, 
--     val) from just_split

-- union all

-- select 'joined', concat_ws(' ', input_row, left_val, right_val) from joined

select 'maxes', val from maxes

union all

select 1, sum(val) from maxes
