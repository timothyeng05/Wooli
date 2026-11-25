import Foundation
import SwiftData

// Forecasting (Monarch-style long-range plan). The plan itself is a plain
// Codable value so the engine stays testable and the whole scenario syncs as
// one CloudKit record — adding a field later never needs a schema change.

/// One saved scenario ("Baseline forecast", "Buy in 2030", …).
@Model
final class ForecastScenario {
    var id: String = UUID().uuidString
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now
    /// JSON-encoded `ForecastPlan`.
    var payload: Data = Data()

    init(plan: ForecastPlan) {
        self.payload = (try? JSONEncoder().encode(plan)) ?? Data()
    }

    var plan: ForecastPlan {
        get { (try? JSONDecoder().decode(ForecastPlan.self, from: payload)) ?? ForecastPlan() }
        set {
            payload = (try? JSONEncoder().encode(newValue)) ?? payload
            updatedAt = .now
        }
    }
}

struct ForecastPlan: Codable, Equatable {
    var name = "Baseline forecast"
    var icon = "safari"
    var people: [ForecastPerson] = []
    var incomes: [ForecastIncome] = []
    var accounts: [ForecastAccount] = []
    /// Today's dollars per year.
    var yearlyExpenses: Double = 0
    /// Re-read the last 12 months of spending each time the forecast opens.
    var useActualExpenses = true
    /// nil = match inflation; otherwise a fixed yearly change (0.02 = +2%).
    var expenseChange: Double?
    var events: [ForecastEvent] = []
    var settings = ForecastSettings()
    /// Account id → share of surplus. Empty means everything goes to Extra savings.
    var savingsSplit: [String: Double] = [:]
    /// Account ids, first drawn first. Accounts not listed are drawn last.
    var withdrawalOrder: [String] = []
    // Added after the first release: optional so saved plans still decode.
    var filingRaw: String?
    /// Joint filing starts this year (nil = every year).
    var marriedYear: Int?

    var filing: FilingStatus {
        get { filingRaw.flatMap(FilingStatus.init(rawValue:)) ?? .single }
        set { filingRaw = newValue.rawValue }
    }

    func filesJointly(in year: Int) -> Bool {
        filing == .joint && people.count > 1 && year >= (marriedYear ?? .min)
    }

    /// Rolling bucket for surplus cash when no split is set (Monarch's "Extra savings").
    static let extraSavingsId = "extra-savings"

    var primaryPerson: ForecastPerson? { people.first }

    func person(_ id: String?) -> ForecastPerson? { people.first { $0.id == id } }

    /// Last calendar year the plan runs (when the longest-lived person reaches their end age).
    var endYear: Int {
        people.map { $0.birthYear + $0.endAge }.max() ?? (Calendar.current.component(.year, from: .now) + 60)
    }

    /// The order accounts are drawn from, with any account the user didn't place appended.
    var resolvedWithdrawalOrder: [String] {
        let ids = [Self.extraSavingsId] + accounts.filter { $0.kind != .debt }.map(\.id)
        var order = withdrawalOrder.filter(ids.contains)
        let rest = ids.filter { !order.contains($0) }
            .sorted { kindRank($0) < kindRank($1) }
        order.append(contentsOf: rest)
        return order
    }

    private func kindRank(_ id: String) -> Int {
        if id == Self.extraSavingsId { return 0 }
        switch accounts.first(where: { $0.id == id })?.kind {
        case .cash: return 1
        case .investment: return 2
        case .retirement: return 3
        default: return 4
        }
    }

    /// Normalised savings split; falls back to all-in Extra savings.
    var resolvedSavingsSplit: [(id: String, share: Double)] {
        let valid = Set(accounts.filter { $0.kind != .debt }.map(\.id) + [Self.extraSavingsId])
        let entries = savingsSplit.filter { valid.contains($0.key) && $0.value > 0 }
        let total = entries.values.reduce(0, +)
        guard total > 0 else { return [(Self.extraSavingsId, 1)] }
        return entries.sorted { $0.key < $1.key }.map { ($0.key, $0.value / total) }
    }

    func accountName(_ id: String) -> String {
        id == Self.extraSavingsId ? "Extra savings" : accounts.first { $0.id == id }?.name ?? "Account"
    }
}

struct ForecastPerson: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var name = ""
    var birthYear = 1998
    var retirementAge = 65
    /// Age the plan runs to for this person.
    var endAge = 90
    /// Today's dollars per month; 0 = none.
    var socialSecurityMonthly: Double = 0
    var socialSecurityAge = 67
    var colorHex = "#2563eb"
    /// Photo-less avatar (first letter is shown when empty).
    var emoji = ""
    // Optional so plans saved before taxes existed still decode.
    var taxRegionRaw: String?
    var otherStateRate: Double?

    var taxRegion: TaxRegion {
        get { taxRegionRaw.flatMap(TaxRegion.init(rawValue:)) ?? .newYorkCity }
        set { taxRegionRaw = newValue.rawValue }
    }

    var retirementYear: Int { birthYear + retirementAge }
    var socialSecurityYear: Int { birthYear + socialSecurityAge }
    var endYear: Int { birthYear + endAge }
    func age(in year: Int) -> Int { year - birthYear }
    var currentAge: Int { age(in: Calendar.current.component(.year, from: .now)) }

    /// A rough starting point for the benefit, in today's dollars: about 40% of
    /// take-home, capped near the current maximum. The user should replace it
    /// with the number from their SSA statement.
    static func estimatedSocialSecurity(yearlyTakeHome: Double) -> Double {
        min(yearlyTakeHome * 0.4 / 12, 4_000).rounded()
    }
}

struct ForecastIncome: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var name = "Income"
    var ownerId: String?
    /// Today's dollars, after tax.
    var yearlyAmount: Double = 0
    /// Real raise per year on top of inflation (0.01 = 1%).
    var raise: Double = 0
    // Optional so plans saved before taxes existed still decode.
    /// true = `yearlyAmount` is salary before tax; Forecast works out the tax.
    var beforeTaxRaw: Bool?
    /// Pre-tax 401(k)/403(b) per year, today's dollars (salary only).
    var retirementContribution: Double?
    /// Account the contribution goes into (nil = first retirement account, else Extra savings).
    var retirementAccountId: String?

    /// Pay changes from a given year (promotions). Optional for old plans.
    var steps: [ForecastPayStep]?
    /// Promotion path; when set it decides pay instead of `yearlyAmount` and steps.
    var career: ForecastCareerPath?

    var isBeforeTax: Bool {
        get { beforeTaxRaw ?? false }
        set { beforeTaxRaw = newValue }
    }

    var paySteps: [ForecastPayStep] {
        get { (steps ?? []).sorted { $0.year < $1.year } }
        set { steps = newValue.isEmpty ? nil : newValue }
    }

    /// The contribution actually made: capped by the yearly limit and the salary.
    var pretaxContribution: Double { pretaxContribution(on: yearlyAmount) }

    func pretaxContribution(on wages: Double) -> Double {
        guard isBeforeTax else { return 0 }
        return min(max(retirementContribution ?? 0, 0), ForecastTax.retirementContributionLimit, max(wages, 0))
    }

    /// Pay for a year in today's dollars: the latest step on or before it (else
    /// `yearlyAmount`), with the raise compounding from when that pay started.
    func amount(in year: Int, startYear: Int) -> Double {
        if let career, !career.levels.isEmpty {
            return career.pay(in: year) * pow(1 + raise, Double(year - startYear))
        }
        if let step = paySteps.last(where: { $0.year <= year }) {
            return step.amount * pow(1 + raise, Double(year - step.year))
        }
        return yearlyAmount * pow(1 + raise, Double(year - startYear))
    }
}

struct ForecastPayStep: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var year: Int
    /// Yearly pay from this year on, today's dollars (same before/after-tax basis as the income).
    var amount: Double
    var label = ""

    init(id: String = UUID().uuidString, year: Int, amount: Double, label: String = "") {
        self.id = id; self.year = year; self.amount = amount; self.label = label
    }

    // Missing keys fall back to defaults, so hand-written JSON (Claude's edits) decodes.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        year = try c.decode(Int.self, forKey: .year)
        amount = try c.decode(Double.self, forKey: .amount)
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
    }
}

/// A promotion path: each level's base, bonus and how long it lasts. Works for
/// any career with levels (consulting, law, banking, tech ladders).
struct ForecastCareerPath: Codable, Equatable {
    /// levels[0] is the level held now; it lasts until `nextPromotionYear`.
    var levels: [ForecastCareerLevel] = []
    var nextPromotionYear: Int = Calendar.current.component(.year, from: .now) + 1
    /// Month promotions take effect (7 = July). Pay that year is a blend.
    var promotionMonth: Int = 7

    init(levels: [ForecastCareerLevel] = [], nextPromotionYear: Int = Calendar.current.component(.year, from: .now) + 1,
         promotionMonth: Int = 7) {
        self.levels = levels; self.nextPromotionYear = nextPromotionYear; self.promotionMonth = promotionMonth
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        levels = try c.decodeIfPresent([ForecastCareerLevel].self, forKey: .levels) ?? []
        nextPromotionYear = try c.decodeIfPresent(Int.self, forKey: .nextPromotionYear) ?? Calendar.current.component(.year, from: .now) + 1
        promotionMonth = min(max(try c.decodeIfPresent(Int.self, forKey: .promotionMonth) ?? 7, 1), 12)
    }

    /// Base and bonus rate held at a moment (year + fraction through it).
    private func level(at time: Double) -> (base: Double, bonus: Double) {
        guard let first = levels.first else { return (0, 0) }
        let promo = Double(nextPromotionYear) + Double(promotionMonth - 1) / 12
        guard time >= promo, levels.count > 1 else { return (first.base, first.bonusRate) }
        var start = promo
        for (i, l) in levels.enumerated().dropFirst() {
            let span = Double(max(l.years, 1))
            let last = i == levels.count - 1
            if time < start + span || last {
                let yearsIn = Int(min(time - start, span - 1))
                return (l.base + Double(max(yearsIn, 0)) * l.yearlyIncrease, l.bonusRate)
            }
            start += span
        }
        return (first.base, first.bonusRate)
    }

    /// Calendar-year pay: base earned month by month, plus the yearly bonus
    /// (bonus % of the base held on January 1).
    func pay(in year: Int) -> Double {
        var base = 0.0
        for m in 0..<12 { base += level(at: Double(year) + Double(m) / 12).base / 12 }
        let jan = level(at: Double(year))
        return base + jan.base * jan.bonus
    }

    /// Reads rows pasted from a spreadsheet: Name, Base, Bonus %, Years, Yearly increase.
    /// Amounts under 5,000 are read as thousands ($193 → $193,000).
    static func parse(_ text: String) -> [ForecastCareerLevel] {
        func number(_ s: String) -> Double? {
            let clean = s.replacingOccurrences(of: "[$,%\\s]", with: "", options: .regularExpression).lowercased()
            if clean.hasSuffix("k"), let v = Double(clean.dropLast()) { return v * 1_000 }
            if clean.hasSuffix("m"), let v = Double(clean.dropLast()) { return v * 1_000_000 }
            return Double(clean)
        }
        var rows: [ForecastCareerLevel] = []
        for line in text.split(whereSeparator: \.isNewline) {
            let cells = line.split(separator: line.contains("\t") ? "\t" : ",", omittingEmptySubsequences: false)
                .map { $0.trimmingCharacters(in: .whitespaces) }
            guard cells.count >= 2, let base = number(cells[1]) else { continue }
            var l = ForecastCareerLevel(name: cells[0], base: base)
            if cells.count > 2, let b = number(cells[2]) { l.bonusRate = cells[2].contains("%") || b > 1 ? b / 100 : b }
            if cells.count > 3, let y = number(cells[3]) { l.years = max(Int(y), 1) }
            if cells.count > 4, let inc = number(cells[4]) { l.yearlyIncrease = inc }
            rows.append(l)
        }
        if !rows.isEmpty, rows.allSatisfy({ $0.base < 5_000 }) {
            rows = rows.map { var r = $0; r.base *= 1_000; r.yearlyIncrease *= r.yearlyIncrease < 5_000 ? 1_000 : 1; return r }
        }
        return rows
    }
}

struct ForecastCareerLevel: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var name = ""
    /// Base salary, today's dollars.
    var base: Double = 0
    /// Yearly bonus as a share of base (0.24 = 24%).
    var bonusRate: Double = 0
    /// Years at this level before the next promotion (the last level holds).
    var years = 1
    /// Added to base each extra year at this level (the last level stops after `years`).
    var yearlyIncrease: Double = 0

    init(id: String = UUID().uuidString, name: String = "", base: Double = 0, bonusRate: Double = 0,
         years: Int = 1, yearlyIncrease: Double = 0) {
        self.id = id; self.name = name; self.base = base; self.bonusRate = bonusRate
        self.years = years; self.yearlyIncrease = yearlyIncrease
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        base = try c.decodeIfPresent(Double.self, forKey: .base) ?? 0
        bonusRate = try c.decodeIfPresent(Double.self, forKey: .bonusRate) ?? 0
        years = max(try c.decodeIfPresent(Int.self, forKey: .years) ?? 1, 1)
        yearlyIncrease = try c.decodeIfPresent(Double.self, forKey: .yearlyIncrease) ?? 0
    }
}

enum ForecastAccountKind: String, Codable, CaseIterable, Identifiable {
    case cash, investment, retirement, debt
    var id: String { rawValue }

    var label: String {
        switch self {
        case .cash: "Cash & savings"
        case .investment: "Taxable investments"
        case .retirement: "Retirement"
        case .debt: "Debt"
        }
    }

    var symbol: String {
        switch self {
        case .cash: "banknote"
        case .investment: "chart.line.uptrend.xyaxis"
        case .retirement: "sun.horizon"
        case .debt: "creditcard"
        }
    }

    /// Moves with the market in a simulation.
    var isMarket: Bool { self == .investment || self == .retirement }

    init(_ kind: AccountKind, name: String) {
        switch kind {
        case .checking, .savings, .other: self = .cash
        case .credit, .loan: self = .debt
        case .investment:
            let n = name.lowercased()
            self = ["401", "ira", "roth", "403", "pension", "retire"].contains(where: n.contains) ? .retirement : .investment
        }
    }
}

struct ForecastAccount: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var name = ""
    var institution = ""
    var kind: ForecastAccountKind = .investment
    /// Today's balance; debts are stored positive.
    var balance: Double = 0
    /// nil = use the plan's default for this kind.
    var growthRate: Double?
    /// Debts: yearly payment. nil = paid off evenly over 5 years.
    var yearlyPayment: Double?
    var ownerId: String?
    /// The LocalAccount it came from, so balances can be refreshed.
    var sourceAccountId: String?
}

enum ForecastEventKind: String, Codable, CaseIterable, Identifiable {
    case buyHome, haveKid, oneTimeExpense, recurringExpense, windfall, careerBreak

    var id: String { rawValue }

    var label: String {
        switch self {
        case .buyHome: "Buy a home"
        case .haveKid: "Have a kid"
        case .oneTimeExpense: "Big purchase"
        case .recurringExpense: "New yearly expense"
        case .windfall: "Windfall"
        case .careerBreak: "Career break"
        }
    }

    var blurb: String {
        switch self {
        case .buyHome: "Plan for home ownership"
        case .haveKid: "Model the impact of raising children"
        case .oneTimeExpense: "A wedding, a car, a sabbatical trip"
        case .recurringExpense: "Something you'll pay every year for a while"
        case .windfall: "An inheritance, bonus or sale"
        case .careerBreak: "Time off work, travel, or school"
        }
    }

    var symbol: String {
        switch self {
        case .buyHome: "house"
        case .haveKid: "stroller"
        case .oneTimeExpense: "bag"
        case .recurringExpense: "arrow.triangle.2.circlepath"
        case .windfall: "gift"
        case .careerBreak: "graduationcap"
        }
    }

    var colorHex: String {
        switch self {
        case .buyHome: "#0891b2"
        case .haveKid: "#db2777"
        case .oneTimeExpense: "#7c3aed"
        case .recurringExpense: "#64748b"
        case .windfall: "#15803d"
        case .careerBreak: "#9333ea"
        }
    }
}

struct ForecastEvent: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var kind: ForecastEventKind = .oneTimeExpense
    var title = ""
    var year = Calendar.current.component(.year, from: .now) + 5
    /// Today's dollars. Home: price. Kid / yearly: cost per year. One-off: amount.
    var amount: Double = 0
    /// Kid / yearly expense / career break length.
    var years = 1
    var ownerId: String?
    // Home
    var downPayment = 0.2
    var mortgageRate = 0.065
    var mortgageYears = 30
    /// Yearly tax, insurance and upkeep as a share of the price.
    var carryingCost = 0.02

    var displayTitle: String { title.isEmpty ? kind.label : title }

    static func template(_ kind: ForecastEventKind, year: Int) -> ForecastEvent {
        var e = ForecastEvent(kind: kind, year: year)
        switch kind {
        case .buyHome: e.amount = 750_000
        case .haveKid: e.amount = 20_000; e.years = 18
        case .oneTimeExpense: e.amount = 30_000
        case .recurringExpense: e.amount = 10_000; e.years = 10
        case .windfall: e.amount = 50_000
        case .careerBreak: e.years = 1
        }
        return e
    }
}

struct ForecastSettings: Codable, Equatable {
    var inflation = 0.03
    /// Nominal yearly return on investment and retirement accounts.
    var investmentGrowth = 0.07
    /// Nominal yearly return on cash and Extra savings.
    var cashGrowth = 0.03
    /// Yearly standard deviation of market returns in a simulation.
    var volatility = 0.12
    var showTodaysDollars = true
    /// Retirement accounts can't be drawn until the owner turns this age.
    var retirementAccessAge = 60

    func growth(for kind: ForecastAccountKind) -> Double {
        switch kind {
        case .cash: cashGrowth
        case .investment, .retirement: investmentGrowth
        case .debt: 0.07
        }
    }
}
