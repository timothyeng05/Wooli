alter table forecast_income_streams
  add column if not exists tax_rate numeric(5,2) not null default 40;
