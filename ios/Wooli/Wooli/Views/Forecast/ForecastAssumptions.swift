#if os(macOS)
import SwiftUI
import AppKit

// MARK: - Edit assumptions (inspector)

struct ForecastAssumptions: View {
    @Binding var plan: ForecastPlan
    let actualSpending: Double
    var onClose: () -> Void

    @State private var expandedPeople: Set<String> = []
    @State private var editingIncome: String?
    @State private var pasteNote: String?
    @State private var showWithdrawalOrder = false
    @State private var showSavingsSplit = false

    private static let icons = ["safari", "house", "sun.horizon", "airplane", "graduationcap", "stroller", "leaf", "star"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                HStack {
                    Text("Edit assumptions").font(.title3.weight(.semibold))
                    Spacer()
                    Button(action: onClose) { Image(systemName: "xmark") }.buttonStyle(.borderless)
                }

                section("Scenario name and icon") {
                    HStack {
                        Menu {
                            ForEach(Self.icons, id: \.self) { icon in
                                Button { plan.icon = icon } label: { Image(systemName: icon) }
                            }
                        } label: { Image(systemName: plan.icon) }
                        .menuStyle(.borderlessButton)
                        .fixedSize()
                        TextField("Name", text: $plan.name).textFieldStyle(.roundedBorder)
                    }
                }

                section("Participants") {
                    ForEach($plan.people) { $person in personCard($person) }
                    Button("Add person", systemImage: "plus.circle") {
                        plan.people.append(ForecastPerson(name: "Partner", birthYear: (plan.primaryPerson?.birthYear ?? 1996) + 2,
                                                          colorHex: "#0ea5e9"))
                    }
                    .buttonStyle(.borderless)
                }

                section("Current income sources") {
                    ForEach($plan.incomes) { $income in incomeCard($income) }
                    Menu {
                        Button("Salary or other income", systemImage: "building.2") {
                            let owner = plan.primaryPerson
                            plan.incomes.append(ForecastIncome(name: "Income (\(owner?.name ?? "new"))", ownerId: owner?.id))
                            editingIncome = plan.incomes.last?.id
                        }
                        Button("RSUs / stock grants", systemImage: "chart.line.uptrend.xyaxis") {
                            let owner = plan.primaryPerson
                            var inc = ForecastIncome(name: "RSUs (\(owner?.name ?? "new"))", ownerId: owner?.id)
                            inc.isBeforeTax = true
                            inc.payGrowth = .equity
                            var equity = ForecastEquity()
                            equity.grants = [ForecastGrant(name: "Initial grant")]
                            inc.equity = equity
                            plan.incomes.append(inc)
                            editingIncome = plan.incomes.last?.id
                        }
                    } label: { Label("Add new", systemImage: "plus.circle") }
                    .menuStyle(.borderlessButton).fixedSize()
                }

                box {
                    Toggle(isOn: $plan.useActualExpenses) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Use actual expenses as baseline").font(.callout.weight(.semibold))
                            Text("Wooli uses the last 12 months of spending to set your starting cash flow.")
                                .font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .toggleStyle(.switch)
                    .onChange(of: plan.useActualExpenses) { _, on in
                        if on, actualSpending > 0 { plan.yearlyExpenses = actualSpending.rounded() }
                    }
                    Text("Yearly living expenses").font(.callout.weight(.medium)).padding(.top, Space.s)
                    if plan.useActualExpenses {
                        Text("\(plan.yearlyExpenses.currency(cents: false)) a year, from the last 12 months")
                            .padding(Space.s).frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.track.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
                    } else {
                        moneyField("Yearly expenses", value: $plan.yearlyExpenses)
                    }
                    Text("Change over time").font(.callout.weight(.medium)).padding(.top, Space.s)
                    Picker("Change over time", selection: Binding(get: { plan.expenseChange.map { Int(($0 * 1000).rounded()) } ?? -1 },
                                                                  set: { plan.expenseChange = $0 < 0 ? nil : Double($0) / 1000 })) {
                        Text("Match inflation (\(ForecastFormat.percent(plan.settings.inflation)))").tag(-1)
                        ForEach([0, 10, 20, 40, 50], id: \.self) { Text("\(ForecastFormat.percent(Double($0) / 1000)) a year").tag($0) }
                    }
                    .labelsHidden()
                }

                if plan.incomes.contains(where: \.isBeforeTax) {
                    box {
                        Text("Taxes").font(.callout.weight(.semibold))
                        Text("Salaries entered before tax are taxed with 2026 federal, Social Security, Medicare and state brackets, kept up with inflation.")
                            .font(.caption).foregroundStyle(Theme.textSecondary)
                        if plan.people.count > 1 {
                            Picker("Filing", selection: $plan.filing) {
                                ForEach(FilingStatus.allCases) { Text($0.label).tag($0) }
                            }
                            .labelsHidden()
                            if plan.filing == .joint {
                                Toggle("Starting in a later year", isOn: Binding(get: { plan.marriedYear != nil },
                                                                                 set: { plan.marriedYear = $0 ? ForecastEngine.startYear() + 1 : nil }))
                                if let y = plan.marriedYear {
                                    Stepper("From \(String(y))", value: Binding(get: { y }, set: { plan.marriedYear = $0 }),
                                            in: ForecastEngine.startYear()...(ForecastEngine.startYear() + 30))
                                }
                            }
                        }
                        Text("Not included: credits, itemized deductions, and tax on Social Security or retirement withdrawals.")
                            .font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                }

                box {
                    Text("Yearly inflation rate").font(.callout.weight(.semibold))
                    Text("Most financial plans use 2–3%. The long-term U.S. average is around 3%.")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                    rateSlider($plan.settings.inflation, range: 0...0.08)
                    Text("Show future values in").font(.callout.weight(.medium)).padding(.top, Space.s)
                    Picker("Show values in", selection: $plan.settings.showTodaysDollars) {
                        Text("Today's dollars (recommended)").tag(true)
                        Text("Future dollars").tag(false)
                    }
                    .labelsHidden()
                    Text("You always enter amounts in today's dollars. **Today's dollars** factors in inflation but shows numbers in current terms, so they compare across years. **Future dollars** shows the actual amounts.")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }

                box {
                    Text("Growth rates").font(.callout.weight(.semibold))
                    Text("Investments").font(.caption).foregroundStyle(Theme.textSecondary)
                    rateSlider($plan.settings.investmentGrowth, range: 0...0.12)
                    Text("Cash and Extra savings").font(.caption).foregroundStyle(Theme.textSecondary)
                    rateSlider($plan.settings.cashGrowth, range: 0...0.08)
                    Text("Market volatility (simulation)").font(.caption).foregroundStyle(Theme.textSecondary)
                    rateSlider($plan.settings.volatility, range: 0...0.3)
                }

                box {
                    Text("Accounts").font(.callout.weight(.semibold))
                    ForEach($plan.accounts) { $account in accountRow($account) }
                    if plan.accounts.isEmpty {
                        Text("No accounts in this plan yet.").font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                    Button("Add account", systemImage: "plus.circle") {
                        plan.accounts.append(ForecastAccount(name: "New account", kind: .investment))
                    }
                    .buttonStyle(.borderless)
                }

                box {
                    Text("Split extra savings").font(.callout.weight(.semibold))
                    Text("When you're forecast to earn more than you spend, choose which accounts the extra goes into.")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                    Button("Change savings splits") { showSavingsSplit = true }
                        .popover(isPresented: $showSavingsSplit) { savingsSplitEditor.padding().frame(width: 340) }
                }

                box {
                    Text("Expense withdrawal order").font(.callout.weight(.semibold))
                    Text("The order your savings and investments are used to cover expenses in retirement and other events.")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                    Button("Change withdrawal order") { showWithdrawalOrder = true }
                        .popover(isPresented: $showWithdrawalOrder) { withdrawalOrderEditor.padding().frame(width: 340, height: 320) }
                }
            }
            .padding(Space.l)
        }
        .background(Theme.background)
    }

    // MARK: Pieces

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Space.s) {
            Text(title).font(.callout.weight(.semibold))
            content()
        }
    }

    private func box<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Space.s) { content() }.card(padding: Space.l)
    }

    private func rateSlider(_ value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        HStack {
            Slider(value: value, in: range, step: 0.005).tint(Theme.brand)
            Text(ForecastFormat.percent(value.wrappedValue)).monospacedDigit().frame(width: 52, alignment: .trailing)
        }
    }

    private func moneyField(_ label: String, value: Binding<Double>) -> some View {
        TextField(label, value: value, format: .currency(code: "USD").precision(.fractionLength(0)))
            .textFieldStyle(.roundedBorder)
    }

    private func personCard(_ person: Binding<ForecastPerson>) -> some View {
        let p = person.wrappedValue
        let open = expandedPeople.contains(p.id)
        return VStack(alignment: .leading, spacing: Space.s) {
            Button {
                withAnimation(.snappy) { if open { expandedPeople.remove(p.id) } else { expandedPeople.insert(p.id) } }
            } label: {
                HStack(spacing: Space.s) {
                    Image(systemName: "chevron.right").font(.caption.weight(.bold)).rotationEffect(.degrees(open ? 90 : 0))
                    ForecastAvatar(person: p)
                    Text(p.name.isEmpty ? "Person" : p.name).font(.body.weight(.medium))
                    Spacer()
                    Text("Age \(p.currentAge)").foregroundStyle(Theme.textSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                Grid(alignment: .leading, horizontalSpacing: Space.m, verticalSpacing: Space.s) {
                    GridRow { Text("Name"); TextField("Name", text: person.name).textFieldStyle(.roundedBorder) }
                    GridRow {
                        Text("Birth year")
                        TextField("Year", value: person.birthYear, format: .number.grouping(.never)).textFieldStyle(.roundedBorder)
                    }
                    GridRow { Text("Retire at"); Stepper("\(p.retirementAge) (\(String(p.retirementYear)))", value: person.retirementAge, in: max(p.currentAge, 30)...85) }
                    GridRow { Text("Plan until"); Stepper("Age \(p.endAge)", value: person.endAge, in: max(p.retirementAge, p.currentAge + 1)...110) }
                    GridRow {
                        Text("Lives in")
                        Picker("Lives in", selection: person.taxRegion) {
                            ForEach(TaxRegion.allCases) { Text($0.label).tag($0) }
                        }
                        .labelsHidden()
                    }
                    if p.taxRegion == .other {
                        GridRow {
                            Text("State rate")
                            rateSlider(Binding(get: { p.otherStateRate ?? 0.05 }, set: { person.wrappedValue.otherStateRate = $0 }), range: 0...0.15)
                        }
                    }
                    GridRow { Text("Social Security"); moneyField("Monthly", value: person.socialSecurityMonthly) }
                    GridRow { Text("Claim at"); Stepper("Age \(p.socialSecurityAge)", value: person.socialSecurityAge, in: 62...70) }
                }
                .font(.callout)
                Text("Monthly benefit in today's dollars — find yours at ssa.gov/myaccount.")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
                if plan.people.count > 1 {
                    Button("Remove \(p.name)", role: .destructive) {
                        plan.people.removeAll { $0.id == p.id }
                        for i in plan.incomes.indices where plan.incomes[i].ownerId == p.id { plan.incomes[i].ownerId = plan.primaryPerson?.id }
                    }
                    .buttonStyle(.borderless)
                    .font(.caption)
                }
            }
        }
        .card(padding: Space.m)
    }

    private func incomeCard(_ income: Binding<ForecastIncome>) -> some View {
        let inc = income.wrappedValue
        let open = editingIncome == inc.id
        return VStack(alignment: .leading, spacing: Space.s) {
            Button {
                withAnimation(.snappy) { editingIncome = open ? nil : inc.id }
            } label: {
                HStack {
                    Image(systemName: "building.2").foregroundStyle(Theme.textSecondary)
                    Text(inc.name).font(.body.weight(.medium))
                    Spacer()
                    let year = Calendar.current.component(.year, from: .now)
                    Text(ForecastFormat.money(inc.amount(in: year, startYear: year))).foregroundStyle(Theme.textSecondary)
                    Image(systemName: open ? "chevron.down" : "arrow.right").font(.caption)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                TextField("Name", text: income.name).textFieldStyle(.roundedBorder)
                Picker("Owner", selection: income.ownerId) {
                    Text("Shared").tag(String?.none)
                    ForEach(plan.people) { Text($0.name).tag(String?.some($0.id)) }
                }
                if inc.payGrowth != .equity {
                Picker("Amount is", selection: income.isBeforeTax) {
                    Text("Salary before tax").tag(true)
                    Text("Take-home pay").tag(false)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                }
                if inc.payGrowth == .raise || inc.payGrowth == .steps {
                Text(inc.isBeforeTax ? "Yearly salary before tax" : "Yearly take-home income").font(.caption).foregroundStyle(Theme.textSecondary)
                moneyField("Yearly amount", value: income.yearlyAmount)
                }
                if inc.isBeforeTax && inc.payGrowth != .equity {
                    Text("Pre-tax 401(k) per year").font(.caption).foregroundStyle(Theme.textSecondary)
                    HStack {
                        moneyField("401(k)", value: Binding(get: { inc.retirementContribution ?? 0 },
                                                            set: { income.wrappedValue.retirementContribution = $0 }))
                        Button("Max") { income.wrappedValue.retirementContribution = ForecastTax.retirementContributionLimit }
                    }
                    Picker("Goes into", selection: income.retirementAccountId) {
                        Text("First retirement account").tag(String?.none)
                        ForEach(plan.accounts.filter { $0.kind != .debt }) { Text($0.name).tag(String?.some($0.id)) }
                        Text("Extra savings").tag(String?.some(ForecastPlan.extraSavingsId))
                    }
                    takeHomeSummary(inc)
                } else {
                    Text("In today's dollars, after taxes and deductions like insurance and retirement contributions.")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                }
                Text("Stops when its owner retires.").font(.caption).foregroundStyle(Theme.textTertiary)
                payGrowthSection(income)
                Button("Remove", role: .destructive) { plan.incomes.removeAll { $0.id == inc.id } }
                    .buttonStyle(.borderless).font(.caption)
            }
        }
        .card(padding: Space.m)
    }

    /// Promotions: pay that changes from a given year.
    private func paySteps(_ income: Binding<ForecastIncome>) -> some View {
        let steps = income.wrappedValue.paySteps
        return VStack(alignment: .leading, spacing: Space.xs) {
            HStack {
                Text("Pay changes").font(.caption.weight(.semibold))
                Spacer()
                Button {
                    let last = steps.last
                    let year = (last?.year ?? Calendar.current.component(.year, from: .now)) + 1
                    income.wrappedValue.paySteps = steps + [ForecastPayStep(year: year, amount: last?.amount ?? income.wrappedValue.yearlyAmount)]
                } label: { Label("Add", systemImage: "plus") }
                .buttonStyle(.borderless).font(.caption)
            }
            if steps.isEmpty {
                Text("Add a year your pay changes, like a promotion. Each amount is yearly pay in today's dollars and lasts until the next change; the raise adds on top.")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }
            ForEach(steps) { step in
                let binding = Binding<ForecastPayStep>(
                    get: { income.wrappedValue.paySteps.first { $0.id == step.id } ?? step },
                    set: { new in income.wrappedValue.paySteps = income.wrappedValue.paySteps.map { $0.id == step.id ? new : $0 } })
                HStack(spacing: Space.xs) {
                    TextField("Year", value: binding.year, format: .number.grouping(.never))
                        .textFieldStyle(.roundedBorder).frame(width: 56)
                    moneyField("Pay", value: binding.amount).frame(width: 96)
                    TextField("Note", text: binding.label).textFieldStyle(.roundedBorder)
                    Button {
                        income.wrappedValue.paySteps = income.wrappedValue.paySteps.filter { $0.id != step.id }
                    } label: { Image(systemName: "minus.circle") }
                    .buttonStyle(.borderless).foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }

    /// How pay grows: a steady raise, one-off pay changes, or a promotion path.
    /// Switching keeps every option's data.
    private func payGrowthSection(_ income: Binding<ForecastIncome>) -> some View {
        let mode = income.wrappedValue.payGrowth
        return VStack(alignment: .leading, spacing: Space.s) {
            Divider()
            Picker("Pay grows by", selection: Binding<ForecastIncome.PayGrowth>(get: { mode }, set: { new in
                income.wrappedValue.payGrowth = new
                // First time on an option: start it from today's pay.
                if new == .steps, income.wrappedValue.paySteps.isEmpty {
                    income.wrappedValue.paySteps = [ForecastPayStep(year: Calendar.current.component(.year, from: .now) + 1,
                                                                   amount: income.wrappedValue.yearlyAmount)]
                }
                if new == .equity {
                    income.wrappedValue.isBeforeTax = true
                    if income.wrappedValue.equity == nil {
                        var e = ForecastEquity()
                        e.grants = [ForecastGrant(name: "Initial grant")]
                        income.wrappedValue.equity = e
                    }
                }
                if new == .career, income.wrappedValue.career?.levels.isEmpty != false {
                    income.wrappedValue.career = ForecastCareerPath(levels: [
                        ForecastCareerLevel(name: "Now", base: income.wrappedValue.yearlyAmount)])
                }
            })) {
                ForEach(ForecastIncome.PayGrowth.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            if mode == .raise || mode == .steps {
                HStack {
                    Text(mode == .steps ? "Raise after each change" : "Raise above inflation").font(.caption)
                    rateSlider(income.raise, range: 0...0.05)
                }
            }
            switch mode {
            case .raise: EmptyView()
            case .steps: paySteps(income)
            case .career: careerPath(income)
            case .equity: equityEditor(income)
            }
        }
    }

    /// RSUs: grants with a vesting schedule, yearly refreshers, a haircut and price change.
    private func equityEditor(_ income: Binding<ForecastIncome>) -> some View {
        let eq = Binding<ForecastEquity>(get: { income.wrappedValue.equity ?? ForecastEquity() },
                                         set: { income.wrappedValue.equity = $0 })
        let now = Calendar.current.component(.year, from: .now)
        return VStack(alignment: .leading, spacing: Space.s) {
            Text("Taxed as pay in the year shares vest. Values in today's dollars at grant; vests stop when you retire (unvested shares are forfeited).")
                .font(.caption).foregroundStyle(Theme.textTertiary)
            ForEach(eq.wrappedValue.grants) { grant in
                let g = Binding<ForecastGrant>(
                    get: { eq.wrappedValue.grants.first { $0.id == grant.id } ?? grant },
                    set: { new in eq.wrappedValue.grants = eq.wrappedValue.grants.map { $0.id == grant.id ? new : $0 } })
                VStack(alignment: .leading, spacing: Space.xs) {
                    HStack {
                        TextField("Name", text: g.name).textFieldStyle(.roundedBorder)
                        Button {
                            eq.wrappedValue.grants.removeAll { $0.id == grant.id }
                        } label: { Image(systemName: "minus.circle") }
                        .buttonStyle(.borderless).foregroundStyle(Theme.textSecondary)
                    }
                    HStack {
                        moneyField("Grant value", value: g.value)
                        Picker("Granted", selection: g.month) {
                            ForEach(1...12, id: \.self) { Text(Calendar.current.shortMonthSymbols[$0 - 1]).tag($0) }
                        }
                        .labelsHidden().frame(width: 70)
                        Picker("Year", selection: g.year) {
                            ForEach((now - 5)...(now + 5), id: \.self) { Text(String($0)).tag($0) }
                        }
                        .labelsHidden().frame(width: 76)
                    }
                    vestingSchedule(g)
                }
                .padding(Space.s)
                .background(Theme.background, in: RoundedRectangle(cornerRadius: 8))
            }
            Button {
                eq.wrappedValue.grants.append(ForecastGrant(name: "Grant \(eq.wrappedValue.grants.count + 1)"))
            } label: { Label("Add grant", systemImage: "plus") }
            .buttonStyle(.borderless).font(.caption)

            Text("Refreshers").font(.caption.weight(.semibold))
            HStack {
                moneyField("New grant each year", value: eq.refresher)
                Text("from").font(.caption)
                Picker("from", selection: eq.refresherStartYear) {
                    ForEach(now...(now + 10), id: \.self) { Text(String($0)).tag($0) }
                }
                .labelsHidden().frame(width: 76)
            }
            if eq.wrappedValue.refresher > 0 { vestingSchedule(eq.refresherSchedule) }

            HStack {
                Text("Count only").font(.caption)
                Slider(value: Binding(get: { 1 - eq.wrappedValue.haircut }, set: { eq.wrappedValue.haircut = 1 - $0 }), in: 0.5...1, step: 0.05)
                Text("\(Int(((1 - eq.wrappedValue.haircut) * 100).rounded()))%").font(.caption.monospacedDigit()).frame(width: 38)
            }
            Text("Knock some off for leaving before shares vest or the price falling.").font(.caption2).foregroundStyle(Theme.textTertiary)
            HStack {
                Text("Stock price above inflation").font(.caption)
                rateSlider(eq.priceGrowth, range: -0.1...0.1)
            }

            let years = Array(now...(now + 8))
            VStack(alignment: .leading, spacing: 2) {
                Text("Vesting by year").font(.caption.weight(.semibold))
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), spacing: 2) {
                    ForEach(years, id: \.self) { y in
                        Text("\(String(y))  \(ForecastFormat.money(eq.wrappedValue.vesting(in: y)))")
                            .font(.caption2.monospacedDigit()).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .padding(Space.s)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private func vestingSchedule(_ g: Binding<ForecastGrant>) -> some View {
        HStack(spacing: Space.xs) {
            Picker("Vests over", selection: g.years) {
                ForEach(1...6, id: \.self) { Text("\($0) yr").tag($0) }
            }
            .labelsHidden().frame(width: 66)
            Picker("Cliff", selection: g.cliffMonths) {
                Text("No cliff").tag(0)
                Text("6-mo cliff").tag(6)
                Text("1-yr cliff").tag(12)
            }
            .labelsHidden().frame(width: 96)
            Picker("Every", selection: g.everyMonths) {
                Text("Monthly").tag(1)
                Text("Quarterly").tag(3)
                Text("Every 6 mo").tag(6)
                Text("Yearly").tag(12)
            }
            .labelsHidden().frame(width: 96)
        }
        .font(.caption)
    }

    /// The columns "Paste from spreadsheet" reads, with an example and a template to copy.
    private var pasteFormat: some View {
        let rows = [["Level", "Base", "Bonus %", "Years", "+/yr"],
                    ["Analyst", "$100K", "10%", "now", ""],
                    ["Senior", "$130K", "15%", "2", ""],
                    ["Manager", "$170K", "20%", "3", "$5K"]]
        return VStack(alignment: .leading, spacing: 4) {
            Text("To paste: select these 5 columns in Sheets, Excel or Numbers (one row per level, your level now first), copy, then click Paste.")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
            Grid(alignment: .leading, horizontalSpacing: Space.s, verticalSpacing: 2) {
                ForEach(rows.indices, id: \.self) { r in
                    GridRow {
                        ForEach(rows[r].indices, id: \.self) { c in
                            Text(rows[r][c]).font(r == 0 ? .caption2.weight(.semibold) : .caption2.monospacedDigit())
                        }
                    }
                    .foregroundStyle(r == 0 ? Theme.textSecondary : Theme.textTertiary)
                }
            }
            Text("Base: yearly salary ($193 or 193 means $193K). Bonus: % of base. Years: how long at that level (the first row is now; the last level holds). +/yr: optional raise each year at that level. A header row is fine.")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
            Button {
                let tsv = rows.map { $0.joined(separator: "\t") }.joined(separator: "\n")
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(tsv, forType: .string)
                pasteNote = "Template copied. Paste it into a spreadsheet, fill it in, then copy it back."
            } label: { Label("Copy template", systemImage: "doc.on.doc") }
            .buttonStyle(.borderless).font(.caption)
        }
        .padding(Space.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: 8))
    }

    /// Levels with base, bonus and years — filled by hand or pasted from a spreadsheet.
    private func careerPath(_ income: Binding<ForecastIncome>) -> some View {
        let path = Binding<ForecastCareerPath>(get: { income.wrappedValue.career ?? ForecastCareerPath() },
                                               set: { income.wrappedValue.career = $0 })
        let levels = path.wrappedValue.levels
        let now = Calendar.current.component(.year, from: .now)
        return VStack(alignment: .leading, spacing: Space.xs) {
            Text("Your level now first, then each promotion. Base and bonus in today's dollars; the last level holds once its years are up.")
                .font(.caption).foregroundStyle(Theme.textTertiary)
            Grid(alignment: .leading, horizontalSpacing: Space.xs, verticalSpacing: Space.xs) {
                GridRow {
                    Text("Level"); Text("Base"); Text("Bonus"); Text("Yrs"); Text("+/yr"); Color.clear.frame(width: 1, height: 1)
                }
                .font(.caption2).foregroundStyle(Theme.textSecondary)
                ForEach(levels) { level in
                    let l = Binding<ForecastCareerLevel>(
                        get: { path.wrappedValue.levels.first { $0.id == level.id } ?? level },
                        set: { new in path.wrappedValue.levels = path.wrappedValue.levels.map { $0.id == level.id ? new : $0 } })
                    let first = level.id == levels.first?.id
                    GridRow {
                        TextField("Level", text: l.name).frame(minWidth: 44)
                        TextField("Base", value: l.base, format: .currency(code: "USD").precision(.fractionLength(0))).frame(width: 78)
                        TextField("Bonus", value: l.bonusRate, format: .percent.precision(.fractionLength(0))).frame(width: 44)
                        if first {
                            Text("now").font(.caption2).foregroundStyle(Theme.textTertiary)
                        } else {
                            TextField("Yrs", value: l.years, format: .number).frame(width: 30)
                        }
                        TextField("+/yr", value: l.yearlyIncrease, format: .currency(code: "USD").precision(.fractionLength(0))).frame(width: 64)
                        Button {
                            path.wrappedValue.levels.removeAll { $0.id == level.id }
                        } label: { Image(systemName: "minus.circle") }
                        .buttonStyle(.borderless).foregroundStyle(Theme.textSecondary)
                    }
                    .textFieldStyle(.roundedBorder).font(.caption)
                }
            }
            HStack {
                Button {
                    var next = levels.last ?? ForecastCareerLevel(base: income.wrappedValue.yearlyAmount)
                    next.id = UUID().uuidString; next.name = ""
                    path.wrappedValue.levels.append(next)
                } label: { Label("Add level", systemImage: "plus") }
                Button {
                    let text = NSPasteboard.general.string(forType: .string) ?? ""
                    let rows = ForecastCareerPath.parse(text)
                    if rows.isEmpty {
                        pasteNote = "Nothing to paste. Copy rows in the format below (try Copy template), then paste."
                    } else {
                        path.wrappedValue.levels = rows
                        pasteNote = "Pasted \(rows.count) levels."
                    }
                } label: { Label("Paste from spreadsheet", systemImage: "doc.on.clipboard") }
            }
            .buttonStyle(.borderless).font(.caption)
            if let pasteNote { Text(pasteNote).font(.caption2).foregroundStyle(Theme.textSecondary) }
            pasteFormat
            HStack {
                Picker("Next promotion", selection: path.nextPromotionYear) {
                    ForEach(now...(now + 10), id: \.self) { Text(String($0)).tag($0) }
                }
                Picker("in", selection: path.promotionMonth) {
                    ForEach(1...12, id: \.self) { Text(Calendar.current.shortMonthSymbols[$0 - 1]).tag($0) }
                }
                .frame(width: 90)
            }
            .font(.caption)
            if levels.count > 0 {
                let years = Array(now...(now + 14))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pay by year (base + bonus)").font(.caption.weight(.semibold))
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), spacing: 2) {
                        ForEach(years, id: \.self) { y in
                            Text("\(String(y))  \(ForecastFormat.money(path.wrappedValue.pay(in: y)))")
                                .font(.caption2.monospacedDigit()).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .padding(Space.s)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    /// This salary's tax on its own (single filer, owner's state), as a quick check.
    private func takeHomeSummary(_ inc: ForecastIncome) -> some View {
        let owner = plan.person(inc.ownerId) ?? plan.primaryPerson
        let bill = ForecastTax.bill([.init(id: inc.id, wages: inc.yearlyAmount, pretax: inc.pretaxContribution,
                                           region: owner?.taxRegion ?? .newYorkCity, otherRate: owner?.otherStateRate ?? 0.05)],
                                    joint: false)
        let takeHome = inc.yearlyAmount - bill.total - inc.pretaxContribution
        return VStack(alignment: .leading, spacing: 2) {
            Text("≈ \(takeHome.currency(cents: false)) take-home a year").font(.callout.weight(.semibold))
            Text("Federal \(ForecastFormat.money(bill.federal)) · SS & Medicare \(ForecastFormat.money(bill.payroll)) · State/local \(ForecastFormat.money(bill.state))\(inc.pretaxContribution > 0 ? " · 401(k) \(ForecastFormat.money(inc.pretaxContribution))" : "")")
                .font(.caption).foregroundStyle(Theme.textSecondary)
            Text("Filing single in \((owner?.taxRegion ?? .newYorkCity).label), 2026 brackets. Estimate only.")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
        }
        .padding(Space.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 8))
    }

    private func accountRow(_ account: Binding<ForecastAccount>) -> some View {
        let a = account.wrappedValue
        return DisclosureGroup {
            VStack(alignment: .leading, spacing: Space.s) {
                TextField("Name", text: account.name).textFieldStyle(.roundedBorder)
                Picker("Type", selection: account.kind) {
                    ForEach(ForecastAccountKind.allCases) { Label($0.label, systemImage: $0.symbol).tag($0) }
                }
                moneyField("Balance", value: account.balance)
                if a.sourceAccountId != nil {
                    Text("Balance refreshes from \(a.institution.isEmpty ? "the linked account" : a.institution) each time you open Forecast.")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                }
                Toggle("Custom growth rate", isOn: Binding(get: { a.growthRate != nil },
                                                           set: { account.wrappedValue.growthRate = $0 ? plan.settings.growth(for: a.kind) : nil }))
                if a.growthRate != nil {
                    rateSlider(Binding(get: { a.growthRate ?? 0 }, set: { account.wrappedValue.growthRate = $0 }), range: 0...0.25)
                }
                if a.kind == .debt {
                    Text("Yearly payment").font(.caption).foregroundStyle(Theme.textSecondary)
                    moneyField("Yearly payment", value: Binding(get: { a.yearlyPayment ?? a.balance / 5 },
                                                                 set: { account.wrappedValue.yearlyPayment = $0 }))
                }
                Button("Remove from forecast", role: .destructive) { plan.accounts.removeAll { $0.id == a.id } }
                    .buttonStyle(.borderless).font(.caption)
            }
            .padding(.top, Space.xs)
        } label: {
            HStack {
                Image(systemName: a.kind.symbol).foregroundStyle(Theme.textSecondary).frame(width: 18)
                Text(a.name).lineLimit(1)
                Spacer()
                Text(ForecastFormat.money(a.kind == .debt ? -a.balance : a.balance)).monospacedDigit()
                    .foregroundStyle(a.kind == .debt ? Theme.expense : Theme.textSecondary)
            }
        }
    }

    private var savingsSplitEditor: some View {
        let ids = [ForecastPlan.extraSavingsId] + plan.accounts.filter { $0.kind != .debt }.map(\.id)
        let total = ids.reduce(0) { $0 + (plan.savingsSplit[$1] ?? 0) }
        return VStack(alignment: .leading, spacing: Space.m) {
            Text("Split extra savings").font(.headline)
            ForEach(ids, id: \.self) { id in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(plan.accountName(id)).lineLimit(1)
                        Spacer()
                        let share = total > 0 ? (plan.savingsSplit[id] ?? 0) / total : (id == ForecastPlan.extraSavingsId ? 1 : 0)
                        Text(ForecastFormat.percent((share * 100).rounded() / 100)).monospacedDigit().foregroundStyle(Theme.textSecondary)
                    }
                    Slider(value: Binding(get: { plan.savingsSplit[id] ?? 0 }, set: { plan.savingsSplit[id] = $0 }), in: 0...100, step: 5)
                        .tint(Theme.brand)
                }
            }
            Text("Shares are relative — they're scaled to add up to 100%.").font(.caption).foregroundStyle(Theme.textTertiary)
            Button("Reset to Extra savings") { plan.savingsSplit = [:] }.buttonStyle(.borderless)
        }
    }

    private var withdrawalOrderEditor: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            Text("Withdrawal order").font(.headline)
            Text("Drag to reorder. Retirement accounts aren't touched before age \(plan.settings.retirementAccessAge).")
                .font(.caption).foregroundStyle(Theme.textSecondary)
            List {
                ForEach(Array(plan.resolvedWithdrawalOrder.enumerated()), id: \.element) { i, id in
                    HStack {
                        Text("\(i + 1)").monospacedDigit().foregroundStyle(Theme.textTertiary).frame(width: 18)
                        Text(plan.accountName(id))
                        Spacer()
                        Image(systemName: "line.3.horizontal").foregroundStyle(Theme.textTertiary)
                    }
                }
                .onMove { from, to in
                    var order = plan.resolvedWithdrawalOrder
                    order.move(fromOffsets: from, toOffset: to)
                    plan.withdrawalOrder = order
                }
            }
            .listStyle(.bordered)
        }
    }
}

// MARK: - Event editor

struct ForecastEventEditor: View {
    @State var event: ForecastEvent
    let plan: ForecastPlan
    let isNew: Bool
    /// nil = delete.
    var onSave: (ForecastEvent?) -> Void
    var onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.l) {
            HStack(spacing: Space.m) {
                ForecastEventIcon(symbol: event.kind.symbol, color: Color(hex: event.kind.colorHex), size: 40)
                VStack(alignment: .leading) {
                    Text(event.kind.label).font(.title3.weight(.semibold))
                    Text(event.kind.blurb).font(.callout).foregroundStyle(Theme.textSecondary)
                }
            }
            Form {
                TextField("Name", text: $event.title, prompt: Text(event.kind.label))
                Stepper("Year: \(String(event.year))\(ageNote)", value: $event.year,
                        in: ForecastEngine.startYear()...max(plan.endYear, ForecastEngine.startYear()))
                switch event.kind {
                case .buyHome:
                    money("Home price", $event.amount)
                    percent("Down payment", $event.downPayment, 0...1)
                    percent("Mortgage rate", $event.mortgageRate, 0...0.15)
                    Picker("Mortgage", selection: $event.mortgageYears) {
                        Text("15 years").tag(15); Text("20 years").tag(20); Text("30 years").tag(30)
                    }
                    percent("Taxes, insurance & upkeep / yr", $event.carryingCost, 0...0.06)
                    LabeledContent("Cash needed up front", value: ((event.amount * event.downPayment) + event.amount * 0.02).currency(cents: false))
                    LabeledContent("Mortgage payment", value: (ForecastEngine.annuityPayment(event.amount * (1 - event.downPayment),
                                                                                             rate: event.mortgageRate, years: event.mortgageYears) / 12).currency(cents: false) + "/mo")
                case .haveKid:
                    money("Cost per year", $event.amount)
                    Stepper("For \(event.years) years", value: $event.years, in: 1...30)
                case .recurringExpense:
                    money("Cost per year", $event.amount)
                    Stepper("For \(event.years) years", value: $event.years, in: 1...60)
                case .oneTimeExpense:
                    money("Amount", $event.amount)
                case .windfall:
                    money("Amount (after tax)", $event.amount)
                case .careerBreak:
                    Picker("Who", selection: $event.ownerId) {
                        ForEach(plan.people) { Text($0.name).tag(String?.some($0.id)) }
                    }
                    Stepper("For \(event.years) year\(event.years == 1 ? "" : "s")", value: $event.years, in: 1...20)
                    Text("Their income stops for these years; expenses continue.").font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            .formStyle(.grouped)
            Text("Amounts are in today's dollars.").font(.caption).foregroundStyle(Theme.textTertiary)
            HStack {
                if !isNew { Button("Delete event", role: .destructive) { onSave(nil) } }
                Spacer()
                Button("Cancel", action: onCancel).keyboardShortcut(.cancelAction)
                Button(isNew ? "Add event" : "Save") { onSave(event) }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(Space.xl)
        .frame(width: 480)
    }

    private var ageNote: String {
        guard let p = plan.person(event.ownerId) ?? plan.primaryPerson else { return "" }
        return " · \(p.name) \(p.age(in: event.year))"
    }

    private func money(_ label: String, _ value: Binding<Double>) -> some View {
        TextField(label, value: value, format: .currency(code: "USD").precision(.fractionLength(0)))
    }

    private func percent(_ label: String, _ value: Binding<Double>, _ range: ClosedRange<Double>) -> some View {
        LabeledContent(label) {
            HStack {
                Slider(value: value, in: range, step: 0.005)
                Text(ForecastFormat.percent(value.wrappedValue)).monospacedDigit().frame(width: 48, alignment: .trailing)
            }
        }
    }
}

// MARK: - Setup flow

/// Six steps: people, income, accounts, spending, retirement age, done.
struct ForecastSetupFlow: View {
    let people: [Person]
    let accounts: [LocalAccount]
    let actuals: ForecastSeed.Actuals
    let isFirst: Bool
    var onCancel: (() -> Void)?
    var onFinish: (ForecastPlan) -> Void

    @State private var step = 0
    @State private var plan = ForecastPlan()
    @State private var included: Set<String> = []
    @State private var candidates: [ForecastAccount] = []
    @State private var prepared = false
    private let steps = 6

    var body: some View {
        ScrollView {
            VStack(spacing: Space.xl) {
                HStack(spacing: 10) {
                    ForEach(0..<steps, id: \.self) { i in
                        Circle().fill(i == step ? Theme.brand : Theme.track).frame(width: 8, height: 8)
                    }
                }
                .padding(.top, Space.xxl)
                content.frame(maxWidth: 620).id(step)
                HStack {
                    if step > 0 && step < steps - 1 {
                        Button("Go back") { step -= 1 }.controlSize(.large)
                    } else if let onCancel {
                        Button("Cancel", action: onCancel).controlSize(.large)
                    }
                    Spacer()
                    if step < steps - 1 {
                        Button("Continue") { advance() }
                            .buttonStyle(.borderedProminent).controlSize(.large)
                            .keyboardShortcut(.defaultAction)
                            .disabled(step == 0 && plan.people.contains { $0.name.trimmingCharacters(in: .whitespaces).isEmpty })
                    }
                }
                .frame(maxWidth: 620)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Space.xl)
            .padding(.bottom, Space.xxl)
        }
        .background(Theme.background)
        .onAppear(perform: prepare)
    }

    private func prepare() {
        guard !prepared else { return }
        prepared = true
        plan.people = ForecastSeed.people(from: people)
        if let first = plan.people.first { plan.people[0].colorHex = first.colorHex }
        candidates = ForecastSeed.accounts(from: accounts)
        included = Set(candidates.filter { $0.kind != .debt || $0.balance > 0 }.map(\.id))
        plan.yearlyExpenses = actuals.spending.rounded()
        plan.useActualExpenses = actuals.spending > 0
        plan.name = isFirst ? "Baseline forecast" : "New scenario"
    }

    private func advance() {
        if step == 0 {
            plan.incomes = ForecastSeed.incomes(people: plan.people, actuals: actuals)
        }
        if step == 2 {
            plan.accounts = candidates.filter { included.contains($0.id) }
        }
        if step == 1 {
            // A first guess at Social Security from each person's income.
            for i in plan.people.indices where plan.people[i].socialSecurityMonthly == 0 {
                let income = plan.incomes.filter { $0.ownerId == plan.people[i].id }.reduce(0) { $0 + $1.yearlyAmount }
                plan.people[i].socialSecurityMonthly = ForecastPerson.estimatedSocialSecurity(yearlyTakeHome: income)
            }
        }
        step += 1
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case 0: peopleStep
        case 1: incomeStep
        case 2: accountsStep
        case 3: expensesStep
        case 4: retirementStep
        default: doneStep
        }
    }

    private func header(_ title: String, _ subtitle: String) -> some View {
        VStack(spacing: Space.s) {
            Text(title).font(.largeTitle.weight(.semibold)).multilineTextAlignment(.center)
            Text(subtitle).font(.title3).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
        }
        .padding(.bottom, Space.m)
    }

    private var peopleStep: some View {
        VStack(spacing: Space.l) {
            header("Who's in this plan?", "Add yourself and anyone you share finances with. Birth years set everyone's age along the timeline.")
            ForEach($plan.people) { $p in
                HStack(spacing: Space.m) {
                    ForecastAvatar(person: p, size: 36)
                    TextField("Name", text: $p.name).textFieldStyle(.roundedBorder).font(.title3)
                    Text("Born").foregroundStyle(Theme.textSecondary)
                    TextField("Year", value: $p.birthYear, format: .number.grouping(.never))
                        .textFieldStyle(.roundedBorder).frame(width: 80)
                    Text("Age \(p.currentAge)").foregroundStyle(Theme.textSecondary).frame(width: 60)
                    if plan.people.count > 1 {
                        Button { plan.people.removeAll { $0.id == p.id } } label: { Image(systemName: "minus.circle") }
                            .buttonStyle(.borderless)
                    }
                }
                .card(padding: Space.l)
            }
            Button("Add person", systemImage: "plus.circle") {
                plan.people.append(ForecastPerson(name: "", birthYear: plan.people.first?.birthYear ?? 1996, colorHex: "#0ea5e9"))
            }
            .buttonStyle(.borderless)
        }
    }

    private var incomeStep: some View {
        VStack(spacing: Space.l) {
            header("Add take-home income", "Your forecast projects how income, expenses and savings change over time. If your income is variable, a rough estimate is fine.")
            if actuals.totalIncome > 0 {
                Text(actuals.months >= 11.5
                     ? "In the last 12 months, your household take-home income was ~\(actuals.totalIncome.currency(cents: false))."
                     : "Based on your last \(Int(actuals.months.rounded())) months, your household take-home income is ~\(actuals.totalIncome.currency(cents: false)) a year.")
                    .foregroundStyle(Theme.brandDark)
                    .padding(Space.m).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: Radius.small))
            }
            ForEach($plan.incomes) { $inc in
                VStack(alignment: .leading, spacing: Space.s) {
                    Text("Name").font(.callout.weight(.semibold))
                    TextField("Name", text: $inc.name).textFieldStyle(.roundedBorder)
                    Text("Owner").font(.callout.weight(.semibold))
                    Picker("Owner", selection: $inc.ownerId) {
                        ForEach(plan.people) { Text($0.name).tag(String?.some($0.id)) }
                    }
                    .labelsHidden()
                    Picker("Amount is", selection: $inc.isBeforeTax) {
                        Text("Salary before tax").tag(true)
                        Text("Take-home pay").tag(false)
                    }
                    .pickerStyle(.segmented)
                    Text(inc.isBeforeTax ? "Yearly salary before tax" : "Yearly take-home income").font(.callout.weight(.semibold))
                    TextField("Yearly", value: $inc.yearlyAmount, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .textFieldStyle(.roundedBorder)
                    Text(inc.isBeforeTax
                         ? "In today's dollars. Forecast works out federal, Social Security, Medicare and state tax — set where each person lives and any 401(k) in Assumptions."
                         : "In today's dollars, the amount you earn after taxes and deductions like insurance and retirement contributions.")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                    HStack { Spacer(); Button("Remove", role: .destructive) { plan.incomes.removeAll { $0.id == inc.id } }.buttonStyle(.borderless) }
                }
                .card()
            }
            Button("Add income", systemImage: "plus.circle") {
                plan.incomes.append(ForecastIncome(name: "Income", ownerId: plan.primaryPerson?.id))
            }
            .buttonStyle(.borderless)
        }
    }

    private var accountsStep: some View {
        VStack(alignment: .leading, spacing: Space.l) {
            header("Choose your forecast accounts", "Select accounts you'll save into, pay down, and draw from during retirement and career breaks.")
                .frame(maxWidth: .infinity)
            if candidates.isEmpty {
                Text("No accounts with a balance yet — you can add them later in Assumptions.")
                    .foregroundStyle(Theme.textSecondary).frame(maxWidth: .infinity)
            }
            ForEach(ForecastAccountKind.allCases) { kind in
                let list = candidates.filter { $0.kind == kind }
                if !list.isEmpty {
                    Text(kind.label).font(.title3.weight(.semibold))
                    ForEach(list) { a in
                        HStack(spacing: Space.m) {
                            Image(systemName: kind.symbol).font(.title3).foregroundStyle(Theme.brand)
                                .frame(width: 44, height: 44).background(Theme.brandSoft, in: Circle())
                            VStack(alignment: .leading) {
                                Text(a.name).font(.title3)
                                Text("\(a.institution.isEmpty ? "" : a.institution + " · ")Balance: \(ForecastFormat.money(a.balance))")
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Toggle("Include", isOn: Binding(get: { included.contains(a.id) },
                                                            set: { if $0 { included.insert(a.id) } else { included.remove(a.id) } }))
                                .toggleStyle(.switch).labelsHidden()
                        }
                        .card(padding: Space.l)
                    }
                }
            }
        }
    }

    private var expensesStep: some View {
        VStack(spacing: Space.l) {
            header("How much do you spend?", "Your everyday living costs for a year, not counting big one-offs — you'll add those as life events.")
            VStack(alignment: .leading, spacing: Space.m) {
                if actuals.spending > 0 {
                    Toggle("Use my actual spending (\(actuals.spending.currency(cents: false)) a year, from the last \(Int(actuals.months.rounded())) months)",
                           isOn: $plan.useActualExpenses)
                        .onChange(of: plan.useActualExpenses) { _, on in if on { plan.yearlyExpenses = actuals.spending.rounded() } }
                }
                Text("Yearly living expenses").font(.callout.weight(.semibold))
                TextField("Yearly", value: $plan.yearlyExpenses, format: .currency(code: "USD").precision(.fractionLength(0)))
                    .textFieldStyle(.roundedBorder)
                    .disabled(plan.useActualExpenses)
                Text("Grows with inflation by default; you can change that in Assumptions.")
                    .font(.caption).foregroundStyle(Theme.textSecondary)
            }
            .card()
        }
    }

    private var retirementStep: some View {
        VStack(spacing: Space.l) {
            header("Choose a retirement age", "It's okay if you don't know exactly when you plan to retire — your best guess is fine for now, and it's easy to adjust later.")
            ForEach($plan.people) { $p in
                VStack(alignment: .leading, spacing: Space.m) {
                    HStack {
                        ForecastAvatar(person: p, size: 32)
                        Text(p.name).font(.title3.weight(.semibold))
                        Spacer()
                        Text(verbatim: "\(p.retirementYear)").font(.title3).monospacedDigit()
                        Text("(age \(p.retirementAge))").foregroundStyle(Theme.textSecondary)
                    }
                    Slider(value: Binding(get: { Double(p.retirementAge) }, set: { p.retirementAge = Int($0) }),
                           in: Double(max(p.currentAge, 30))...80, step: 1)
                        .tint(Theme.brand)
                }
                .card()
            }
        }
    }

    private var doneStep: some View {
        VStack(spacing: Space.l) {
            header("You're good to go", "Explore your baseline forecast. Add events, play with the timing, and lock in your plan.")
            tip("Add some life events", "See how big decisions affect your long-term picture — buying a home, having a kid, a career break.", "house")
            tip("Play with the chart", "Drag life events and retirement along the timeline to see how timing changes your plan.", "hand.draw")
            tip("Edit assumptions", "Defaults for inflation (\(ForecastFormat.percent(plan.settings.inflation))) and growth (\(ForecastFormat.percent(plan.settings.investmentGrowth))) work for most people — but you can change any of them.", "slider.horizontal.3")
            Button("Go to forecast") { onFinish(plan) }
                .buttonStyle(.borderedProminent).controlSize(.extraLarge)
                .keyboardShortcut(.defaultAction)
        }
    }

    private func tip(_ title: String, _ body: String, _ symbol: String) -> some View {
        HStack(spacing: Space.l) {
            VStack(alignment: .leading, spacing: Space.s) {
                Text(title).font(.title3.weight(.semibold))
                Text(body).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Image(systemName: symbol).font(.largeTitle).foregroundStyle(Theme.brand)
                .frame(width: 90, height: 70).background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: Radius.card))
        }
        .card()
    }
}
#endif
