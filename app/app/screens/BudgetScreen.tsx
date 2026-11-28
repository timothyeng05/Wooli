"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  RecurringItemRecord,
  TransactionRecord,
} from "@/lib/cloudkit/schema";
import { Badge, Card, ChartCard, InspectorDrawer, Pill } from "@/app/components/ds";
import { BudgetForecastView, BudgetReportsView } from "./BudgetReports";

export type BudgetTab = "dashboard" | "accounts" | "transactions" | "plan" | "categories" | "recurring";
type BudgetSubView = "reports" | "forecast" | null;

export interface BudgetScreenProps {
  activeTab: BudgetTab;
  onSelectTab: (tab: BudgetTab) => void;
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  transactions: TransactionRecord[];
  recurringItems?: RecurringItemRecord[];
}

function money(amount: number, cents = false): string {
  const sign = amount < 0 ? "−" : "";
  return (
    sign +
    "$" +
    Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    })
  );
}

function signedMoney(amount: number, cents = true): string {
  if (amount > 0) return `+${money(amount, cents)}`;
  if (amount < 0) return money(amount, cents);
  return money(0, cents);
}

function isAssetKind(kindRaw: string): boolean {
  const k = kindRaw.toLowerCase();
  return k === "checking" || k === "savings" || k === "investment" || k === "other";
}

function accountGroupFor(kindRaw: string): "Cash" | "Credit Cards" | "Investments" | "Loans" {
  const k = kindRaw.toLowerCase();
  if (k === "credit") return "Credit Cards";
  if (k === "investment") return "Investments";
  if (k === "loan") return "Loans";
  return "Cash";
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  const today = dayKeyFromTs(Date.now());
  if (dayKey === today) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function reviewWindowStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
}

function monthBounds(offsetMonths: number): { start: number; end: number; label: string; isCurrent: boolean } {
  const now = new Date();
  const startD = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const endD = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return {
    start: startD.getTime(),
    end: endD.getTime(),
    label: startD.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    isCurrent: offsetMonths === 0,
  };
}

function downloadCsv(
  rows: TransactionRecord[],
  catById: Map<string, BudgetCategoryRecord>,
  acctById: Map<string, AccountRecord>,
) {
  const header = ["Date", "Merchant", "Category", "Account", "Amount", "Status", "Description"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const tx of rows) {
    const cat = tx.categoryId ? catById.get(tx.categoryId)?.name ?? "" : "Uncategorized";
    const acct = acctById.get(tx.accountId)?.nickname || acctById.get(tx.accountId)?.name || tx.accountId;
    const status = tx.isPending ? "Pending" : tx.needsReview ? "Needs Review" : "Cleared";
    lines.push(
      [
        new Date(tx.transactedAt).toISOString().slice(0, 10),
        escape(tx.customTitle || tx.payee || tx.description),
        escape(cat),
        escape(acct),
        tx.amount.toFixed(2),
        status,
        escape(tx.description),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wooli-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: "var(--weight-semibold)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-tertiary)",
  margin: "0 0 var(--space-8)",
};

export function BudgetScreen({
  activeTab,
  onSelectTab,
  accounts,
  categories,
  transactions,
  recurringItems = [],
}: BudgetScreenProps) {
  const [subView, setSubView] = useState<BudgetSubView>(null);
  const [lastPropTab, setLastPropTab] = useState<BudgetTab>(activeTab);
  const [initialCatFilter, setInitialCatFilter] = useState<string>("all");
  const [initialTypeFilter, setInitialTypeFilter] = useState<"all" | "review" | "expenses" | "income">("all");

  if (activeTab !== lastPropTab) {
    setLastPropTab(activeTab);
    setSubView(null);
  }

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctById = useMemo(() => new Map(accounts.map((a) => [a.providerAccountId, a])), [accounts]);
  const hiddenAccountIds = useMemo(
    () => new Set(accounts.filter((a) => a.isHidden || a.hideTransactions).map((a) => a.providerAccountId)),
    [accounts],
  );

  const visibleTxns = useMemo(
    () =>
      transactions
        .filter((t) => !t.isHidden && !t.isSplit && !hiddenAccountIds.has(t.accountId))
        .sort((a, b) => b.transactedAt - a.transactedAt),
    [transactions, hiddenAccountIds],
  );

  const handleNavigateTab = useCallback(
    (tab: BudgetTab, opts?: { categoryId?: string; filterMode?: "all" | "review" | "expenses" | "income" }) => {
      setSubView(null);
      if (opts?.categoryId) setInitialCatFilter(opts.categoryId);
      if (opts?.filterMode) setInitialTypeFilter(opts.filterMode);
      onSelectTab(tab);
    },
    [onSelectTab],
  );

  return (
    <div style={{ paddingBottom: "var(--space-40)" }}>
      {/* Top Field Notes Sub-navigation */}
      <nav
        aria-label="Budget sections"
        style={{
          maxWidth: 1120,
          margin: "0 auto var(--space-20)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          flexWrap: "wrap",
          paddingBottom: "var(--space-12)",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        {(
          [
            { id: "dashboard", label: "Dashboard" },
            { id: "transactions", label: "Transactions" },
            { id: "plan", label: "Plan" },
            { id: "accounts", label: "Accounts" },
            { id: "categories", label: "Categories" },
            { id: "recurring", label: "Recurring" },
          ] as const
        ).map((item) => (
          <Pill
            key={item.id}
            size="sm"
            active={subView === null && activeTab === item.id}
            onClick={() => handleNavigateTab(item.id)}
          >
            {item.label}
          </Pill>
        ))}
        <span style={{ width: 1, height: 18, background: "var(--border-hairline)", margin: "0 var(--space-4)" }} />
        <Pill
          size="sm"
          active={subView === "reports"}
          onClick={() => setSubView((v) => (v === "reports" ? null : "reports"))}
        >
          Reports &amp; Cash Flow
        </Pill>
        <Pill
          size="sm"
          active={subView === "forecast"}
          onClick={() => setSubView((v) => (v === "forecast" ? null : "forecast"))}
        >
          Forecast
        </Pill>
      </nav>

      {subView === "reports" ? (
        <BudgetReportsView visibleTxns={visibleTxns} catById={catById} acctById={acctById} />
      ) : subView === "forecast" ? (
        <BudgetForecastView
          accounts={accounts}
          visibleTxns={visibleTxns}
          catById={catById}
          recurringItems={recurringItems}
        />
      ) : activeTab === "dashboard" ? (
        <BudgetDashboard
          accounts={accounts}
          categories={categories}
          visibleTxns={visibleTxns}
          recurringItems={recurringItems}
          hiddenAccountIds={hiddenAccountIds}
          catById={catById}
          acctById={acctById}
          onNavigateTab={handleNavigateTab}
          onOpenSubView={setSubView}
        />
      ) : activeTab === "accounts" ? (
        <BudgetAccounts accounts={accounts} />
      ) : activeTab === "transactions" ? (
        <BudgetTransactions
          accounts={accounts}
          categories={categories}
          visibleTxns={visibleTxns}
          catById={catById}
          acctById={acctById}
          initialCatFilter={initialCatFilter}
          initialTypeFilter={initialTypeFilter}
        />
      ) : activeTab === "plan" ? (
        <BudgetPlanView categories={categories} visibleTxns={visibleTxns} catById={catById} />
      ) : activeTab === "categories" ? (
        <BudgetCategoriesView categories={categories} />
      ) : (
        <BudgetRecurringView
          visibleTxns={visibleTxns}
          catById={catById}
          recurringItems={recurringItems}
          hiddenAccountIds={hiddenAccountIds}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Dashboard (2-col Bento "What changed?")                                 */
/* -------------------------------------------------------------------------- */

type NetWorthRange = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

function BudgetDashboard({
  accounts,
  categories,
  visibleTxns,
  recurringItems,
  hiddenAccountIds,
  catById,
  acctById,
  onNavigateTab,
  onOpenSubView,
}: {
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  visibleTxns: TransactionRecord[];
  recurringItems: RecurringItemRecord[];
  hiddenAccountIds: Set<string>;
  catById: Map<string, BudgetCategoryRecord>;
  acctById: Map<string, AccountRecord>;
  onNavigateTab: (
    tab: BudgetTab,
    opts?: { categoryId?: string; filterMode?: "all" | "review" | "expenses" | "income" },
  ) => void;
  onOpenSubView: (view: BudgetSubView) => void;
}) {
  const [nwRange, setNwRange] = useState<NetWorthRange>("3M");
  const month = useMemo(() => monthBounds(0), []);
  const prevMonth = useMemo(() => monthBounds(-1), []);

  const monthTxns = useMemo(
    () => visibleTxns.filter((t) => t.transactedAt >= month.start && t.transactedAt < month.end),
    [visibleTxns, month],
  );
  const prevMonthSamePaceTxns = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1).getTime();
    return visibleTxns.filter((t) => t.transactedAt >= prevMonth.start && t.transactedAt < Math.min(cutoff, prevMonth.end));
  }, [visibleTxns, prevMonth]);

  const reviewItems = useMemo(() => {
    const start = reviewWindowStart();
    return visibleTxns.filter((t) => t.needsReview && t.transactedAt >= start);
  }, [visibleTxns]);

  const { earned, spent, plannedExpenses, prevEarned, prevSpent } = useMemo(() => {
    const tally = (list: TransactionRecord[]) => {
      let inc = 0;
      let spd = 0;
      for (const t of list) {
        const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
        if (t.isTransfer || cat?.isTransfer) continue;
        if (cat) {
          if (cat.isIncome) inc += t.amount;
          else spd -= t.amount;
        } else if (t.amount > 0) {
          inc += t.amount;
        } else {
          spd -= t.amount;
        }
      }
      return { inc, spd };
    };

    const cur = tally(monthTxns);
    const prev = tally(prevMonthSamePaceTxns);

    const groups = categories.filter((c) => !c.parentId && !c.isTransfer);
    let planOut = 0;
    for (const g of groups) {
      if (g.isIncome) continue;
      const children = categories.filter((c) => c.parentId === g.id);
      const target = g.monthlyTarget > 0 ? g.monthlyTarget : children.reduce((s, c) => s + c.monthlyTarget, 0);
      planOut += target;
    }
    return {
      earned: cur.inc,
      spent: cur.spd,
      plannedExpenses: planOut,
      prevEarned: prev.inc,
      prevSpent: prev.spd,
    };
  }, [monthTxns, prevMonthSamePaceTxns, categories, catById]);

  const visibleAccounts = accounts.filter((a) => !a.isHidden);
  const totalAssets = visibleAccounts.filter((a) => isAssetKind(a.kindRaw)).reduce((s, a) => s + a.balance, 0);
  const totalDebts = visibleAccounts.filter((a) => !isAssetKind(a.kindRaw)).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalDebts;

  // Daily cumulative spending for interactive pace chart
  const [nowTs] = useState(() => Date.now());
  const { daysInMonth, todayDate, currentYear } = useMemo(() => {
    const d = new Date(nowTs);
    return {
      daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
      todayDate: d.getDate(),
      currentYear: d.getFullYear(),
    };
  }, [nowTs]);
  const paceFraction = todayDate / Math.max(1, daysInMonth);

  const dailyCumulative = useMemo(() => {
    const daily = new Array(todayDate).fill(0);
    for (const t of monthTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      const isSpending = cat ? !cat.isIncome : t.amount < 0;
      if (!isSpending) continue;
      const dayIdx = new Date(t.transactedAt).getDate() - 1;
      if (dayIdx >= 0 && dayIdx < todayDate) daily[dayIdx] -= t.amount;
    }
    const cumulative: number[] = [];
    let running = 0;
    for (const v of daily) {
      running += v;
      cumulative.push(running);
    }
    return cumulative;
  }, [monthTxns, catById, todayDate]);

  // Net worth history reconstructed backwards from current netWorth via transaction cashflows
  const nwSeries = useMemo(() => {
    const endTs = nowTs;
    let startTs = endTs - 90 * 86400000;
    if (nwRange === "1W") startTs = endTs - 7 * 86400000;
    else if (nwRange === "1M") startTs = endTs - 30 * 86400000;
    else if (nwRange === "YTD") startTs = new Date(currentYear, 0, 1).getTime();
    else if (nwRange === "1Y") startTs = endTs - 365 * 86400000;
    else if (nwRange === "ALL") {
      const oldest = visibleTxns[visibleTxns.length - 1]?.transactedAt;
      startTs = oldest ? Math.min(oldest, endTs - 30 * 86400000) : endTs - 180 * 86400000;
    }

    const buckets = 18;
    const step = Math.max(1, (endTs - startTs) / buckets);
    const pts: Array<{ ts: number; label: string; value: number }> = [];
    for (let i = 0; i <= buckets; i++) {
      const tCut = startTs + step * i;
      const deltaAfter = visibleTxns
        .filter((t) => t.transactedAt > tCut)
        .reduce((s, t) => s + t.amount, 0);
      pts.push({
        ts: tCut,
        label: formatShortDate(tCut),
        value: netWorth - deltaAfter,
      });
    }
    return pts;
  }, [nwRange, netWorth, visibleTxns, nowTs, currentYear]);

  const nwDelta = nwSeries.length >= 2 ? nwSeries[nwSeries.length - 1].value - nwSeries[0].value : 0;

  // Top Categories capsule bars
  const topCategories = useMemo(() => {
    const spentByCat = new Map<string, number>();
    for (const t of monthTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      if (cat && !cat.isIncome) {
        spentByCat.set(cat.id, (spentByCat.get(cat.id) ?? 0) - t.amount);
      }
    }
    return Array.from(spentByCat.entries())
      .map(([id, actual]) => {
        const cat = catById.get(id)!;
        return { cat, actual, target: cat.monthlyTarget };
      })
      .filter((r) => r.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 5);
  }, [monthTxns, catById]);

  // Next Two Weeks recurring
  const nextTwoWeeks = useMemo(() => {
    const cutoff = nowTs + 14 * 86400000;
    return recurringItems
      .filter((r) => r.isActive && r.amount < 0 && !hiddenAccountIds.has(r.accountId) && r.nextDate <= cutoff)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 4);
  }, [recurringItems, hiddenAccountIds, nowTs]);

  const recent = visibleTxns.slice(0, 5);
  const spentDelta = spent - prevSpent;
  const paceExpected = plannedExpenses > 0 ? plannedExpenses * paceFraction : prevSpent;
  const paceDelta = spent - paceExpected;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--space-12)",
          marginBottom: "var(--space-20)",
        }}
      >
        <div>
          <p style={sectionEyebrowStyle}>{month.label}</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink-primary)",
            }}
          >
            Budget Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
          <Pill size="sm" variant="outline" onClick={() => onOpenSubView("reports")}>
            Cash Flow Reports →
          </Pill>
          <Pill size="sm" variant="outline" onClick={() => onOpenSubView("forecast")}>
            Runway Forecast →
          </Pill>
        </div>
      </header>

      {/* 2-Col Bento Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "var(--space-16)",
          alignItems: "start",
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          {/* What changed? Bento */}
          <Card eyebrow="What changed?" title="Month-over-Month Pace" variant="tinted">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-12)" }}>
              <div
                style={{
                  padding: "var(--space-12)",
                  borderRadius: "var(--radius-s)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div style={{ fontSize: 11.5, color: "var(--ink-tertiary)", marginBottom: 4 }}>
                  Spending vs. last mo (day {todayDate})
                </div>
                <div style={{ fontSize: 20, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                  {money(spent)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Badge tone={spentDelta <= 0 ? "income" : "expense"}>
                    {spentDelta <= 0 ? `${money(Math.abs(spentDelta))} less` : `${money(spentDelta)} more`}
                  </Badge>
                </div>
              </div>
              <div
                style={{
                  padding: "var(--space-12)",
                  borderRadius: "var(--radius-s)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div style={{ fontSize: 11.5, color: "var(--ink-tertiary)", marginBottom: 4 }}>
                  Income vs. last mo
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--income)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {money(earned)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Badge tone={earned >= prevEarned ? "income" : "neutral"}>
                    {earned >= prevEarned
                      ? `+${money(earned - prevEarned)}`
                      : `−${money(prevEarned - earned)}`}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* To Review */}
          {reviewItems.length > 0 && (
            <Card
              eyebrow="Needs Attention"
              title={`To Review (${reviewItems.length})`}
              actions={
                <Pill size="sm" variant="soft" onClick={() => onNavigateTab("transactions", { filterMode: "review" })}>
                  Inspect all
                </Pill>
              }
            >
              {reviewItems.slice(0, 4).map((tx, idx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-8) 0",
                    borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: "var(--weight-medium)", color: "var(--ink-primary)" }}>
                      {tx.customTitle || tx.payee || tx.description}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                      {formatShortDate(tx.transactedAt)} ·{" "}
                      {acctById.get(tx.accountId)?.nickname || acctById.get(tx.accountId)?.name || "Account"}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(tx.amount)}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Top Categories capsule bars */}
          <Card
            eyebrow="Top Categories"
            title="Where spending is going"
            actions={
              <Pill size="sm" onClick={() => onNavigateTab("plan")}>
                See plan
              </Pill>
            }
          >
            {topCategories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>No categorized spending this month.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
                {topCategories.map(({ cat, actual, target }) => {
                  const maxBase = target > 0 ? target : Math.max(actual, spent * 0.35, 1);
                  const pct = Math.min(100, Math.round((actual / maxBase) * 100));
                  const pacePct = Math.round(paceFraction * 100);
                  const over = target > 0 && actual > target;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onNavigateTab("transactions", { categoryId: cat.id })}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                        <span style={{ fontWeight: "var(--weight-medium)", color: "var(--ink-primary)" }}>
                          {cat.icon} {cat.name}
                        </span>
                        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
                          {money(actual)}
                          {target > 0 ? ` / ${money(target)}` : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          borderRadius: "var(--radius-full)",
                          background: "var(--track)",
                          overflow: "visible",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            borderRadius: "var(--radius-full)",
                            background: over ? "var(--expense)" : "var(--brand)",
                          }}
                        />
                        {target > 0 && (
                          <span
                            title="Month pace"
                            style={{
                              position: "absolute",
                              left: `${pacePct}%`,
                              top: -2,
                              bottom: -2,
                              width: 2,
                              background: "var(--ink-primary)",
                              opacity: 0.45,
                              borderRadius: 1,
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Transactions */}
          <Card
            eyebrow="Activity"
            title="Recent Transactions"
            actions={
              <Pill size="sm" onClick={() => onNavigateTab("transactions")}>
                See all
              </Pill>
            }
          >
            {recent.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>No transactions yet.</p>
            ) : (
              recent.map((tx, idx) => {
                const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-12)",
                      padding: "var(--space-8) 0",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-s)",
                        background: "var(--bg-paper-soft)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {cat?.icon || "•"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: "var(--weight-medium)",
                          color: "var(--ink-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tx.customTitle || tx.payee || tx.description}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                        {cat?.name || "Uncategorized"} · {formatShortDate(tx.transactedAt)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: "var(--weight-semibold)",
                        fontVariantNumeric: "tabular-nums",
                        color: tx.amount > 0 ? "var(--income)" : "var(--ink-primary)",
                      }}
                    >
                      {signedMoney(tx.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          {/* Monthly Spending vs Pace */}
          <ChartCard
            eyebrow="Monthly Spending"
            title="Spending vs. Pace"
            metric={money(spent)}
            delta={
              plannedExpenses > 0
                ? {
                    label: paceDelta <= 0 ? `${money(Math.abs(paceDelta))} under pace` : `${money(paceDelta)} over pace`,
                    tone: paceDelta <= 0 ? "income" : "expense",
                  }
                : undefined
            }
            subtitle={
              plannedExpenses > 0
                ? `${money(plannedExpenses)} planned · ${spent <= plannedExpenses ? `${money(plannedExpenses - spent)} left` : `${money(spent - plannedExpenses)} over`}`
                : `${monthTxns.filter((t) => t.amount < 0 && !t.isTransfer).length} charges this month`
            }
            legend={[
              { label: "This month", color: "var(--brand)" },
              { label: "Linear pace", color: "var(--last-month)", dashed: true },
            ]}
          >
            <InteractivePaceChart
              values={dailyCumulative}
              target={plannedExpenses}
              daysInMonth={daysInMonth}
            />
          </ChartCard>

          {/* Net Worth 1W-ALL */}
          <ChartCard
            eyebrow="Balance Sheet"
            title="Net Worth"
            metric={money(netWorth)}
            delta={{
              label: `${nwDelta >= 0 ? "+" : ""}${money(nwDelta)} (${nwRange})`,
              tone: nwDelta >= 0 ? "income" : "expense",
            }}
            ranges={["1W", "1M", "3M", "YTD", "1Y", "ALL"]}
            activeRange={nwRange}
            onRangeChange={(r) => setNwRange(r as NetWorthRange)}
            actions={
              <Pill size="sm" onClick={() => onNavigateTab("accounts")}>
                Accounts
              </Pill>
            }
            footer={
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-12)" }}>
                <div style={{ padding: "var(--space-8) var(--space-12)", borderRadius: "var(--radius-s)", background: "var(--bg-paper-soft)" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>Assets</div>
                  <div style={{ fontSize: 16, fontWeight: "var(--weight-semibold)", color: "var(--income)", fontVariantNumeric: "tabular-nums" }}>
                    {money(totalAssets)}
                  </div>
                </div>
                <div style={{ padding: "var(--space-8) var(--space-12)", borderRadius: "var(--radius-s)", background: "var(--bg-paper-soft)" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>Debts</div>
                  <div style={{ fontSize: 16, fontWeight: "var(--weight-semibold)", color: "var(--expense)", fontVariantNumeric: "tabular-nums" }}>
                    {money(totalDebts)}
                  </div>
                </div>
              </div>
            }
          >
            <InteractiveNetWorthChart points={nwSeries} />
          </ChartCard>

          {/* Next Two Weeks Recurring */}
          {nextTwoWeeks.length > 0 && (
            <Card
              eyebrow="Upcoming Bills"
              title="Next Two Weeks"
              actions={
                <Pill size="sm" onClick={() => onNavigateTab("recurring")}>
                  All recurring
                </Pill>
              }
            >
              {nextTwoWeeks.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-8) 0",
                    borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: "var(--weight-medium)" }}>{r.title || r.merchant}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                      Due {formatShortDate(r.nextDate)} · {formatCadenceLabel(r.cadenceRaw)}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(r.amount)}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InteractivePaceChart({
  values,
  target,
  daysInMonth,
}: {
  values: number[];
  target: number;
  daysInMonth: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 360;
  const h = 110;
  if (values.length === 0) return null;

  const maxVal = Math.max(target, values[values.length - 1] ?? 0, 1);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, daysInMonth - 1)) * w;
    const y = h - 12 - (v / maxVal) * (h - 24);
    return { x, y, v, day: i + 1 };
  });
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const targetY = target > 0 ? h - 12 - (target / maxVal) * (h - 24) : null;
  const active = hoverIdx !== null ? pts[hoverIdx] : null;

  return (
    <div>
      {active && (
        <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
          Day {active.day}: <strong>{money(active.v)}</strong> spent
          {target > 0 && ` (pace ${money((target * active.day) / daysInMonth)})`}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 112, display: "block" }}>
        {targetY !== null && (
          <>
            <line
              x1="0"
              y1={targetY}
              x2={w}
              y2={targetY}
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1={h - 12}
              x2={w}
              y2={targetY}
              stroke="var(--last-month)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </>
        )}
        <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" points={linePts} />
        {pts.map((p, i) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 4.5 : 2.5}
            fill={hoverIdx === i ? "var(--brand-dark)" : "var(--brand)"}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
    </div>
  );
}

function InteractiveNetWorthChart({ points }: { points: Array<{ ts: number; label: string; value: number }> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 360;
  const h = 110;
  if (points.length === 0) return null;

  const vals = points.map((p) => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = Math.max(1, maxV - minV);

  const coords = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * w;
    const y = h - 14 - ((p.value - minV) / span) * (h - 28);
    return { ...p, x, y };
  });
  const linePts = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const active = hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <div>
      {active && (
        <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
          {active.label}: <strong>{money(active.value)}</strong>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 112, display: "block" }}>
        <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" points={linePts} />
        {coords.map((p, i) => (
          <circle
            key={p.ts}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 4.5 : 2.5}
            fill={hoverIdx === i ? "var(--brand-dark)" : "var(--brand)"}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Accounts                                                                */
/* -------------------------------------------------------------------------- */

function BudgetAccounts({ accounts }: { accounts: AccountRecord[] }) {
  const [showHidden, setShowHidden] = useState(false);
  const visible = accounts.filter((a) => !a.isHidden);
  const hidden = accounts.filter((a) => a.isHidden);

  const netWorth = visible.reduce(
    (sum, a) => sum + (isAssetKind(a.kindRaw) ? a.balance : -Math.abs(a.balance)),
    0,
  );
  const totalAssets = visible.filter((a) => isAssetKind(a.kindRaw)).reduce((s, a) => s + a.balance, 0);
  const totalDebts = visible.filter((a) => !isAssetKind(a.kindRaw)).reduce((s, a) => s + Math.abs(a.balance), 0);

  const groups: Array<"Cash" | "Credit Cards" | "Investments" | "Loans"> = [
    "Cash",
    "Credit Cards",
    "Investments",
    "Loans",
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-20)" }}>
        <p style={sectionEyebrowStyle}>Net Worth</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 34,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            margin: "0 0 var(--space-4)",
            color: "var(--ink-primary)",
          }}
        >
          {money(netWorth, true)}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>
          {money(totalAssets)} assets · {money(totalDebts)} liabilities
        </p>
      </header>

      {accounts.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>No accounts synced from iCloud yet.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          {groups.map((groupName) => {
            const members = visible.filter((a) => accountGroupFor(a.kindRaw) === groupName);
            if (members.length === 0) return null;
            const isAsset = groupName === "Cash" || groupName === "Investments";
            const total = members.reduce((s, a) => s + (isAsset ? a.balance : -Math.abs(a.balance)), 0);
            const shareBase = isAsset ? totalAssets : totalDebts;
            const pct = shareBase > 0 ? Math.round((Math.abs(total) / shareBase) * 100) : 0;

            return (
              <Card key={groupName} padding="none" style={{ overflow: "hidden" }}>
                <div
                  style={{
                    padding: "var(--space-16) var(--space-20)",
                    borderBottom: "1px solid var(--border-hairline)",
                    background: "var(--bg-paper-soft)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
                      {groupName}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                      {money(total, true)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-tertiary)", marginTop: 2 }}>
                    {pct}% of {isAsset ? "assets" : "liabilities"}
                  </div>
                </div>
                {members.map((acct, idx) => (
                  <div
                    key={acct.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-12) var(--space-20)",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: "var(--weight-medium)", color: "var(--ink-primary)" }}>
                        {acct.nickname || acct.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-tertiary)" }}>
                        {acct.institutionName ? `${acct.institutionName} · ` : ""}
                        {acct.kindRaw}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                      {money(acct.balance, true)}
                    </div>
                  </div>
                ))}
              </Card>
            );
          })}

          {hidden.length > 0 && (
            <div>
              <Pill size="sm" onClick={() => setShowHidden((v) => !v)}>
                {showHidden
                  ? "Hide hidden accounts"
                  : `Show ${hidden.length} hidden account${hidden.length === 1 ? "" : "s"}`}
              </Pill>
              {showHidden && (
                <Card padding="none" style={{ marginTop: "var(--space-12)", opacity: 0.7, overflow: "hidden" }}>
                  {hidden.map((acct, idx) => (
                    <div
                      key={acct.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "var(--space-12) var(--space-20)",
                        borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                      }}
                    >
                      <span>{acct.nickname || acct.name}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(acct.balance, true)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Transactions (Copilot borderless list + popovers + Inspector + Summary) */
/* -------------------------------------------------------------------------- */

type DatePreset = "all" | "thisMonth" | "lastMonth" | "30d" | "90d" | "ytd";

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "all", label: "All dates" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "ytd", label: "Year to date" },
];

function BudgetTransactions({
  accounts,
  categories,
  visibleTxns,
  catById,
  acctById,
  initialCatFilter = "all",
  initialTypeFilter = "all",
}: {
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  acctById: Map<string, AccountRecord>;
  initialCatFilter?: string;
  initialTypeFilter?: "all" | "review" | "expenses" | "income";
}) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "review" | "expenses" | "income">(initialTypeFilter);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCatFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<"date" | "filters" | null>(null);
  const popoverAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openPopover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverAreaRef.current && !popoverAreaRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openPopover]);

  const reviewCount = useMemo(() => {
    const start = reviewWindowStart();
    return visibleTxns.filter((t) => t.needsReview && t.transactedAt >= start).length;
  }, [visibleTxns]);

  const [nowTs] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const reviewStart = reviewWindowStart();
    const now = new Date(nowTs);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    return visibleTxns.filter((tx) => {
      if (datePreset === "thisMonth" && tx.transactedAt < thisMonthStart) return false;
      if (datePreset === "lastMonth" && (tx.transactedAt < lastMonthStart || tx.transactedAt >= thisMonthStart)) return false;
      if (datePreset === "30d" && tx.transactedAt < nowTs - 30 * 86400000) return false;
      if (datePreset === "90d" && tx.transactedAt < nowTs - 90 * 86400000) return false;
      if (datePreset === "ytd" && tx.transactedAt < new Date(now.getFullYear(), 0, 1).getTime()) return false;

      if (accountFilter !== "all" && tx.accountId !== accountFilter) return false;
      if (categoryFilter !== "all" && (tx.categoryId ?? "__uncat__") !== categoryFilter) return false;
      if (filterMode === "review" && (!tx.needsReview || tx.transactedAt < reviewStart)) return false;
      const txCat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
      const isXfer = tx.isTransfer || Boolean(txCat?.isTransfer);
      if (filterMode === "expenses" && (tx.amount >= 0 || isXfer)) return false;
      if (filterMode === "income" && (tx.amount <= 0 || isXfer)) return false;
      if (!q) return true;
      const catName = (tx.categoryId ? catById.get(tx.categoryId)?.name : "")?.toLowerCase() ?? "";
      return (
        (tx.customTitle || "").toLowerCase().includes(q) ||
        (tx.payee || "").toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        catName.includes(q)
      );
    });
  }, [visibleTxns, search, filterMode, datePreset, accountFilter, categoryFilter, catById, nowTs]);

  const { spentTotal, incomeTotal, topCatSummary } = useMemo(() => {
    let s = 0;
    let inc = 0;
    const catTotals = new Map<string, { name: string; amount: number }>();
    for (const t of filtered) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      if (t.amount < 0) {
        s += Math.abs(t.amount);
        const key = cat?.id ?? "__uncat__";
        const cur = catTotals.get(key) ?? { name: cat?.name ?? "Uncategorized", amount: 0 };
        cur.amount += Math.abs(t.amount);
        catTotals.set(key, cur);
      } else {
        inc += t.amount;
      }
    }
    const top = Array.from(catTotals.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
    return { spentTotal: s, incomeTotal: inc, topCatSummary: top };
  }, [filtered, catById]);

  const displayList = useMemo(() => filtered.slice(0, 250), [filtered]);
  const groupedByDay = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    for (const tx of displayList) {
      const key = dayKeyFromTs(tx.transactedAt);
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [displayList]);

  const selectedIndex = useMemo(
    () => (selectedId ? displayList.findIndex((t) => t.id === selectedId) : -1),
    [selectedId, displayList],
  );
  const selectedTxn = selectedIndex >= 0 ? displayList[selectedIndex] : null;

  const stepSelected = useCallback(
    (delta: -1 | 1) => {
      if (displayList.length === 0) return;
      if (selectedIndex < 0) {
        setSelectedId(displayList[0].id);
        return;
      }
      const next = Math.max(0, Math.min(displayList.length - 1, selectedIndex + delta));
      setSelectedId(displayList[next].id);
    },
    [displayList, selectedIndex],
  );

  useEffect(() => {
    if (!selectedTxn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        stepSelected(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        stepSelected(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTxn, stepSelected]);

  const activeFilterCount =
    (filterMode !== "all" ? 1 : 0) + (accountFilter !== "all" ? 1 : 0) + (categoryFilter !== "all" ? 1 : 0);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-16)" }} ref={popoverAreaRef}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "var(--space-12)",
            marginBottom: "var(--space-12)",
          }}
        >
          <div>
            <p style={sectionEyebrowStyle}>Read-only Ledger</p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                margin: 0,
                color: "var(--ink-primary)",
              }}
            >
              Transactions
            </h1>
          </div>
          {reviewCount > 0 && (
            <Pill
              size="sm"
              active={filterMode === "review"}
              onClick={() => setFilterMode((m) => (m === "review" ? "all" : "review"))}
              count={reviewCount}
            >
              Needs Review
            </Pill>
          )}
        </div>

        {/* Search + Inline Date & Filters Popovers */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "center", position: "relative" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants, categories, descriptions…"
            style={{
              flex: "1 1 240px",
              padding: "8px 12px",
              borderRadius: "var(--radius-s)",
              border: "1px solid var(--border-hairline)",
              background: "var(--bg-card)",
              fontSize: 13.5,
              color: "var(--ink-primary)",
            }}
          />

          <div style={{ position: "relative" }}>
            <Pill
              size="md"
              active={datePreset !== "all" || openPopover === "date"}
              onClick={() => setOpenPopover((p) => (p === "date" ? null : "date"))}
            >
              {DATE_PRESETS.find((d) => d.id === datePreset)?.label ?? "Date"} ▾
            </Pill>
            {openPopover === "date" && (
              <Card
                padding="sm"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 200,
                  zIndex: 30,
                  boxShadow: "var(--shadow-elevated)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {DATE_PRESETS.map((p) => (
                    <Pill
                      key={p.id}
                      size="sm"
                      active={datePreset === p.id}
                      style={{ justifyContent: "flex-start" }}
                      onClick={() => {
                        setDatePreset(p.id);
                        setOpenPopover(null);
                      }}
                    >
                      {p.label}
                    </Pill>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <Pill
              size="md"
              active={activeFilterCount > 0 || openPopover === "filters"}
              count={activeFilterCount > 0 ? activeFilterCount : undefined}
              onClick={() => setOpenPopover((p) => (p === "filters" ? null : "filters"))}
            >
              Filters ▾
            </Pill>
            {openPopover === "filters" && (
              <Card
                padding="md"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 300,
                  zIndex: 30,
                  boxShadow: "var(--shadow-elevated)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
                  <div>
                    <div style={sectionEyebrowStyle}>Type</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
                      {(
                        [
                          ["all", "All"],
                          ["review", "Review"],
                          ["expenses", "Expenses"],
                          ["income", "Income"],
                        ] as const
                      ).map(([k, lbl]) => (
                        <Pill key={k} size="sm" active={filterMode === k} onClick={() => setFilterMode(k)}>
                          {lbl}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={sectionEyebrowStyle}>Account</div>
                    <select
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "var(--radius-s)",
                        border: "1px solid var(--border-hairline)",
                        background: "var(--bg-paper)",
                        fontSize: 13,
                        color: "var(--ink-primary)",
                      }}
                    >
                      <option value="all">All accounts</option>
                      {accounts
                        .filter((a) => !a.isHidden)
                        .map((a) => (
                          <option key={a.providerAccountId} value={a.providerAccountId}>
                            {a.nickname || a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <div style={sectionEyebrowStyle}>Category</div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "var(--radius-s)",
                        border: "1px solid var(--border-hairline)",
                        background: "var(--bg-paper)",
                        fontSize: 13,
                        color: "var(--ink-primary)",
                      }}
                    >
                      <option value="all">All categories</option>
                      {categories
                        .filter((c) => !c.isTransfer)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <Pill
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFilterMode("all");
                        setAccountFilter("all");
                        setCategoryFilter("all");
                      }}
                    >
                      Clear filters
                    </Pill>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </header>

      {/* Borderless Chronological List + Sticky Summary / Inspector */}
      <div className="ds-inspector-layout">
        <div style={{ flex: 1, minWidth: 0 }}>
          {groupedByDay.length === 0 ? (
            <Card>
              <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>No matching transactions.</p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
              {groupedByDay.map(([dayKey, items]) => {
                const dayNet = items.filter((t) => !t.isTransfer).reduce((s, t) => s + t.amount, 0);
                return (
                  <section key={dayKey}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0 var(--space-8) var(--space-8)",
                        borderBottom: "1px solid var(--border-hairline)",
                        fontSize: 12,
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--ink-tertiary)",
                      }}
                    >
                      <span>{formatDayHeader(dayKey)}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(dayNet, true)}</span>
                    </div>
                    <div>
                      {items.map((tx) => {
                        const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
                        const acct = acctById.get(tx.accountId);
                        const isSelected = tx.id === selectedId;
                        return (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() => setSelectedId(isSelected ? null : tx.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-12)",
                              padding: "var(--space-12) var(--space-8)",
                              border: "none",
                              borderRadius: "var(--radius-s)",
                              background: isSelected ? "var(--brand-soft)" : "transparent",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "var(--radius-s)",
                                background: "var(--bg-paper-soft)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                                flexShrink: 0,
                              }}
                            >
                              {cat?.icon || "•"}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: "var(--weight-medium)",
                                  color: "var(--ink-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {tx.customTitle || tx.payee || tx.description}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--ink-tertiary)", display: "flex", gap: 6, alignItems: "center" }}>
                                <span>
                                  {cat?.name || "Uncategorized"} · {acct?.nickname || acct?.name || "Account"}
                                </span>
                                {tx.needsReview && <Badge tone="pending">Review</Badge>}
                                {tx.isPending && <Badge tone="neutral">Pending</Badge>}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: "var(--weight-semibold)",
                                fontVariantNumeric: "tabular-nums",
                                color: tx.amount > 0 ? "var(--income)" : "var(--ink-primary)",
                              }}
                            >
                              {signedMoney(tx.amount)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {selectedTxn ? (
          <InspectorDrawer
            open
            onClose={() => setSelectedId(null)}
            eyebrow={`Transaction ${selectedIndex + 1} of ${displayList.length}`}
            title={selectedTxn.customTitle || selectedTxn.payee || selectedTxn.description}
            subtitle={formatShortDate(selectedTxn.transactedAt)}
            headerExtra={
              <div style={{ display: "inline-flex", gap: 4 }}>
                <button
                  type="button"
                  className="ds-inspector-close"
                  onClick={() => stepSelected(-1)}
                  disabled={selectedIndex <= 0}
                  aria-label="Previous transaction"
                  title="Previous (↑)"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="ds-inspector-close"
                  onClick={() => stepSelected(1)}
                  disabled={selectedIndex >= displayList.length - 1}
                  aria-label="Next transaction"
                  title="Next (↓)"
                >
                  ▼
                </button>
              </div>
            }
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: selectedTxn.amount > 0 ? "var(--income)" : "var(--ink-primary)",
                marginBottom: "var(--space-12)",
              }}
            >
              {signedMoney(selectedTxn.amount)}
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-16)" }}>
              {selectedTxn.needsReview && <Badge tone="pending">Needs Review</Badge>}
              {selectedTxn.isPending && <Badge tone="neutral">Pending</Badge>}
              {selectedTxn.isTransfer && <Badge tone="brand">Transfer</Badge>}
              {!selectedTxn.needsReview && !selectedTxn.isPending && !selectedTxn.isTransfer && (
                <Badge tone="income">Reviewed</Badge>
              )}
            </div>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 14px", fontSize: 13 }}>
              <dt style={{ color: "var(--ink-tertiary)" }}>Date</dt>
              <dd style={{ margin: 0 }}>{new Date(selectedTxn.transactedAt).toLocaleString("en-US")}</dd>
              <dt style={{ color: "var(--ink-tertiary)" }}>Account</dt>
              <dd style={{ margin: 0 }}>
                {acctById.get(selectedTxn.accountId)?.nickname ||
                  acctById.get(selectedTxn.accountId)?.name ||
                  selectedTxn.accountId}
              </dd>
              <dt style={{ color: "var(--ink-tertiary)" }}>Category</dt>
              <dd style={{ margin: 0 }}>
                {selectedTxn.categoryId
                  ? `${catById.get(selectedTxn.categoryId)?.icon ?? ""} ${catById.get(selectedTxn.categoryId)?.name ?? selectedTxn.categoryId}`
                  : "Uncategorized"}
              </dd>
              <dt style={{ color: "var(--ink-tertiary)" }}>Description</dt>
              <dd style={{ margin: 0, wordBreak: "break-word" }}>{selectedTxn.description}</dd>
              {selectedTxn.note && (
                <>
                  <dt style={{ color: "var(--ink-tertiary)" }}>Note</dt>
                  <dd style={{ margin: 0 }}>{selectedTxn.note}</dd>
                </>
              )}
            </dl>
          </InspectorDrawer>
        ) : (
          <Card
            padding="md"
            eyebrow="Summary"
            title={`${filtered.length} transactions`}
            style={{
              width: 280,
              flexShrink: 0,
              position: "sticky",
              top: "calc(var(--topbar-height) + var(--space-16))",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", fontSize: 13.5, marginBottom: "var(--space-16)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-tertiary)" }}>Spent</span>
                <span style={{ fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                  {money(spentTotal, true)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ink-tertiary)" }}>Income</span>
                <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--income)", fontVariantNumeric: "tabular-nums" }}>
                  {money(incomeTotal, true)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "var(--space-8)",
                  borderTop: "1px solid var(--border-hairline)",
                }}
              >
                <span style={{ fontWeight: "var(--weight-semibold)" }}>Net</span>
                <span
                  style={{
                    fontWeight: "var(--weight-semibold)",
                    color: incomeTotal - spentTotal >= 0 ? "var(--income)" : "var(--expense)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {signedMoney(incomeTotal - spentTotal, true)}
                </span>
              </div>
            </div>

            {topCatSummary.length > 0 && (
              <div style={{ marginBottom: "var(--space-16)" }}>
                <div style={sectionEyebrowStyle}>Top Categories</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                  {topCatSummary.map((c) => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--ink-secondary)" }}>{c.name}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Pill
              variant="brand"
              size="md"
              style={{ width: "100%" }}
              onClick={() => downloadCsv(filtered, catById, acctById)}
            >
              Download CSV
            </Pill>
          </Card>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Plan                                                                    */
/* -------------------------------------------------------------------------- */

function BudgetPlanView({
  categories,
  visibleTxns,
  catById,
}: {
  categories: BudgetCategoryRecord[];
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const month = useMemo(() => monthBounds(monthOffset), [monthOffset]);

  const { actualByCat, uncategorizedSpending } = useMemo(() => {
    const map: Record<string, number> = {};
    let uncat = 0;
    for (const tx of visibleTxns) {
      if (tx.transactedAt < month.start || tx.transactedAt >= month.end) continue;
      const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
      if (tx.isTransfer || cat?.isTransfer) continue;
      if (cat) {
        map[cat.id] = (map[cat.id] ?? 0) + (cat.isIncome ? tx.amount : -tx.amount);
      } else if (tx.amount < 0) {
        uncat -= tx.amount;
      }
    }
    return { actualByCat: map, uncategorizedSpending: uncat };
  }, [visibleTxns, month, catById]);

  const groups = useMemo(
    () => categories.filter((c) => !c.parentId && !c.isTransfer).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const incomeGroups = groups.filter((g) => g.isIncome);
  const expenseGroups = groups.filter((g) => !g.isIncome);

  const childrenOf = (groupId: string) =>
    categories.filter((c) => c.parentId === groupId).sort((a, b) => a.sortOrder - b.sortOrder);

  const plannedForGroup = (g: BudgetCategoryRecord) =>
    g.monthlyTarget > 0 ? g.monthlyTarget : childrenOf(g.id).reduce((s, c) => s + c.monthlyTarget, 0);

  const actualForGroup = (g: BudgetCategoryRecord) =>
    childrenOf(g.id).reduce((s, c) => s + (actualByCat[c.id] ?? 0), actualByCat[g.id] ?? 0);

  const plannedIncome = incomeGroups.reduce((s, g) => s + plannedForGroup(g), 0);
  const plannedExpenses = expenseGroups.reduce((s, g) => s + plannedForGroup(g), 0);
  const earned = incomeGroups.reduce((s, g) => s + actualForGroup(g), 0);
  const spent = expenseGroups.reduce((s, g) => s + actualForGroup(g), 0) + uncategorizedSpending;
  const leftToBudget = plannedIncome - plannedExpenses;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-20)",
          flexWrap: "wrap",
          gap: "var(--space-12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
          <Pill size="sm" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous Month">
            ‹
          </Pill>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink-primary)",
            }}
          >
            {month.label}
          </h1>
          <Pill
            size="sm"
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={month.isCurrent}
            aria-label="Next Month"
          >
            ›
          </Pill>
        </div>
        {!month.isCurrent && (
          <Pill size="sm" variant="soft" onClick={() => setMonthOffset(0)}>
            Current month
          </Pill>
        )}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--space-16)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          <Card
            padding="md"
            style={{
              background: leftToBudget < 0 ? "var(--expense)" : "var(--brand)",
              color: "var(--on-brand)",
              borderColor: "transparent",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: "var(--weight-semibold)" }}>Left to budget</span>
            <span style={{ fontSize: 22, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
              {money(leftToBudget)}
            </span>
          </Card>

          <Card padding="md">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--ink-primary)",
                fontSize: 16,
                fontWeight: "var(--weight-semibold)",
              }}
            >
              <span>Summary</span>
              <span>{summaryOpen ? "▾" : "▸"}</span>
            </button>
            {summaryOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)", marginTop: "var(--space-16)" }}>
                <PlanSummaryBar label="Income" actual={earned} planned={plannedIncome} tint="var(--income)" verb="earned" />
                <PlanSummaryBar
                  label="Expenses"
                  actual={spent}
                  planned={plannedExpenses}
                  tint={plannedExpenses > 0 && spent > plannedExpenses ? "var(--expense)" : "var(--brand)"}
                  verb="spent"
                />
              </div>
            )}
          </Card>

          {uncategorizedSpending > 0 && (
            <Card padding="sm" variant="tinted">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
                <span style={{ fontSize: 20 }}>❓</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)" }}>Uncategorized</div>
                  <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
                    {money(uncategorizedSpending)} spent — review in Wooli Mac/iOS
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
          {incomeGroups.length > 0 && (
            <PlanGroupSection
              title="Income"
              groups={incomeGroups}
              isIncome
              isCurrentMonth={month.isCurrent}
              childrenOf={childrenOf}
              plannedForGroup={plannedForGroup}
              actualForGroup={actualForGroup}
              actualByCat={actualByCat}
            />
          )}
          {expenseGroups.length > 0 && (
            <PlanGroupSection
              title="Expenses"
              groups={expenseGroups}
              isIncome={false}
              isCurrentMonth={month.isCurrent}
              childrenOf={childrenOf}
              plannedForGroup={plannedForGroup}
              actualForGroup={actualForGroup}
              actualByCat={actualByCat}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PlanGroupSection({
  title,
  groups,
  isIncome,
  isCurrentMonth,
  childrenOf,
  plannedForGroup,
  actualForGroup,
  actualByCat,
}: {
  title: string;
  groups: BudgetCategoryRecord[];
  isIncome: boolean;
  isCurrentMonth: boolean;
  childrenOf: (id: string) => BudgetCategoryRecord[];
  plannedForGroup: (g: BudgetCategoryRecord) => number;
  actualForGroup: (g: BudgetCategoryRecord) => number;
  actualByCat: Record<string, number>;
}) {
  return (
    <section>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 19,
          fontWeight: 600,
          margin: "0 0 var(--space-12)",
          color: "var(--ink-primary)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
        {groups.map((g) => {
          const children = childrenOf(g.id);
          const planned = plannedForGroup(g);
          const actual = actualForGroup(g);
          const groupRollover =
            isCurrentMonth && !isIncome
              ? g.monthlyTarget > 0
                ? g.rolloverEnabled
                  ? g.rolloverBalance
                  : 0
                : children.reduce((s, c) => s + (c.rolloverEnabled ? c.rolloverBalance : 0), 0)
              : 0;
          return (
            <Card key={g.id} padding="none" style={{ overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-12) var(--space-16)",
                  background: "var(--bg-paper-soft)",
                  borderBottom: children.length > 0 ? "1px solid var(--border-hairline)" : "none",
                }}
              >
                <div>
                  <span style={{ fontSize: 15, fontWeight: "var(--weight-semibold)" }}>
                    {g.icon} {g.name}
                  </span>
                  {groupRollover !== 0 && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: groupRollover > 0 ? "var(--income)" : "var(--expense)",
                        marginTop: 2,
                      }}
                    >
                      {groupRollover > 0
                        ? `+${money(groupRollover)} rolled over`
                        : `${money(Math.abs(groupRollover))} overspent last month`}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                  {planned > 0 ? `${money(actual)} of ${money(planned)}` : `${money(actual)} ${isIncome ? "earned" : "spent"}`}
                </span>
              </div>
              {children.map((c, idx) => {
                const cActual = actualByCat[c.id] ?? 0;
                const cPlan = c.monthlyTarget;
                const cRollover = isCurrentMonth && !isIncome && c.rolloverEnabled ? c.rolloverBalance : 0;
                const remaining = Math.max(cPlan, 0) + cRollover - cActual;
                const pct = cPlan > 0 ? Math.min(100, Math.max(0, Math.round((cActual / cPlan) * 100))) : 0;
                const barColor = isIncome
                  ? "var(--income)"
                  : cActual > cPlan
                    ? "var(--expense)"
                    : cActual >= cPlan * 0.85
                      ? "var(--pending)"
                      : "var(--brand)";
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "var(--space-12) var(--space-16)",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-8)" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: "var(--weight-medium)" }}>
                          {c.icon} {c.name}
                        </span>
                        {cRollover !== 0 && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: cRollover > 0 ? "var(--income)" : "var(--expense)",
                              marginTop: 1,
                            }}
                          >
                            {cRollover > 0
                              ? `+${money(cRollover)} rolled over`
                              : `${money(Math.abs(cRollover))} overspent last month`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
                          {cPlan > 0 ? `${money(cActual)} / ${money(cPlan)}` : money(cActual)}
                        </span>
                        {(cPlan > 0 || cRollover !== 0) && (
                          <Badge tone={remaining >= 0 ? "income" : "expense"}>{money(remaining)}</Badge>
                        )}
                      </div>
                    </div>
                    {cPlan > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          height: 8,
                          borderRadius: "var(--radius-full)",
                          background: "var(--track)",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "var(--radius-full)", background: barColor }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Categories                                                              */
/* -------------------------------------------------------------------------- */

function BudgetCategoriesView({ categories }: { categories: BudgetCategoryRecord[] }) {
  const groups = useMemo(
    () => categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-20)" }}>
        <p style={sectionEyebrowStyle}>Taxonomy</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            margin: "0 0 var(--space-4)",
            color: "var(--ink-primary)",
          }}
        >
          Categories
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>
          {groups.length} groups · {categories.length} total categories
        </p>
      </header>

      {groups.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>No categories synced yet.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          {groups.map((g) => {
            const children = categories
              .filter((c) => c.parentId === g.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const badgeText = g.isIncome ? "Income" : g.isTransfer ? "Transfer" : "Spending";
            const badgeTone = g.isIncome ? "income" : g.isTransfer ? "neutral" : "brand";
            return (
              <Card key={g.id} padding="none" style={{ overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-8)",
                    padding: "var(--space-12) var(--space-16)",
                    background: "var(--bg-paper-soft)",
                    borderBottom: children.length > 0 ? "1px solid var(--border-hairline)" : "none",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{g.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)" }}>
                    {g.name}
                  </span>
                  <Badge tone={badgeTone}>{badgeText}</Badge>
                </div>
                {children.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-12) var(--space-16)",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {c.icon} {c.name}
                    </span>
                    {c.monthlyTarget > 0 && (
                      <span style={{ fontSize: 13, color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                        {money(c.monthlyTarget)}/mo
                      </span>
                    )}
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Recurring                                                               */
/* -------------------------------------------------------------------------- */

interface DetectedRecurring {
  key: string;
  title: string;
  amount: number;
  cadence: string;
  lastDate: number;
  nextDate: number;
  paidThisMonth: boolean;
  categoryId?: string;
}

function formatCadenceLabel(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "weekly") return "Weekly";
  if (lower === "biweekly") return "Biweekly";
  if (lower === "yearly" || lower === "annual") return "Yearly";
  if (lower === "monthly") return "Monthly";
  return raw ? raw[0].toUpperCase() + raw.slice(1) : "Monthly";
}

function BudgetRecurringView({
  visibleTxns,
  catById,
  recurringItems,
  hiddenAccountIds,
}: {
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  recurringItems: RecurringItemRecord[];
  hiddenAccountIds: Set<string>;
}) {
  const detected = useMemo<DetectedRecurring[]>(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const activeSynced = recurringItems.filter(
      (r) => r.isActive && r.amount < 0 && !hiddenAccountIds.has(r.accountId),
    );
    if (activeSynced.length > 0) {
      return activeSynced
        .map((r) => ({
          key: r.id,
          title: r.title || r.merchant,
          amount: r.amount,
          cadence: formatCadenceLabel(r.cadenceRaw),
          lastDate: r.lastDate,
          nextDate: r.nextDate,
          paidThisMonth: r.lastDate >= monthStart,
          categoryId: r.categoryId,
        }))
        .sort((a, b) => a.nextDate - b.nextDate);
    }

    const byMerchant = new Map<string, TransactionRecord[]>();
    for (const tx of visibleTxns) {
      const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
      if (tx.isTransfer || cat?.isTransfer || tx.amount >= 0) continue;
      const raw = (tx.customTitle || tx.payee || tx.description).trim();
      const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!norm) continue;
      const arr = byMerchant.get(norm) ?? [];
      arr.push(tx);
      byMerchant.set(norm, arr);
    }

    const results: DetectedRecurring[] = [];
    for (const [key, list] of byMerchant.entries()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => b.transactedAt - a.transactedAt);
      const newest = sorted[0];
      const prev = sorted[1];
      const gapDays = Math.round((newest.transactedAt - prev.transactedAt) / 86400000);
      let cadence: string | null = null;
      let cycleDays = 30;
      if (gapDays >= 25 && gapDays <= 35) {
        cadence = "Monthly";
        cycleDays = 30;
      } else if (gapDays >= 6 && gapDays <= 9) {
        cadence = "Weekly";
        cycleDays = 7;
      } else if (gapDays >= 350 && gapDays <= 380) {
        cadence = "Yearly";
        cycleDays = 365;
      }
      if (!cadence) continue;

      const avgAmount = sorted.slice(0, 3).reduce((s, t) => s + t.amount, 0) / Math.min(3, sorted.length);
      results.push({
        key,
        title: newest.customTitle || newest.payee || newest.description,
        amount: avgAmount,
        cadence,
        lastDate: newest.transactedAt,
        nextDate: newest.transactedAt + cycleDays * 86400000,
        paidThisMonth: newest.transactedAt >= monthStart,
        categoryId: newest.categoryId,
      });
    }

    return results.sort((a, b) => a.nextDate - b.nextDate);
  }, [visibleTxns, catById, recurringItems, hiddenAccountIds]);

  const paid = detected.filter((d) => d.paidThisMonth);
  const upcoming = detected.filter((d) => !d.paidThisMonth);
  const paidTotal = paid.reduce((s, d) => s + Math.abs(d.amount), 0);
  const dueTotal = upcoming.reduce((s, d) => s + Math.abs(d.amount), 0);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--space-20)" }}>
        <p style={sectionEyebrowStyle}>Bills &amp; Subscriptions</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            margin: "0 0 var(--space-4)",
            color: "var(--ink-primary)",
          }}
        >
          Recurring
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-tertiary)" }}>
          Bills and subscriptions spotted from synced recurring rules and transactions
        </p>
      </header>

      <Card padding="md" eyebrow="This month" style={{ marginBottom: "var(--space-16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-12)" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
              {money(dueTotal, true)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>still due</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
              {money(paidTotal, true)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>paid so far</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--track)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${paidTotal + dueTotal > 0 ? Math.round((paidTotal / (paidTotal + dueTotal)) * 100) : 0}%`,
              borderRadius: "var(--radius-full)",
              background: "var(--brand)",
            }}
          />
        </div>
      </Card>

      {detected.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>
            No repeating bills or subscriptions detected yet from your synced transactions.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          {upcoming.length > 0 && (
            <Card padding="none" style={{ overflow: "hidden" }}>
              <div
                style={{
                  padding: "var(--space-12) var(--space-16)",
                  background: "var(--bg-paper-soft)",
                  fontSize: 12,
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--ink-secondary)",
                }}
              >
                Upcoming ({upcoming.length})
              </div>
              {upcoming.map((item, idx) => {
                const cat = item.categoryId ? catById.get(item.categoryId) : undefined;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-12) var(--space-16)",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: "var(--weight-medium)" }}>
                        {cat?.icon ? `${cat.icon} ` : ""}
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                        {item.cadence} · Est. {formatShortDate(item.nextDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                      {signedMoney(item.amount)}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {paid.length > 0 && (
            <Card padding="none" style={{ overflow: "hidden" }}>
              <div
                style={{
                  padding: "var(--space-12) var(--space-16)",
                  background: "var(--bg-paper-soft)",
                  fontSize: 12,
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--ink-secondary)",
                }}
              >
                Paid this month ({paid.length})
              </div>
              {paid.map((item, idx) => {
                const cat = item.categoryId ? catById.get(item.categoryId) : undefined;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-12) var(--space-16)",
                      borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: "var(--weight-medium)" }}>
                        {cat?.icon ? `${cat.icon} ` : ""}
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                        {item.cadence} · Paid {formatShortDate(item.lastDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums", color: "var(--income)" }}>
                      {signedMoney(item.amount)} ✓
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PlanSummaryBar({
  label,
  actual,
  planned,
  tint,
  verb,
}: {
  label: string;
  actual: number;
  planned: number;
  tint: string;
  verb: string;
}) {
  const pct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
        <span style={{ fontWeight: "var(--weight-semibold)" }}>{label}</span>
        <span style={{ color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {money(actual)} {verb}
          {planned > 0 ? ` of ${money(planned)}` : ""}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--track)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "var(--radius-full)", background: tint }} />
      </div>
    </div>
  );
}

export default BudgetScreen;
