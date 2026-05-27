alter table forecast_settings
  add column if not exists tim_age integer,
  add column if not exists tim_retirement_age integer,
  add column if not exists jess_age integer,
  add column if not exists jess_retirement_age integer;
