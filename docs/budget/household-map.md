# Budget — Household Map

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/household-map` | `app/budget/household-map/page.tsx` | Net-worth split by owner — hub diagram, risk signals, per-owner account zones |

## Components

| File | Purpose |
|------|---------|
| `HouseholdMapClient.tsx` | Renders the hub SVG diagram, the Signals grid, and the per-owner zone panels. Pure presentational — all aggregation happens in `page.tsx`. |

## Schema (relevant tables)

```sql
accounts (id, name, type, institution, current_balance, is_active, owner, exclude_from_net_worth)
synced_accounts (provider_account_id, name, type, type_override, current_balance, owner, is_hidden, exclude_from_net_worth)
household_members (id, full_name, display_name, color, sort_order, is_shared)
transactions (amount, transacted_at, is_transfer, category_id -> categories.is_income)
```

## Key notes

- Read-only page — no writes to `accounts`, `synced_accounts`, or `transactions`.
- Account-type unification (`syncedType`/`manualType` → `cash | investment | credit | loan | vehicle`)
  is duplicated from `app/budget/accounts/page.tsx` rather than shared, matching the existing
  duplication between `accounts/page.tsx` and `goals/page.tsx`.
- Zones are built from `household_members`, not hardcoded names: one zone per `is_shared = false`
  member (matched to accounts via `account.owner === member.full_name`), plus one "Joint" zone
  aggregating every `is_shared = true` member's accounts. The Joint zone's label/color come from
  that member row so a rename in Settings propagates automatically.
- Average monthly spend = last 3 *complete* calendar months of expense transactions
  (`is_transfer = false` — same rule as Dashboard/Cash Flow/Targets),
  divided by however many of those months actually have transaction data.
- "Runway with investments" intentionally includes retirement/HSA balances (the schema has no
  field distinguishing liquid brokerage from retirement accounts within `type: investment`) — the
  signal's body copy calls this out rather than silently overstating liquidity.
- Signal severity thresholds (liquidity <1/<3 months, runway <3/<6 months, concentration >50%/≥25%,
  joint share 0%) are this page's own judgment calls, not derived from another feature — adjust
  freely if they don't match how you actually want to be warned.
