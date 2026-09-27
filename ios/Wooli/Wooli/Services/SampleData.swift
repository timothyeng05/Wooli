import Foundation
import SwiftData

/// Realistic made-up accounts and ~3 months of transactions, so someone can try
/// the app before connecting a bank (and so it can be demoed in the Simulator).
enum SampleData {
    private struct Pattern {
        let description: String
        let payee: String
        let account: String
        let amount: ClosedRange<Double>
        let everyDays: Int
    }

    static func load(into context: ModelContext) {
        let accounts: [(id: String, name: String, bank: String, balance: Double, kind: AccountKind)] = [
            ("sample-checking", "Everyday Checking", "Chase", 4218.55, .checking),
            ("sample-savings", "High-Yield Savings", "Ally Bank", 18400.00, .savings),
            ("sample-credit", "Sapphire Preferred", "Chase", -1236.40, .credit),
            ("sample-brokerage", "Individual Brokerage", "Fidelity", 32560.12, .investment),
        ]
        for a in accounts {
            let account = LocalAccount(providerAccountId: a.id, name: a.name, institutionName: a.bank,
                                       currency: "USD", balance: a.balance, balanceDate: .now, kind: a.kind)
            account.lastSyncedAt = Date.now.addingTimeInterval(-Double(a.id.count) * 1700)
            context.insert(account)
        }

        // A year of daily balances, walking backwards from today's balance.
        var walk = SeededGenerator(seed: 7)
        let drift: [String: (Double, Double)] = [
            "sample-checking": (0, 380), "sample-savings": (-18, 25),
            "sample-credit": (0, 140), "sample-brokerage": (-55, 320),
        ]
        let startOfToday = Calendar.current.startOfDay(for: .now)
        for a in accounts {
            var balance = a.balance
            let (trend, noise) = drift[a.id] ?? (0, 50)
            for daysAgo in 0..<365 {
                let day = Calendar.current.date(byAdding: .day, value: -daysAgo, to: startOfToday)!
                context.insert(BalanceSnapshot(accountId: a.id, day: day, balance: (balance * 100).rounded() / 100))
                balance += trend + Double.random(in: -noise...noise, using: &walk)
                if a.kind == .credit { balance = min(balance, -50) }
            }
        }

        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let byName = Dictionary(categories.filter { $0.parentId != nil }.map { ($0.name.lowercased(), $0) },
                                uniquingKeysWith: { a, _ in a })
        let targets = ["Food & Dining": 800.0, "Home": 2400, "Travel": 300, "Personal": 400, "Other": 150,
                       "Income": 6500]
        for c in categories where c.parentId == nil { c.monthlyTarget = targets[c.name] ?? 0 }

        var rng = SeededGenerator(seed: 42)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        var counter = 0

        func add(_ description: String, _ account: String, _ amount: Double, daysAgo: Int, pending: Bool = false, payee: String? = nil) {
            counter += 1
            let date = calendar.date(byAdding: .hour, value: 9 + counter % 10, to:
                        calendar.date(byAdding: .day, value: -daysAgo, to: today)!)!
            let tx = LocalTransaction(providerTransactionId: "sample-\(counter)", accountId: account,
                                      amount: (amount * 100).rounded() / 100, transactionDescription: description,
                                      payee: payee, transactedAt: date, isPending: pending)
            if let id = Categorizer.suggest(merchant: tx.normalizedMerchant, description: description,
                                            rules: [:], categoriesByName: byName) {
                Categorizer.assign(byId[id], to: tx)
            }
            // Older, categorized activity looks already reviewed; the last few
            // days stay in the review queue.
            tx.needsReview = daysAgo < 6 || tx.categoryId == nil
            context.insert(tx)
        }

        // Monthly fixed items.
        for monthsAgo in 0...5 {
            guard let first = calendar.date(byAdding: .month, value: -monthsAgo,
                                            to: calendar.date(from: calendar.dateComponents([.year, .month], from: today))!)
            else { continue }
            let base = calendar.dateComponents([.day], from: first, to: today).day!
            func monthly(_ day: Int, _ desc: String, _ acct: String, _ amount: Double, _ payee: String? = nil) {
                let daysAgo = base - (day - 1)
                if daysAgo >= 0 { add(desc, acct, amount, daysAgo: daysAgo, payee: payee) }
            }
            monthly(1, "RENT BLUEBELL APARTMENTS ACH", "sample-checking", -2100, "Bluebell Apartments")
            monthly(1, "ACME CORP PAYROLL DIRECT DEP", "sample-checking", 3250, "Acme Corp")
            monthly(15, "ACME CORP PAYROLL DIRECT DEP", "sample-checking", 3250, "Acme Corp")
            monthly(5, "CON ED OF NY BILL PMT", "sample-checking", -Double.random(in: 70...110, using: &rng), "Con Edison")
            monthly(8, "COMCAST XFINITY 800-266-2278", "sample-credit", -69.99, "Xfinity")
            monthly(11, "NETFLIX.COM", "sample-credit", -15.49, "Netflix")
            monthly(12, "SPOTIFY USA", "sample-credit", -11.99, "Spotify")
            monthly(20, "CHASE CREDIT CRD AUTOPAY", "sample-checking", -1100, "Chase Card Payment")
            monthly(20, "PAYMENT THANK YOU", "sample-credit", 1100, "Payment Received")
            monthly(16, "ONLINE TRANSFER TO SAV ...4471", "sample-checking", -500, "Transfer to Savings")
            monthly(16, "ONLINE TRANSFER FROM CHK ...9012", "sample-savings", 500, "Transfer from Checking")
            monthly(28, "INTEREST PAID", "sample-savings", Double.random(in: 55...70, using: &rng), "Interest")
        }

        // Everyday spending on the credit card.
        let patterns: [Pattern] = [
            Pattern(description: "STARBUCKS STORE 08812 NEW YORK NY", payee: "Starbucks", account: "sample-credit", amount: 4.5...7.5, everyDays: 3),
            Pattern(description: "SQ *BLUE BOTTLE COFFEE 0123", payee: "Blue Bottle Coffee", account: "sample-credit", amount: 5...8, everyDays: 5),
            Pattern(description: "WHOLEFDS NYC 10233", payee: "Whole Foods Market", account: "sample-credit", amount: 45...120, everyDays: 7),
            Pattern(description: "TRADER JOE'S #558", payee: "Trader Joe's", account: "sample-credit", amount: 30...75, everyDays: 9),
            Pattern(description: "UBER *TRIP HELP.UBER.COM", payee: "Uber", account: "sample-credit", amount: 12...34, everyDays: 6),
            Pattern(description: "DOORDASH*SWEETGREEN", payee: "DoorDash", account: "sample-credit", amount: 18...38, everyDays: 8),
            Pattern(description: "TST* JOE'S PIZZA BROADWAY", payee: "Joe's Pizza", account: "sample-credit", amount: 14...32, everyDays: 10),
            Pattern(description: "AMZN MKTP US*2X4AB1", payee: "Amazon", account: "sample-credit", amount: 15...90, everyDays: 11),
            Pattern(description: "MTA*NYCT PAYGO", payee: "MTA Subway", account: "sample-credit", amount: 2.9...2.9, everyDays: 2),
            Pattern(description: "CVS/PHARMACY #02271", payee: "CVS Pharmacy", account: "sample-credit", amount: 8...40, everyDays: 17),
            Pattern(description: "TARGET 00012345 BROOKLYN NY", payee: "Target", account: "sample-credit", amount: 25...95, everyDays: 19),
            Pattern(description: "AMC THEATRES 1234", payee: "AMC Theatres", account: "sample-credit", amount: 18...36, everyDays: 23),
        ]
        for (index, p) in patterns.enumerated() {
            var day = index % p.everyDays
            while day < 175 {
                add(p.description, p.account, -Double.random(in: p.amount, using: &rng), daysAgo: day, pending: day == 0, payee: p.payee)
                day += p.everyDays + Int.random(in: -1...1, using: &rng)
            }
        }

        // A few that the categorizer can't guess, so the review queue has real work.
        add("VENMO PAYMENT 1034829123", "sample-checking", -60, daysAgo: 2, payee: "Venmo")
        add("ZELLE FROM MAYA CHEN", "sample-checking", 45, daysAgo: 4)
        add("THE LOCAL HARDWARE CO", "sample-credit", -38.17, daysAgo: 3, payee: "The Local Hardware Co.")

        try? context.save()
    }
}

/// Deterministic random numbers so the sample data looks the same every time.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
