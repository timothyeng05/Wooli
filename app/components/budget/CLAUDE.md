# Budget Components Index

Quick reference — one line per component. Load only what you need.

## Dashboard

| File | Notes |
|------|-------|
| `DashboardClient.tsx` | Budget progress, recent transactions, mini net worth chart, spending-vs-last-month chart |

## Shared / navigation

| File | Used by | Notes |
|------|---------|-------|
| `BudgetSidebar.tsx` | All budget pages | Sticky left nav — read-only for feature work |
| `BudgetMobileDrawer.tsx` | Mobile layout | Mobile nav (hamburger drawer) + unreviewed-count badge — mirrors `BudgetSidebar` |
| `MonthNav.tsx` | Overview, Transactions, Targets | Prev/next month navigation |
| `CategoryPicker.tsx` | Transactions, Forms, Recurring | Inline category selector — shared, wide blast radius |
| `catEmoji.ts` | Categories, TransactionList | `getCatEmoji()` + `CAT_EMOJI` map |

## Transactions

| File | Notes |
|------|-------|
| `TransactionList.tsx` | Full table with inline edit, search, filters |
| `TransactionForm.tsx` | Create/edit form for manual transactions |
| `TransactionDetail.tsx` | Read view for single transaction |
| `TransactionReviewSheet.tsx` | Slide-over quick review/edit |
| `FilterPanel.tsx` | Date + category filters used by TransactionList |
| `RecategorizeButton.tsx` | AI bulk re-categorize via Groq |
| `transaction-types.ts` | Shared TS types for transactions |

## Accounts

| File | Notes |
|------|-------|
| `AccountsPageClient.tsx` | Full accounts page — exports `UnifiedAccount` type |
| `PlaidLinkButton.tsx` | Opens Plaid Link modal |
| `SyncTransactionsButton.tsx` | Triggers Plaid sync |

## Settings (Categories + Institutions)

| File | Notes |
|------|-------|
| `CategoryManager.tsx` | Category tree editor (Expense / Income / Transfer sections) — page moved to `/budget/settings/categories` |
| `CategoryDetailClient.tsx` | Transactions scoped to one category |
| `InstitutionsManager.tsx` | Per-institution custom logo upload — `/budget/settings/institutions` |

## Recurring

| File | Notes |
|------|-------|
| `RecurringList.tsx` | Table of recurring rules |
| `RecurringForm.tsx` | Create/edit recurring rule |

## Import

| File | Notes |
|------|-------|
| `CsvImportClient.tsx` | Drag-drop upload + column mapping (Monarch, Copilot, generic) |

## Cash flow

| File | Notes |
|------|-------|
| `CashFlowClient.tsx` | Cash flow charts by month + owner (~816 lines) |

## Goals, Targets, Forecast

| File | Notes |
|------|-------|
| `GoalsPageClient.tsx` | Savings goals CRUD — exports `Goal` type |
| `BudgetTargetsClient.tsx` | Monthly category spend targets |
| `ForecastClient.tsx` | Net worth / retirement projection (~870 lines) |

## Onboarding

| File | Notes |
|------|-------|
| `OnboardingWizard.tsx` | Budget setup wizard (~914 lines) |
| `ResetOnboardingButton.tsx` | Dev/admin reset button |

## Dashboard widgets (used outside budget module)

| File | Notes |
|------|-------|
| `DashboardSpendingChart.tsx` | Monthly spend by category — used on main dashboard |
