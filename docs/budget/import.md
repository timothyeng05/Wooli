# Budget — CSV Import

## Routes

| Route | File | Notes |
|-------|------|-------|
| `/budget/import` | `app/budget/import/page.tsx` | Drag-drop CSV upload and column mapping |

## Components

| File | Purpose |
|------|---------|
| `CsvImportClient.tsx` | Full import UI — drag-drop upload, column mapping, preview, submit. Handles Monarch, Copilot, and generic CSV formats. |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/budget/import-csv` | Parse uploaded CSV and insert transactions |
| `POST /api/budget/import-balances` | Import account balances from CSV |

## Key notes

- Supported source formats: Monarch Money, Copilot, and generic (user maps columns manually).
- Dedup is based on `provider_transaction_id` (set to a hash for CSV imports) — re-importing the same file is safe.
- Category matching during import uses the category `name` field — exact match first, then keyword search.
- `import-balances` writes to `account_balance_history`, not `accounts.balance` directly.
