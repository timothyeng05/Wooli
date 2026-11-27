"use client";

import { useMemo, useState } from "react";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  TransactionRecord,
} from "@/lib/cloudkit/schema";

export type BudgetTab = "dashboard" | "accounts" | "transactions" | "plan" | "categories" | "recurring";

export interface BudgetScreenProps {
  activeTab: BudgetTab;
  onSelectTab: (tab: BudgetTab) => void;
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  transactions: TransactionRecord[];
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

const cardStyle: React.CSSProperties = {
  background: "var(--card, #ffffff)",
  border: "1px solid var(--line, #d8e2f0)",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 2px 10px rgba(15, 27, 51, 0.04)",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--ink-2, #475877)",
  marginBottom: 8,
};

export function BudgetScreen({
  activeTab,
  onSelectTab,
  accounts,
  categories,
  transactions,
}: BudgetScreenProps) {
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctById = useMemo(() => new Map(accounts.map((a) => [a.providerAccountId, a])), [accounts]);
  const hiddenAccountIds = useMemo(
    () => new Set(accounts.filter((a) => a.isHidden).map((a) => a.providerAccountId)),
    [accounts],
  );

  const visibleTxns = useMemo(
    () =>
      transactions
        .filter((t) => !t.isHidden && !t.isSplit && !hiddenAccountIds.has(t.accountId))
        .sort((a, b) => b.transactedAt - a.transactedAt),
    [transactions, hiddenAccountIds],
  );

  switch (activeTab) {
    case "dashboard":
      return (
        <BudgetDashboard
          accounts={accounts}
          categories={categories}
          visibleTxns={visibleTxns}
          catById={catById}
          acctById={acctById}
          onSelectTab={onSelectTab}
        />
      );
    case "accounts":
      return <BudgetAccounts accounts={accounts} />;
    case "transactions":
      return (
        <BudgetTransactions
          accounts={accounts}
          visibleTxns={visibleTxns}
          catById={catById}
          acctById={acctById}
        />
      );
    case "plan":
      return <BudgetPlanView categories={categories} visibleTxns={visibleTxns} catById={catById} />;
    case "categories":
      return <BudgetCategoriesView categories={categories} />;
    case "recurring":
      return <BudgetRecurringView visibleTxns={visibleTxns} catById={catById} />;
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Dashboard                                                               */
/* -------------------------------------------------------------------------- */

function BudgetDashboard({
  accounts,
  categories,
  visibleTxns,
  catById,
  acctById,
  onSelectTab,
}: {
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  acctById: Map<string, AccountRecord>;
  onSelectTab: (tab: BudgetTab) => void;
}) {
  const month = useMemo(() => monthBounds(0), []);
  const monthTxns = useMemo(
    () => visibleTxns.filter((t) => t.transactedAt >= month.start && t.transactedAt < month.end),
    [visibleTxns, month],
  );

  const reviewItems = useMemo(() => visibleTxns.filter((t) => t.needsReview), [visibleTxns]);

  const { earned, spent, plannedIncome, plannedExpenses } = useMemo(() => {
    let earnedSum = 0;
    let spentSum = 0;
    for (const t of monthTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      if (cat?.isIncome) {
        if (t.amount > 0) earnedSum += t.amount;
      } else if (t.amount < 0) {
        spentSum += Math.abs(t.amount);
      }
    }

    const groups = categories.filter((c) => !c.parentId && !c.isTransfer);
    let planIn = 0;
    let planOut = 0;
    for (const g of groups) {
      const children = categories.filter((c) => c.parentId === g.id);
      const target = g.monthlyTarget > 0 ? g.monthlyTarget : children.reduce((s, c) => s + c.monthlyTarget, 0);
      if (g.isIncome) planIn += target;
      else planOut += target;
    }
    return { earned: earnedSum, spent: spentSum, plannedIncome: planIn, plannedExpenses: planOut };
  }, [monthTxns, categories, catById]);

  const visibleAccounts = accounts.filter((a) => !a.isHidden);
  const totalAssets = visibleAccounts
    .filter((a) => isAssetKind(a.kindRaw))
    .reduce((s, a) => s + a.balance, 0);
  const totalDebts = visibleAccounts
    .filter((a) => !isAssetKind(a.kindRaw))
    .reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalDebts;

  // Daily cumulative spending for sparkline
  const dailyCumulative = useMemo(() => {
    const now = new Date();
    const todayDate = now.getDate();
    const daily = new Array(todayDate).fill(0);
    for (const t of monthTxns) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer || cat?.isIncome) continue;
      if (t.amount < 0) {
        const dayIdx = new Date(t.transactedAt).getDate() - 1;
        if (dayIdx >= 0 && dayIdx < todayDate) daily[dayIdx] += Math.abs(t.amount);
      }
    }
    let running = 0;
    return daily.map((v) => {
      running += v;
      return running;
    });
  }, [monthTxns, catById]);

  const recent = visibleTxns.slice(0, 6);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 2px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          Dashboard
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2, #475877)" }}>{month.label}</p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left Column: To Review, Budget Summary, Recent Transactions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {reviewItems.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #0f1b33)" }}>
                  To Review ({reviewItems.length})
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab("transactions")}
                  style={linkBtnStyle}
                >
                  Review all
                </button>
              </div>
              {reviewItems.slice(0, 4).map((tx, idx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink, #0f1b33)" }}>
                      {tx.customTitle || tx.payee || tx.description}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                      {formatShortDate(tx.transactedAt)} · {acctById.get(tx.accountId)?.nickname || acctById.get(tx.accountId)?.name || "Account"}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {signedMoney(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Budget Summary Card */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #0f1b33)" }}>Budget</div>
              <button type="button" onClick={() => onSelectTab("plan")} style={linkBtnStyle}>
                See plan
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PlanSummaryBar label="Income" actual={earned} planned={plannedIncome} tint="#15803d" verb="earned" />
              <PlanSummaryBar
                label="Expenses"
                actual={spent}
                planned={plannedExpenses}
                tint={plannedExpenses > 0 && spent > plannedExpenses ? "#b91c1c" : "var(--brand, #2563eb)"}
                verb="spent"
              />
            </div>
          </div>

          {/* Recent Transactions */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #0f1b33)" }}>Transactions</div>
              <button type="button" onClick={() => onSelectTab("transactions")} style={linkBtnStyle}>
                See all
              </button>
            </div>
            {recent.length === 0 ? (
              <p style={{ margin: "12px 0", fontSize: 13, color: "var(--ink-2, #475877)" }}>No transactions yet</p>
            ) : (
              recent.map((tx, idx) => {
                const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 0",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "var(--paper, #eef3fa)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                      }}
                    >
                      {cat?.icon || "•"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink, #0f1b33)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tx.customTitle || tx.payee || tx.description}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                        {cat?.name || "Uncategorized"} · {formatShortDate(tx.transactedAt)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: tx.amount > 0 ? "#15803d" : "var(--ink, #0f1b33)",
                      }}
                    >
                      {signedMoney(tx.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Spending Pace + Net Worth */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Spending this month</div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink, #0f1b33)",
                marginBottom: 4,
              }}
            >
              {money(spent)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)", marginBottom: 14 }}>
              {plannedExpenses > 0
                ? `${money(plannedExpenses)} planned · ${spent <= plannedExpenses ? `${money(plannedExpenses - spent)} left` : `${money(spent - plannedExpenses)} over`}`
                : `${monthTxns.filter((t) => t.amount < 0 && !t.isTransfer).length} charges this month`}
            </div>
            <SpendingSparkline values={dailyCumulative} target={plannedExpenses} />
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={sectionLabelStyle}>Net Worth</div>
              <button type="button" onClick={() => onSelectTab("accounts")} style={linkBtnStyle}>
                Accounts
              </button>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink, #0f1b33)",
                marginBottom: 12,
              }}
            >
              {money(netWorth)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: "var(--paper, #eef3fa)" }}>
                <div style={{ fontSize: 11, color: "var(--ink-2, #475877)" }}>Assets</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>
                  {money(totalAssets)}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: "var(--paper, #eef3fa)" }}>
                <div style={{ fontSize: 11, color: "var(--ink-2, #475877)" }}>Debts</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                  {money(totalDebts)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpendingSparkline({ values, target }: { values: number[]; target: number }) {
  const maxVal = Math.max(target, values[values.length - 1] ?? 0, 1);
  const w = 320;
  const h = 88;
  if (values.length === 0) return null;

  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w : (i / (values.length - 1)) * w;
      const y = h - (v / maxVal) * (h - 10) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const targetY = target > 0 ? h - (target / maxVal) * (h - 10) - 4 : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 90, display: "block" }}>
      {targetY !== null && (
        <line
          x1="0"
          y1={targetY}
          x2={w}
          y2={targetY}
          stroke="var(--line, #cbd5e1)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      )}
      <polyline fill="none" stroke="var(--brand, #2563eb)" strokeWidth="2.5" strokeLinecap="round" points={pts} />
    </svg>
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
      <header style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Net Worth</div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            margin: "0 0 4px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          {money(netWorth, true)}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2, #475877)" }}>
          {money(totalAssets)} assets · {money(totalDebts)} liabilities
        </p>
      </header>

      {accounts.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "var(--ink-2, #475877)" }}>No accounts synced from iCloud yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((groupName) => {
            const members = visible.filter((a) => accountGroupFor(a.kindRaw) === groupName);
            if (members.length === 0) return null;
            const isAsset = groupName === "Cash" || groupName === "Investments";
            const total = members.reduce((s, a) => s + (isAsset ? a.balance : -Math.abs(a.balance)), 0);
            const shareBase = isAsset ? totalAssets : totalDebts;
            const pct = shareBase > 0 ? Math.round((Math.abs(total) / shareBase) * 100) : 0;

            return (
              <div key={groupName} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line, #d8e2f0)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #0f1b33)" }}>{groupName}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {money(total, true)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2, #475877)", marginTop: 2 }}>
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
                      padding: "13px 20px",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink, #0f1b33)" }}>
                        {acct.nickname || acct.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2, #475877)" }}>
                        {acct.institutionName ? `${acct.institutionName} · ` : ""}
                        {acct.kindRaw}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {money(acct.balance, true)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {hidden.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowHidden((v) => !v)} style={linkBtnStyle}>
                {showHidden ? "Hide hidden accounts" : `Show ${hidden.length} hidden account${hidden.length === 1 ? "" : "s"}`}
              </button>
              {showHidden && (
                <div style={{ ...cardStyle, marginTop: 10, padding: 0, opacity: 0.65 }}>
                  {hidden.map((acct, idx) => (
                    <div
                      key={acct.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 20px",
                        borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                      }}
                    >
                      <span>{acct.nickname || acct.name}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(acct.balance, true)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Transactions                                                            */
/* -------------------------------------------------------------------------- */

function BudgetTransactions({
  accounts,
  visibleTxns,
  catById,
  acctById,
}: {
  accounts: AccountRecord[];
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
  acctById: Map<string, AccountRecord>;
}) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "review" | "expenses" | "income">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reviewCount = useMemo(() => visibleTxns.filter((t) => t.needsReview).length, [visibleTxns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleTxns.filter((tx) => {
      if (accountFilter !== "all" && tx.accountId !== accountFilter) return false;
      if (filterMode === "review" && !tx.needsReview) return false;
      if (filterMode === "expenses" && (tx.amount >= 0 || tx.isTransfer)) return false;
      if (filterMode === "income" && (tx.amount <= 0 || tx.isTransfer)) return false;
      if (!q) return true;
      const catName = (tx.categoryId ? catById.get(tx.categoryId)?.name : "")?.toLowerCase() ?? "";
      return (
        (tx.customTitle || "").toLowerCase().includes(q) ||
        (tx.payee || "").toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        catName.includes(q)
      );
    });
  }, [visibleTxns, search, filterMode, accountFilter, catById]);

  const { spentTotal, incomeTotal } = useMemo(() => {
    let s = 0;
    let inc = 0;
    for (const t of filtered) {
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
      if (t.isTransfer || cat?.isTransfer) continue;
      if (t.amount < 0) s += Math.abs(t.amount);
      else inc += t.amount;
    }
    return { spentTotal: s, incomeTotal: inc };
  }, [filtered, catById]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    for (const tx of filtered.slice(0, 250)) {
      const key = dayKeyFromTs(tx.transactedAt);
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selectedTxn = useMemo(
    () => (selectedId ? filtered.find((t) => t.id === selectedId) ?? null : null),
    [selectedId, filtered],
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ marginBottom: 14 }}>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 10px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          Transactions
        </h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions"
            style={{
              flex: "1 1 220px",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--card, #ffffff)",
              fontSize: 14,
              color: "var(--ink, #0f1b33)",
            }}
          />
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--card, #ffffff)",
              fontSize: 13,
              color: "var(--ink, #0f1b33)",
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

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {(
            [
              ["all", "All"],
              ["review", `Needs Review (${reviewCount})`],
              ["expenses", "Expenses"],
              ["income", "Income"],
            ] as const
          ).map(([key, label]) => {
            const active = filterMode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--brand, #2563eb)" : "var(--line, #cbd5e1)"}`,
                  background: active ? "var(--brand, #2563eb)" : "var(--card, #ffffff)",
                  color: active ? "#ffffff" : "var(--ink, #0f1b33)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 12.5, color: "var(--ink-2, #475877)", marginTop: 10 }}>
          <strong>{filtered.length}</strong> transactions · {money(spentTotal, true)} spent ·{" "}
          <span style={{ color: "#15803d" }}>{money(incomeTotal, true)} income</span>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedTxn ? "minmax(0, 1.4fr) minmax(260px, 1fr)" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groupedByDay.length === 0 ? (
            <div style={cardStyle}>
              <p style={{ margin: 0, color: "var(--ink-2, #475877)" }}>No matching transactions.</p>
            </div>
          ) : (
            groupedByDay.map(([dayKey, items]) => {
              const dayNet = items
                .filter((t) => !t.isTransfer)
                .reduce((s, t) => s + t.amount, 0);
              return (
                <div key={dayKey} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 16px",
                      background: "var(--paper, #eef3fa)",
                      borderBottom: "1px solid var(--line, #d8e2f0)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-2, #475877)",
                    }}
                  >
                    <span>{formatDayHeader(dayKey)}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{signedMoney(dayNet, true)}</span>
                  </div>
                  {items.map((tx, idx) => {
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
                          gap: 10,
                          padding: "11px 16px",
                          border: "none",
                          borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                          background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            background: "var(--paper, #eef3fa)",
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
                              fontWeight: 600,
                              color: "var(--ink, #0f1b33)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {tx.customTitle || tx.payee || tx.description}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                            {cat?.name || "Uncategorized"} · {acct?.nickname || acct?.name || "Account"}
                            {tx.needsReview && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  padding: "1px 6px",
                                  borderRadius: 999,
                                  background: "#fff4dc",
                                  color: "#b45309",
                                  fontWeight: 600,
                                  fontSize: 11,
                                }}
                              >
                                Review
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            color: tx.amount > 0 ? "#15803d" : "var(--ink, #0f1b33)",
                          }}
                        >
                          {signedMoney(tx.amount)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {selectedTxn && (
          <aside style={{ ...cardStyle, position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={sectionLabelStyle}>Transaction Details</div>
              <button type="button" onClick={() => setSelectedId(null)} style={linkBtnStyle}>
                Close
              </button>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>
              {signedMoney(selectedTxn.amount)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
              {selectedTxn.customTitle || selectedTxn.payee || selectedTxn.description}
            </div>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
              <dt style={{ color: "var(--ink-2, #475877)" }}>Date</dt>
              <dd style={{ margin: 0 }}>{new Date(selectedTxn.transactedAt).toLocaleString("en-US")}</dd>
              <dt style={{ color: "var(--ink-2, #475877)" }}>Account</dt>
              <dd style={{ margin: 0 }}>
                {acctById.get(selectedTxn.accountId)?.nickname ||
                  acctById.get(selectedTxn.accountId)?.name ||
                  selectedTxn.accountId}
              </dd>
              <dt style={{ color: "var(--ink-2, #475877)" }}>Category</dt>
              <dd style={{ margin: 0 }}>
                {selectedTxn.categoryId
                  ? `${catById.get(selectedTxn.categoryId)?.icon ?? ""} ${catById.get(selectedTxn.categoryId)?.name ?? selectedTxn.categoryId}`
                  : "Uncategorized"}
              </dd>
              <dt style={{ color: "var(--ink-2, #475877)" }}>Description</dt>
              <dd style={{ margin: 0, wordBreak: "break-word" }}>{selectedTxn.description}</dd>
              {selectedTxn.isTransfer && (
                <>
                  <dt style={{ color: "var(--ink-2, #475877)" }}>Type</dt>
                  <dd style={{ margin: 0 }}>Transfer</dd>
                </>
              )}
            </dl>
          </aside>
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
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => setMonthOffset((m) => m - 1)} style={iconBtnStyle} aria-label="Previous Month">
            ‹
          </button>
          <h1
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: 26,
              fontWeight: 800,
              margin: 0,
              color: "var(--ink, #0f1b33)",
            }}
          >
            {month.label}
          </h1>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={month.isCurrent}
            style={{ ...iconBtnStyle, opacity: month.isCurrent ? 0.35 : 1 }}
            aria-label="Next Month"
          >
            ›
          </button>
        </div>
        {!month.isCurrent && (
          <button type="button" onClick={() => setMonthOffset(0)} style={linkBtnStyle}>
            Today
          </button>
        )}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left/Top: Left to Budget Banner + Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              borderRadius: 14,
              padding: "16px 20px",
              background: leftToBudget < 0 ? "#b91c1c" : "#15803d",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>Left to budget</span>
            <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {money(leftToBudget)}
            </span>
          </div>

          <div style={cardStyle}>
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
                color: "var(--ink, #0f1b33)",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>Summary</span>
              <span>{summaryOpen ? "▾" : "▸"}</span>
            </button>
            {summaryOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <PlanSummaryBar label="Income" actual={earned} planned={plannedIncome} tint="#15803d" verb="earned" />
                <PlanSummaryBar
                  label="Expenses"
                  actual={spent}
                  planned={plannedExpenses}
                  tint={plannedExpenses > 0 && spent > plannedExpenses ? "#b91c1c" : "var(--brand, #2563eb)"}
                  verb="spent"
                />
              </div>
            )}
          </div>

          {uncategorizedSpending > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>❓</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Uncategorized</div>
                  <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>
                    {money(uncategorizedSpending)} spent — review to budget it
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right/Main: Income & Expense Groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {incomeGroups.length > 0 && (
            <PlanGroupSection
              title="Income"
              groups={incomeGroups}
              isIncome
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
  childrenOf,
  plannedForGroup,
  actualForGroup,
  actualByCat,
}: {
  title: string;
  groups: BudgetCategoryRecord[];
  isIncome: boolean;
  childrenOf: (id: string) => BudgetCategoryRecord[];
  plannedForGroup: (g: BudgetCategoryRecord) => number;
  actualForGroup: (g: BudgetCategoryRecord) => number;
  actualByCat: Record<string, number>;
}) {
  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "var(--ink, #0f1b33)" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((g) => {
          const children = childrenOf(g.id);
          const planned = plannedForGroup(g);
          const actual = Math.abs(actualForGroup(g));
          return (
            <div key={g.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "var(--paper, #eef3fa)",
                  borderBottom: children.length > 0 ? "1px solid var(--line, #d8e2f0)" : "none",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {g.icon} {g.name}
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-2, #475877)", fontVariantNumeric: "tabular-nums" }}>
                  {planned > 0 ? `${money(actual)} of ${money(planned)}` : `${money(actual)} ${isIncome ? "earned" : "spent"}`}
                </span>
              </div>
              {children.map((c, idx) => {
                const cActual = Math.abs(actualByCat[c.id] ?? 0);
                const cPlan = c.monthlyTarget;
                const remaining = Math.max(cPlan, 0) - cActual;
                const pct = cPlan > 0 ? Math.min(100, Math.round((cActual / cPlan) * 100)) : 0;
                const barColor = isIncome
                  ? "#15803d"
                  : cActual > cPlan
                    ? "#b91c1c"
                    : cActual >= cPlan * 0.85
                      ? "#b45309"
                      : "var(--brand, #2563eb)";
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "10px 16px",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {c.icon} {c.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>
                          {cPlan > 0 ? `${money(cActual)} / ${money(cPlan)}` : money(cActual)}
                        </span>
                        {cPlan > 0 && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: remaining >= 0 ? "rgba(21,128,61,0.12)" : "rgba(185,28,28,0.12)",
                              color: remaining >= 0 ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {money(remaining)}
                          </span>
                        )}
                      </div>
                    </div>
                    {cPlan > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          height: 5,
                          borderRadius: 999,
                          background: "var(--line, #e2e8f0)",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 4px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          Categories
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2, #475877)" }}>
          {groups.length} groups · {categories.length} total categories
        </p>
      </header>

      {groups.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "var(--ink-2, #475877)" }}>No categories synced yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => {
            const children = categories
              .filter((c) => c.parentId === g.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const badgeText = g.isIncome ? "Income" : g.isTransfer ? "Transfer" : "Spending";
            const badgeColor = g.isIncome ? "#15803d" : g.isTransfer ? "#64748b" : "#2563eb";
            return (
              <div key={g.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 18px",
                    background: "var(--paper, #eef3fa)",
                    borderBottom: children.length > 0 ? "1px solid var(--line, #d8e2f0)" : "none",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{g.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink, #0f1b33)" }}>{g.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: `${badgeColor}1f`,
                      color: badgeColor,
                    }}
                  >
                    {badgeText}
                  </span>
                </div>
                {children.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 18px",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {c.icon} {c.name}
                    </span>
                    {c.monthlyTarget > 0 && (
                      <span style={{ fontSize: 13, color: "var(--ink-2, #475877)", fontVariantNumeric: "tabular-nums" }}>
                        {money(c.monthlyTarget)}/mo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Recurring (detected from live transactions)                             */
/* -------------------------------------------------------------------------- */

interface DetectedRecurring {
  key: string;
  title: string;
  amount: number;
  cadence: "Monthly" | "Weekly" | "Yearly";
  lastDate: number;
  nextDate: number;
  paidThisMonth: boolean;
  categoryId?: string;
}

function BudgetRecurringView({
  visibleTxns,
  catById,
}: {
  visibleTxns: TransactionRecord[];
  catById: Map<string, BudgetCategoryRecord>;
}) {
  const detected = useMemo<DetectedRecurring[]>(() => {
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const results: DetectedRecurring[] = [];

    for (const [key, list] of byMerchant.entries()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => b.transactedAt - a.transactedAt);
      const newest = sorted[0];
      const prev = sorted[1];
      const gapDays = Math.round((newest.transactedAt - prev.transactedAt) / 86400000);
      let cadence: DetectedRecurring["cadence"] | null = null;
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
  }, [visibleTxns, catById]);

  const paid = detected.filter((d) => d.paidThisMonth);
  const upcoming = detected.filter((d) => !d.paidThisMonth);
  const paidTotal = paid.reduce((s, d) => s + Math.abs(d.amount), 0);
  const dueTotal = upcoming.reduce((s, d) => s + Math.abs(d.amount), 0);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 4px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          Recurring
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2, #475877)" }}>
          Bills and subscriptions spotted from repeating transactions
        </p>
      </header>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={sectionLabelStyle}>This month</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{money(dueTotal, true)}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>still due</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink-2, #475877)" }}>
              {money(paidTotal, true)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>paid so far</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--line, #e2e8f0)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${paidTotal + dueTotal > 0 ? Math.round((paidTotal / (paidTotal + dueTotal)) * 100) : 0}%`,
              background: "var(--brand, #2563eb)",
            }}
          />
        </div>
      </div>

      {detected.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "var(--ink-2, #475877)" }}>
            No repeating bills or subscriptions detected yet from your synced transactions.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {upcoming.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", background: "var(--paper, #eef3fa)", fontSize: 12, fontWeight: 700 }}>
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
                      padding: "11px 18px",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {cat?.icon ? `${cat.icon} ` : ""}
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                        {item.cadence} · Est. {formatShortDate(item.nextDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {signedMoney(item.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {paid.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", background: "var(--paper, #eef3fa)", fontSize: 12, fontWeight: 700 }}>
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
                      padding: "11px 18px",
                      borderTop: idx > 0 ? "1px solid var(--line, #e2e8f0)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {cat?.icon ? `${cat.icon} ` : ""}
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                        {item.cadence} · Paid {formatShortDate(item.lastDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#15803d" }}>
                      {signedMoney(item.amount)} ✓
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI helpers                                                          */
/* -------------------------------------------------------------------------- */

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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--ink-2, #475877)", fontVariantNumeric: "tabular-nums" }}>
          {money(actual)} {verb}
          {planned > 0 ? ` of ${money(planned)}` : ""}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "var(--line, #e2e8f0)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tint }} />
      </div>
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--brand, #2563eb)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const iconBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--line, #cbd5e1)",
  background: "var(--card, #ffffff)",
  color: "var(--ink, #0f1b33)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export default BudgetScreen;
