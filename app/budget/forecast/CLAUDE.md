# Forecast Sub-feature

**Read first:** `docs/budget/goals-forecast.md`

## Touch only

- `app/budget/forecast/page.tsx`
- `app/components/budget/ForecastClient.tsx`

## Dependencies to know

- Imports `Goal` from `GoalsPageClient.tsx`
- Imports `UnifiedAccount` from `AccountsPageClient.tsx`
- `forecast_settings` is a single row per user (user_id PK) — always upsert, never insert

## Do not touch

- Goals, targets, accounts, transactions, recurring, import, categories routes
