"use client";

import { useMemo, useState } from "react";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  RecurringItemRecord,
  TransactionRecord,
} from "@/lib/cloudkit/schema";
import { Badge, Card, ChartCard, Pill } from "@/app/components/ds";

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

function monthKeyFromTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function downloadTransactionsCsv(
  rows: TransactionRecord[],
  catById: Map<string, BudgetCategoryRecord>,
  acctById: Map<string, AccountRecord>,
  filename: string,
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
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ReportRange = "1M" | "3M" | "6M" | "YTD" | "1Y";

function rangeStartTs(range: ReportRange): number {
  const now = new Date();
  if (range === "1M") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (range === "3M") return new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
  if (range === "6M") return new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
  if (range === "YTD") return new Date(now.getFullYear(), 0, 1).getTime();
  return new Date(now.getFullYear() - 1, now.getMonth() + 1, 1).getTime();
}

export function BudgetReportsView({
  visibleTxns,
  catById,
  acctById,
}: {
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  acctById: Map<string, AccountRecord>;
}) {
  const [range, setRange] = useState<ReportRange>("6M");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const periodTxns = useMemo(() => {
    const start = rangeStartTs(range);
    return visibleTxns.filter((t) => {
      if (t.transactedAt < start) return false;
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      return !t.isTransfer && !cat?.isTransfer;
    });
  }, [visibleTxns, range, catById]);

  const { income, spending, net, savingsRate } = useMemo(() => {
    let inc = 0;
    let spd = 0;
    for (const t of periodTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.isIncome || (!cat && t.amount > 0)) inc += t.amount;
      else spd += Math.abs(t.amount);
    }
    const n = inc - spd;
    const rate = inc > 0 ? Math.round((n / inc) * 100) : 0;
    return { income: inc, spending: spd, net: n, savingsRate: rate };
  }, [periodTxns, catById]);

  const monthlyBuckets = useMemo(() => {
    const map = new Map<string, { month: string; income: number; spending: number }>();
    for (const t of periodTxns) {
      const mk = monthKeyFromTs(t.transactedAt);
      const cur = map.get(mk) ?? { month: mk, income: 0, spending: 0 };
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.isIncome || (!cat && t.amount > 0)) cur.income += t.amount;
      else cur.spending += Math.abs(t.amount);
      map.set(mk, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [periodTxns, catById]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; amount: number }>();
    for (const t of periodTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.isIncome || (!cat && t.amount > 0)) continue;
      const id = cat?.id ?? "__uncat__";
      const cur = map.get(id) ?? {
        id,
        name: cat?.name ?? "Uncategorized",
        icon: cat?.icon ?? "•",
        amount: 0,
      };
      cur.amount += Math.abs(t.amount);
      map.set(id, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [periodTxns, catById]);

  const embeddedTxns = useMemo(() => {
    return periodTxns.filter((t) => {
      if (selectedMonth && monthKeyFromTs(t.transactedAt) !== selectedMonth) return false;
      if (selectedCatId) {
        const cid = t.categoryId ?? "__uncat__";
        if (cid !== selectedCatId) return false;
      }
      return true;
    });
  }, [periodTxns, selectedMonth, selectedCatId]);

  const embeddedTotals = useMemo(() => {
    let spd = 0;
    let inc = 0;
    for (const t of embeddedTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (cat?.isIncome || (!cat && t.amount > 0)) inc += t.amount;
      else spd += Math.abs(t.amount);
    }
    return { spent: spd, income: inc, net: inc - spd };
  }, [embeddedTxns, catById]);

  const maxBucket = Math.max(1, ...monthlyBuckets.flatMap((b) => [b.income, b.spending]));
  const activeHover = monthlyBuckets.find((b) => b.month === hoveredMonth) ?? null;

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
          <p
            style={{
              margin: "0 0 var(--space-4)",
              fontSize: 11,
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-tertiary)",
            }}
          >
            Read-only Cash Flow
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink-primary)",
            }}
          >
            Reports &amp; Cash Flow
          </h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {(["1M", "3M", "6M", "YTD", "1Y"] as const).map((r) => (
            <Pill
              key={r}
              size="sm"
              active={range === r}
              onClick={() => {
                setRange(r);
                setSelectedMonth(null);
              }}
            >
              {r}
            </Pill>
          ))}
        </div>
      </header>

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "var(--space-12)",
          marginBottom: "var(--space-16)",
        }}
      >
        <Card padding="sm" eyebrow="Income">
          <div style={{ fontSize: 24, fontWeight: "var(--weight-semibold)", color: "var(--income)", fontVariantNumeric: "tabular-nums" }}>
            {money(income)}
          </div>
        </Card>
        <Card padding="sm" eyebrow="Spending">
          <div style={{ fontSize: 24, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)", fontVariantNumeric: "tabular-nums" }}>
            {money(spending)}
          </div>
        </Card>
        <Card padding="sm" eyebrow="Net Cash Flow">
          <div
            style={{
              fontSize: 24,
              fontWeight: "var(--weight-semibold)",
              color: net >= 0 ? "var(--income)" : "var(--expense)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {signedMoney(net, false)}
          </div>
        </Card>
        <Card padding="sm" eyebrow="Savings Rate">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
            <span style={{ fontSize: 24, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
              {savingsRate}%
            </span>
            <Badge tone={savingsRate >= 20 ? "income" : savingsRate >= 0 ? "neutral" : "expense"}>
              {savingsRate >= 20 ? "Healthy" : savingsRate >= 0 ? "Balanced" : "Deficit"}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Interactive Charts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--space-16)",
          marginBottom: "var(--space-20)",
        }}
      >
        <ChartCard
          eyebrow="Monthly Cash Flow"
          title="Income vs. Spending"
          subtitle={
            activeHover
              ? `${formatMonthLabel(activeHover.month)}: ${money(activeHover.income)} in · ${money(activeHover.spending)} out`
              : "Click a month bar to filter transactions below"
          }
          isEmpty={monthlyBuckets.length === 0}
          legend={[
            { label: "Income", color: "var(--income)" },
            { label: "Spending", color: "var(--brand)" },
          ]}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "var(--space-12)",
              height: 170,
              padding: "var(--space-12) var(--space-4) 0",
            }}
          >
            {monthlyBuckets.map((b) => {
              const incH = Math.max(4, Math.round((b.income / maxBucket) * 126));
              const spdH = Math.max(4, Math.round((b.spending / maxBucket) * 126));
              const isSelected = selectedMonth === b.month;
              return (
                <button
                  key={b.month}
                  type="button"
                  onClick={() => setSelectedMonth((cur) => (cur === b.month ? null : b.month))}
                  onMouseEnter={() => setHoveredMonth(b.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  style={{
                    flex: 1,
                    minWidth: 36,
                    background: isSelected ? "var(--brand-soft)" : "transparent",
                    border: isSelected ? "1px solid var(--brand)" : "1px solid transparent",
                    borderRadius: "var(--radius-s)",
                    padding: "var(--space-4)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "var(--space-8)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 130 }}>
                    <div
                      style={{
                        width: 12,
                        height: incH,
                        borderRadius: "4px 4px 0 0",
                        background: "var(--income)",
                      }}
                    />
                    <div
                      style={{
                        width: 12,
                        height: spdH,
                        borderRadius: "4px 4px 0 0",
                        background: "var(--brand)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                    {formatMonthLabel(b.month)}
                  </span>
                </button>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard
          eyebrow="Top Categories"
          title="Spending Breakdown"
          subtitle="Click a category to filter transactions below"
          isEmpty={categoryBreakdown.length === 0}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            {categoryBreakdown.map((c) => {
              const pct = spending > 0 ? Math.round((c.amount / spending) * 100) : 0;
              const active = selectedCatId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCatId((cur) => (cur === c.id ? null : c.id))}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: active ? "var(--brand-soft)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-s)",
                    padding: "var(--space-4) var(--space-8)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: "var(--weight-medium)", color: "var(--ink-primary)" }}>
                      {c.icon} {c.name}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-secondary)" }}>
                      {money(c.amount)} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--track)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(3, pct))}%`,
                        height: "100%",
                        borderRadius: "var(--radius-full)",
                        background: active ? "var(--brand-dark)" : "var(--brand)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Embedded Filtered Transactions + Sticky Summary */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flexWrap: "wrap", marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: 0, color: "var(--ink-primary)" }}>
          Filtered Activity
        </h2>
        {selectedMonth && (
          <Pill size="sm" active onClick={() => setSelectedMonth(null)}>
            {formatMonthLabel(selectedMonth)} ×
          </Pill>
        )}
        {selectedCatId && (
          <Pill size="sm" active onClick={() => setSelectedCatId(null)}>
            {categoryBreakdown.find((c) => c.id === selectedCatId)?.name ?? "Category"} ×
          </Pill>
        )}
      </div>

      <div className="ds-inspector-layout">
        <Card padding="none" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {embeddedTxns.length === 0 ? (
            <div style={{ padding: "var(--space-24)", color: "var(--ink-tertiary)", fontSize: 14 }}>
              No transactions match the active report filters.
            </div>
          ) : (
            embeddedTxns.slice(0, 80).map((tx, idx) => {
              const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
              const acct = acctById.get(tx.accountId);
              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-12)",
                    padding: "var(--space-12) var(--space-16)",
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
                      {cat?.name || "Uncategorized"} · {acct?.nickname || acct?.name || "Account"} ·{" "}
                      {formatShortDate(tx.transactedAt)}
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

        <Card
          padding="md"
          eyebrow="Summary"
          title={`${embeddedTxns.length} transactions`}
          style={{ width: 280, flexShrink: 0, position: "sticky", top: "calc(var(--topbar-height) + var(--space-16))" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", fontSize: 13.5, marginBottom: "var(--space-16)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-tertiary)" }}>Income</span>
              <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--income)", fontVariantNumeric: "tabular-nums" }}>
                {money(embeddedTotals.income, true)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-tertiary)" }}>Spent</span>
              <span style={{ fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                {money(embeddedTotals.spent, true)}
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
                  color: embeddedTotals.net >= 0 ? "var(--income)" : "var(--expense)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {signedMoney(embeddedTotals.net, true)}
              </span>
            </div>
          </div>
          <Pill
            variant="brand"
            size="md"
            style={{ width: "100%" }}
            onClick={() => downloadTransactionsCsv(embeddedTxns, catById, acctById, `wooli-report-${range}.csv`)}
          >
            Download CSV
          </Pill>
        </Card>
      </div>
    </div>
  );
}

export function BudgetForecastView({
  accounts,
  visibleTxns,
  catById,
  recurringItems,
}: {
  accounts: AccountRecord[];
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  recurringItems: RecurringItemRecord[];
}) {
  const [horizonMonths, setHorizonMonths] = useState<3 | 6 | 12>(6);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const liquidCash = useMemo(
    () =>
      accounts
        .filter((a) => !a.isHidden && (a.kindRaw.toLowerCase() === "checking" || a.kindRaw.toLowerCase() === "savings"))
        .reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  const avgMonthly = useMemo(() => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();
    let inc = 0;
    let spd = 0;
    for (const t of visibleTxns) {
      if (t.transactedAt < threeMonthsAgo) continue;
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      if (cat?.isIncome || (!cat && t.amount > 0)) inc += t.amount;
      else spd += Math.abs(t.amount);
    }
    const monthlyIncome = inc / 3;
    const monthlySpend = spd / 3;
    return { monthlyIncome, monthlySpend, monthlyNet: monthlyIncome - monthlySpend };
  }, [visibleTxns, catById]);

  const projection = useMemo(() => {
    const now = new Date();
    const pts: Array<{ label: string; balance: number }> = [];
    for (let i = 0; i <= horizonMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      pts.push({
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        balance: liquidCash + avgMonthly.monthlyNet * i,
      });
    }
    return pts;
  }, [liquidCash, avgMonthly.monthlyNet, horizonMonths]);

  const endBalance = projection[projection.length - 1]?.balance ?? liquidCash;
  const activeRecurring = useMemo(
    () => recurringItems.filter((r) => r.isActive).sort((a, b) => a.nextDate - b.nextDate),
    [recurringItems],
  );

  const w = 640;
  const h = 180;
  const vals = projection.map((p) => p.balance);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(1, ...vals);
  const span = Math.max(1, maxV - minV);
  const svgPoints = projection.map((p, i) => {
    const x = projection.length <= 1 ? w / 2 : 24 + (i / (projection.length - 1)) * (w - 48);
    const y = h - 24 - ((p.balance - minV) / span) * (h - 44);
    return { ...p, x, y };
  });
  const lineD = svgPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const activePt = hoveredIdx !== null ? svgPoints[hoveredIdx] : svgPoints[svgPoints.length - 1];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
          <p
            style={{
              margin: "0 0 var(--space-4)",
              fontSize: 11,
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-tertiary)",
            }}
          >
            Read-only Runway
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              color: "var(--ink-primary)",
            }}
          >
            Cash Forecast
          </h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          {([3, 6, 12] as const).map((m) => (
            <Pill key={m} size="sm" active={horizonMonths === m} onClick={() => setHorizonMonths(m)}>
              {m}M
            </Pill>
          ))}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-12)",
          marginBottom: "var(--space-16)",
        }}
      >
        <Card padding="sm" eyebrow="Liquid Cash">
          <div style={{ fontSize: 24, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
            {money(liquidCash)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Checking + Savings</div>
        </Card>
        <Card padding="sm" eyebrow="Avg Monthly Net">
          <div
            style={{
              fontSize: 24,
              fontWeight: "var(--weight-semibold)",
              color: avgMonthly.monthlyNet >= 0 ? "var(--income)" : "var(--expense)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {signedMoney(avgMonthly.monthlyNet, false)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>Trailing 3-month pace</div>
        </Card>
        <Card padding="sm" eyebrow={`Projected (${horizonMonths}M)`}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
            <span style={{ fontSize: 24, fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
              {money(endBalance)}
            </span>
            <Badge tone={endBalance >= liquidCash ? "income" : endBalance > 0 ? "pending" : "expense"}>
              {endBalance >= liquidCash ? "Growing" : endBalance > 0 ? "Drawing" : "Low"}
            </Badge>
          </div>
        </Card>
      </div>

      <ChartCard
        eyebrow="Runway Projection"
        title="Projected Liquid Cash"
        metric={activePt ? money(activePt.balance) : money(endBalance)}
        subtitle={activePt ? `Projected for ${activePt.label}` : undefined}
        className="mb-4"
      >
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 190, display: "block" }}>
          <path d={lineD} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
          {svgPoints.map((pt, i) => (
            <g key={pt.label}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === i ? 5 : 3.5}
                fill={hoveredIdx === i ? "var(--brand-dark)" : "var(--brand)"}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              <text x={pt.x} y={h - 6} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </ChartCard>

      {activeRecurring.length > 0 && (
        <Card padding="none" style={{ marginTop: "var(--space-16)", overflow: "hidden" }}>
          <div
            style={{
              padding: "var(--space-12) var(--space-20)",
              borderBottom: "1px solid var(--border-hairline)",
              background: "var(--bg-paper-soft)",
              fontSize: 12,
              fontWeight: "var(--weight-semibold)",
              color: "var(--ink-secondary)",
            }}
          >
            Active Recurring Commitments ({activeRecurring.length})
          </div>
          {activeRecurring.slice(0, 10).map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-12) var(--space-20)",
                borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: "var(--weight-medium)", color: "var(--ink-primary)" }}>
                  {item.title || item.merchant}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                  {item.cadenceRaw} · Next {formatShortDate(item.nextDate)}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "var(--weight-semibold)",
                  fontVariantNumeric: "tabular-nums",
                  color: item.amount > 0 ? "var(--income)" : "var(--ink-primary)",
                }}
              >
                {signedMoney(item.amount)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
