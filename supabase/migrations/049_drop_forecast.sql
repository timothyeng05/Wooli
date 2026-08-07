-- Forecast (net worth / retirement projection) removed. Drops the three
-- Forecast-only tables built by 027_forecast.sql, 029_forecast_ages.sql, and
-- 030_forecast_tax_rate.sql. household_members and budget_goals are shared
-- with other features (Accounts owner labels, Goals) and are untouched.
drop table if exists public.forecast_income_streams;
drop table if exists public.forecast_settings;
drop table if exists public.forecast_member_settings;
