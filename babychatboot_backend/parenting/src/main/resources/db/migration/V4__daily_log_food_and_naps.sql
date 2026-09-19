-- Additive only: existing records remain unrecorded (NULL), never zero.
ALTER TABLE daily_logs
    ADD COLUMN solid_food_name varchar(100),
    ADD COLUMN solid_food_amount integer,
    ADD COLUMN nap_end_time timestamp(6);
