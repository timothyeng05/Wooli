import SwiftData
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

@ModelActor
actor BackgroundStore {
    // MARK: - SyncService logic

    func sync() async throws -> SyncService.Summary {
        guard let accessURL = KeychainHelper.load(forKey: "simplefin-access-url") else {
            throw SimpleFinError.notConnected
        }

        // Until 2026-10 the app kept only two months; fetch SimpleFIN's full
        // ~90 days once so those deleted transactions come back.
        let backfilled = UserDefaults.standard.bool(forKey: Self.historyBackfillKey)
        let lastSyncAt = backfilled ? UserDefaults.standard.object(forKey: "lastSimpleFinSyncAt") as? Date : nil
        let oldestAllowed = max(Calendar.current.date(byAdding: .day, value: -89, to: .now)!, TransactionRetention.start)
        let startDate = lastSyncAt.map { max(Calendar.current.date(byAdding: .day, value: -7, to: $0)!, oldestAllowed) }
            ?? oldestAllowed

        var options = SimpleFinClient.FetchOptions()
        options.startDate = startDate
        options.pending = true
        let response = try await SimpleFinClient.fetchAccounts(accessURL: accessURL, options: options)

        let accounts = Dictionary(
            (try modelContext.fetch(FetchDescriptor<LocalAccount>())).map { ($0.providerAccountId, $0) },
            uniquingKeysWith: { first, _ in first })
        let transactions = Dictionary(
            (try modelContext.fetch(FetchDescriptor<LocalTransaction>())).map { ($0.providerTransactionId, $0) },
            uniquingKeysWith: { first, _ in first })
        let rules = Categorizer.groupRules(try modelContext.fetch(FetchDescriptor<MerchantRule>()))
        let categories = try modelContext.fetch(FetchDescriptor<BudgetCategory>())
        let categoriesById = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let categoriesByName = Categorizer.leavesByName(categories)

        let userRules = (try modelContext.fetch(FetchDescriptor<TransactionRule>(sortBy: [SortDescriptor(\.createdAt)])))
            .filter(\.isEnabled)
        var summary = SyncService.Summary(bankMessages: response.errors)
        var seenIds = Set<String>()

        for remote in response.accounts {
            let balance = Double(remote.balance) ?? 0
            let balanceDate = Date(timeIntervalSince1970: remote.balanceDate)
            if let existing = accounts[remote.id] {
                existing.name = remote.name
                existing.institutionName = remote.org.name ?? existing.institutionName
                existing.balance = balance
                existing.balanceDate = balanceDate
                existing.lastSyncedAt = .now
            } else {
                modelContext.insert(LocalAccount(
                    providerAccountId: remote.id, name: remote.name,
                    institutionName: remote.org.name ?? remote.org.domain ?? "Bank",
                    currency: remote.currency, balance: balance, balanceDate: balanceDate,
                    kind: AccountKind.infer(name: remote.name, balance: balance)))
            }

            for tx in remote.transactions ?? [] {
                seenIds.insert(tx.id)
                let amount = Double(tx.amount) ?? 0
                let date = Date(timeIntervalSince1970: tx.transactedAt ?? tx.posted)
                let isPending = (tx.pending ?? false) || tx.posted == 0
                if let existing = transactions[tx.id] {
                    existing.amount = amount
                    existing.transactionDescription = tx.description
                    existing.payee = tx.payee
                    existing.transactedAt = date
                    existing.isPending = isPending
                } else {
                    let new = LocalTransaction(
                        providerTransactionId: tx.id, accountId: remote.id, amount: amount,
                        transactionDescription: tx.description, payee: tx.payee,
                        transactedAt: date, isPending: isPending)
                    RuleEngine.applyAll(userRules, to: new, categories: categoriesById)
                    if new.categoryId == nil,
                       let suggested = Categorizer.suggest(merchant: new.normalizedMerchant,
                                                           description: tx.description + " " + (tx.payee ?? ""), amount: amount,
                                                           rules: rules, categoriesByName: categoriesByName) {
                        Categorizer.assign(categoriesById[suggested], to: new)
                    }
                    modelContext.insert(new)
                    summary.newTransactions += 1
                }
            }
        }

        recordSnapshots(for: response.accounts)

        let returnedAccounts = Set(response.accounts.map(\.id))
        for tx in transactions.values where tx.isPending && tx.transactedAt >= startDate
            && returnedAccounts.contains(tx.accountId) && !seenIds.contains(tx.providerTransactionId) {
            modelContext.delete(tx)
        }

        try modelContext.save()
        Deduplicator.run(context: modelContext) // we can call this safely from background thread now
        UserDefaults.standard.set(Date.now, forKey: "lastSimpleFinSyncAt")
        UserDefaults.standard.set(true, forKey: Self.historyBackfillKey)
        return summary
    }

    private static let historyBackfillKey = "historyBackfill.v1"

    private func recordSnapshots(for remote: [SimpleFinAccount]) {
        let today = Calendar.current.startOfDay(for: .now)
        let existing = (try? modelContext.fetch(FetchDescriptor<BalanceSnapshot>(predicate: #Predicate { $0.day == today }))) ?? []
        let byAccount = Dictionary(existing.map { ($0.accountId, $0) }, uniquingKeysWith: { a, _ in a })
        for account in remote {
            let balance = Double(account.balance) ?? 0
            if let snap = byAccount[account.id] {
                snap.balance = balance
            } else {
                modelContext.insert(BalanceSnapshot(accountId: account.id, day: today, balance: balance))
            }
        }
    }

    // MARK: - AICategorizer logic (OnDevice)

    @discardableResult
    func runOnDeviceCategorizer(limit: Int) async -> Int {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            return await runCategorizer(limit: limit)
        }
        #endif
        return 0
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private func runCategorizer(limit: Int) async -> Int {
        let windowStart = ReviewWindow.start
        let pendingFetch = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.needsReview && !$0.aiAttempted && !$0.isHidden
                && ($0.categoryId == nil || $0.aiSuggested) && $0.transactedAt >= windowStart },
            sortBy: [SortDescriptor(\.transactedAt, order: .reverse)])
        guard let pending = try? modelContext.fetch(pendingFetch), !pending.isEmpty else { return 0 }

        let categories = (try? modelContext.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let groups = Dictionary(categories.filter { $0.parentId == nil }.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let parentIds = Set(categories.compactMap(\.parentId))
        var byName = [String: BudgetCategory]()
        for c in categories.sorted(by: { $0.sortOrder < $1.sortOrder }) where !parentIds.contains(c.id) {
            if byName[c.name] == nil { byName[c.name] = c }
        }
        guard !byName.isEmpty else { return 0 }
        let names = byName.keys.sorted()

        let schema: GenerationSchema
        do {
            let choice = DynamicGenerationSchema(name: "Category", description: "One category from the list, or None",
                                                 anyOf: names + ["None"])
            let root = DynamicGenerationSchema(name: "Categorization", properties: [
                .init(name: "category", description: "The best matching category, or None if nothing fits", schema: choice),
            ])
            schema = try GenerationSchema(root: root, dependencies: [])
        } catch {
            return 0
        }

        let userRules = ((try? modelContext.fetch(FetchDescriptor<CategoryRule>(sortBy: [SortDescriptor(\.createdAt)]))) ?? [])
            .filter(\.isEnabled).map(\.text)
        let instructions = AICategorizer.buildInstructions(byName: byName, groups: groups, rules: userRules,
                                                           examples: AICategorizer.examples(context: modelContext, categories: categories))
        let accounts = (try? modelContext.fetch(FetchDescriptor<LocalAccount>())) ?? []
        let accountKinds = Dictionary(accounts.map { ($0.providerAccountId, "\($0.displayName) (\($0.kind.singularLabel))") },
                                      uniquingKeysWith: { a, _ in a })
        let confirmed = ((try? modelContext.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { !$0.needsReview && $0.categoryId != nil }))) ?? [])
        let namesById = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
        let options = GenerationOptions(samplingMode: .greedy)
        var suggested = 0

        for (index, tx) in pending.prefix(limit).enumerated() {
            let session = LanguageModelSession(instructions: instructions)
            let direction = tx.amount >= 0 ? "money in" : "money out"
            var prompt = """
            Bank description: \(tx.transactionDescription)
            Merchant: \(tx.title)
            Amount: \(abs(tx.amount).formatted(.currency(code: "USD"))) (\(direction))
            Account: \(accountKinds[tx.accountId] ?? "Unknown")
            """
            let similar = AICategorizer.similarConfirmed(to: tx, in: confirmed, names: namesById)
            if !similar.isEmpty {
                prompt += "\nSimilar transactions this person already categorized:\n" + similar.joined(separator: "\n")
            }
            do {
                let response = try await session.respond(to: prompt, schema: schema, includeSchemaInPrompt: true, options: options)
                let answer = try response.content.value(String.self, forProperty: "category")
                if tx.needsReview, tx.categoryId == nil || tx.aiSuggested, let category = byName[answer] {
                    Categorizer.assign(category, to: tx, byAI: true)
                    suggested += 1
                }
                tx.aiAttempted = true
                if index % 20 == 19 {
                    try? modelContext.save() // Batch saves!
                }
            } catch {
                if AICategorizer.isContentRefusal(error) {
                    tx.aiAttempted = true
                    continue
                }
                break
            }
        }
        try? modelContext.save()
        return suggested
    }
    #endif
}
