#if os(macOS)
import Foundation
import MapKit
import SwiftData

/// The read-only tools `WooliMCPServer` offers. Budget numbers use the same
/// maths as the app (`MonthSummary`, `BudgetPlan`, hidden accounts left out),
/// so Claude sees what the Dashboard shows.
@MainActor
final class WooliMCPTools {
    struct ToolError: Error { let message: String }

    /// Held for the life of the server: a context doesn't keep its container alive.
    private let container: ModelContainer
    private var context: ModelContext { container.mainContext }

    init() throws {
        // Same store as the app, opened read-only and without CloudKit: this
        // process never syncs or writes.
        let configuration = ModelConfiguration(schema: WooliApp.schema, allowsSave: false, cloudKitDatabase: .none)
        container = try ModelContainer(for: WooliApp.schema, configurations: [configuration])
    }

    // MARK: Definitions

    static let definitions: [[String: Any]] = [
        tool("wooli_overview",
             "This month's budget at a glance, as on the Wooli Dashboard: spent, planned spending, what's left, income, transactions waiting for review, and when the bank and iCloud last synced. Pass `month` for another month.",
             ["month": ["type": "string", "description": "Month as YYYY-MM. Defaults to the current month."]]),
        tool("wooli_spending_by_category",
             "Spending for a month by budget group and category, with each one's monthly plan (target) and what's left. Pass `month` for another month.",
             ["month": ["type": "string", "description": "Month as YYYY-MM. Defaults to the current month."]]),
        tool("wooli_transactions",
             "Search bank and manual transactions, newest first. Spending amounts are negative, income positive. Hidden accounts and hidden transactions are left out unless asked for.",
             [
                "search": ["type": "string", "description": "Text to find in the payee, description, title or note (case-insensitive)."],
                "from": ["type": "string", "description": "Earliest date, YYYY-MM-DD."],
                "to": ["type": "string", "description": "Latest date, YYYY-MM-DD (inclusive)."],
                "category": ["type": "string", "description": "Category or group name (exact, case-insensitive)."],
                "account": ["type": "string", "description": "Text in the account's name or institution."],
                "needs_review": ["type": "boolean", "description": "Only transactions still waiting for review (true) or only reviewed ones (false)."],
                "include_hidden": ["type": "boolean", "description": "Include hidden transactions and accounts. Default false."],
                "limit": ["type": "integer", "description": "Most to return, 1–500. Default 50."],
             ]),
        tool("wooli_accounts",
             "Bank and manual accounts with balances, institution, kind, and whether they're hidden from the budget.", [:]),
        tool("wooli_recurring",
             "Recurring bills and subscriptions Wooli has found or the user added: amount, how often, and next expected date.", [:]),
        tool("wooli_trips",
             "Trips. Without `trip`, lists every trip with its dates. With `trip`, returns that trip's plan day by day (activities, meals, travel, stays and notes, with places).",
             ["trip": ["type": "string", "description": "Text in the trip's name or destination."]]),
        [
            "name": "wooli_edit_trip",
            "description": "Change a trip: add plans (activities, meals, travel, hotel stays, notes), edit existing plans by id (including their cash and points price), or move a city stop's dates. Get ids from wooli_trips first. Places are looked up in Apple Maps. Changes are applied when the Wooli Mac app next opens (quit and reopen it if it's running), then sync to the user's other devices. Only make changes the user asked for.",
            "inputSchema": [
                "type": "object",
                "additionalProperties": false,
                "required": ["trip"],
                "properties": [
                    "trip": ["type": "string", "description": "Text in the trip's name or destination."],
                    "add_items": ["type": "array", "items": [
                        "type": "object", "additionalProperties": false, "required": ["kind", "title"],
                        "properties": [
                            "kind": ["type": "string", "enum": ["activity", "meal", "travel", "stay", "note"]],
                            "title": ["type": "string"],
                            "day": ["type": "string", "description": "YYYY-MM-DD. For a stay, the check-in day. Leave out to add it to the trip's ideas."],
                            "check_out": ["type": "string", "description": "Stays only: check-out day, YYYY-MM-DD."],
                            "time": ["type": "string", "description": "HH:MM, 24-hour."],
                            "place": ["type": "string", "description": "Place name and address to find (Google, then Apple Maps)."],
                            "near": ["type": "string", "description": "City the place is in, e.g. \"Lijiang, Yunnan, China\". Strongly recommended: results farther than 80 km are rejected."],
                            "notes": ["type": "string"],
                            "cost": ["type": "number", "description": "Cash paid for the whole booking (every night, every seat); 0 clears it."],
                            "currency": ["type": "string", "description": "ISO code of `cost`, e.g. USD, HKD, CNY."],
                            "points": ["type": "number", "description": "Points or miles spent on it; 0 clears them."],
                            "points_program": ["type": "string", "description": "Program of `points`, e.g. World of Hyatt, Asia Miles, AAdvantage, Chase Ultimate Rewards, Amex Membership Rewards."],
                        ],
                    ]],
                    "update_items": ["type": "array", "items": [
                        "type": "object", "additionalProperties": false, "required": ["id"],
                        "properties": [
                            "id": ["type": "string"],
                            "title": ["type": "string"],
                            "day": ["type": "string", "description": "YYYY-MM-DD"],
                            "time": ["type": "string", "description": "HH:MM, 24-hour, or empty to clear."],
                            "notes": ["type": "string"],
                            "from_station": ["type": "string", "description": "Trains: departure station to find, or empty to clear it."],
                            "from_near": ["type": "string", "description": "City of the departure station. Strongly recommended."],
                            "to_station": ["type": "string", "description": "Trains: arrival station to find, or empty to clear it."],
                            "to_near": ["type": "string", "description": "City of the arrival station. Strongly recommended."],
                            "place": ["type": "string", "description": "New place for the plan (e.g. a hotel)."],
                            "near": ["type": "string", "description": "City of `place`."],
                            "cost": ["type": "number", "description": "Cash paid for the whole booking (every night, every seat); 0 clears it."],
                            "currency": ["type": "string", "description": "ISO code of `cost`, e.g. USD, HKD, CNY."],
                            "points": ["type": "number", "description": "Points or miles spent on it; 0 clears them."],
                            "points_program": ["type": "string", "description": "Program of `points`, e.g. World of Hyatt, Asia Miles, AAdvantage, Chase Ultimate Rewards, Amex Membership Rewards."],
                        ],
                    ]],
                    "update_stops": ["type": "array", "items": [
                        "type": "object", "additionalProperties": false, "required": ["id"],
                        "properties": [
                            "id": ["type": "string"],
                            "city": ["type": "string"],
                            "start": ["type": "string", "description": "YYYY-MM-DD"],
                            "end": ["type": "string", "description": "YYYY-MM-DD"],
                        ],
                    ]],
                ],
            ],
            "annotations": ["readOnlyHint": false, "destructiveHint": false, "openWorldHint": true],
        ],
        tool("wooli_lists",
             "The user's ranked and saved lists: Eats (places they've eaten, scored 1–10, and their want-to-try list), Movies (films ranked, and a watchlist), Recipes, and Sights.",
             [
                "list": ["type": "string", "enum": ["eats", "movies", "recipes", "sights"], "description": "Which list."],
                "search": ["type": "string", "description": "Text to find (name, title, address, cuisine, notes)."],
             ], required: ["list"]),
    ]

    private static func tool(_ name: String, _ description: String, _ properties: [String: Any],
                             required: [String] = []) -> [String: Any] {
        [
            "name": name,
            "description": description,
            "inputSchema": ["type": "object", "properties": properties, "required": required, "additionalProperties": false],
            "annotations": ["readOnlyHint": true, "openWorldHint": false],
        ]
    }

    // MARK: Dispatch

    func call(_ name: String, arguments: [String: Any]) throws -> Any {
        switch name {
        case "wooli_overview": return try overview(month: month(arguments["month"]))
        case "wooli_spending_by_category": return try spendingByCategory(month: month(arguments["month"]))
        case "wooli_transactions": return try transactions(arguments)
        case "wooli_accounts": return try accounts()
        case "wooli_recurring": return try recurring()
        case "wooli_trips": return try trips(matching: arguments["trip"] as? String)
        case "wooli_lists": return try lists(arguments["list"] as? String ?? "", search: arguments["search"] as? String)
        case "wooli_edit_trip": return try editTrip(arguments)
        default: throw ToolError(message: "Unknown tool: \(name)")
        }
    }

    // MARK: Budget

    private struct Snapshot {
        let categories: [BudgetCategory]
        let accounts: [LocalAccount]
        let ledger: Ledger
    }

    private func snapshot() throws -> Snapshot {
        let categories = try context.fetch(FetchDescriptor<BudgetCategory>(sortBy: [SortDescriptor(\.sortOrder)]))
        let accounts = try context.fetch(FetchDescriptor<LocalAccount>())
        return Snapshot(categories: categories, accounts: accounts, ledger: Ledger(categories: categories, accounts: accounts))
    }

    private func transactions(in month: DateInterval) throws -> [LocalTransaction] {
        let start = month.start, end = month.end
        return try context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.transactedAt >= start && $0.transactedAt < end }))
    }

    private func overview(month: DateInterval) throws -> Any {
        let s = try snapshot()
        let txs = try transactions(in: month)
        let summary = MonthSummary(transactions: txs, in: month, categories: s.ledger.categoriesById, hiddenAccounts: s.ledger.hiddenAccounts)
        let plan = BudgetPlan(categories: s.categories, transactions: txs, month: month, ledger: s.ledger)
        let reviewStart = ReviewWindow.start
        // Same queue as the app's Review badge.
        let review = s.ledger.reviewQueue(try context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate {
            $0.transactedAt >= reviewStart
        }))).count
        var out: [String: Any] = [
            "month": monthKey(month),
            "spent": money(summary.spending),
            "planned_spending": money(plan.plannedExpenses),
            "left": money(plan.plannedExpenses - summary.spending),
            "income": money(summary.income),
            "planned_income": money(plan.plannedIncome),
            "transactions_to_review": review,
        ]
        if let bank = SyncService.lastSyncAt { out["bank_last_synced"] = iso(bank) }
        return out
    }

    private func spendingByCategory(month: DateInterval) throws -> Any {
        let s = try snapshot()
        let txs = try transactions(in: month)
        let plan = BudgetPlan(categories: s.categories, transactions: txs, month: month, ledger: s.ledger)
        func row(_ c: BudgetCategory) -> [String: Any] {
            let planned = plan.planned(c), actual = plan.actual(c)
            var r: [String: Any] = ["name": c.name, "spent": money(actual)]
            if planned > 0 { r["planned"] = money(planned); r["left"] = money(planned - actual) }
            if c.rolloverEnabled { r["rollover_balance"] = money(c.rolloverBalance) }
            return r
        }
        let groups: [[String: Any]] = plan.expenseGroups.compactMap { group in
            let children = plan.children(of: group).map(row).filter { self.amount($0["spent"]) != 0 || $0["planned"] != nil }
            var g = row(group)
            if !children.isEmpty { g["categories"] = children }
            return amount(g["spent"]) == 0 && g["planned"] == nil && children.isEmpty ? nil : g
        }
        return [
            "month": monthKey(month),
            "total_spent": money(plan.spent),
            "total_planned": money(plan.plannedExpenses),
            "uncategorized_spending": money(plan.uncategorizedSpending),
            "groups": groups,
        ]
    }

    private func transactions(_ args: [String: Any]) throws -> Any {
        let s = try snapshot()
        let includeHidden = args["include_hidden"] as? Bool ?? false
        let limit = min(max(args["limit"] as? Int ?? 50, 1), 500)
        let search = (args["search"] as? String ?? "").lowercased()
        let accountText = (args["account"] as? String ?? "").lowercased()
        let from = try (args["from"] as? String).map { try day($0) } ?? .distantPast
        let to = try (args["to"] as? String).map { try day($0).addingTimeInterval(86_400) } ?? .distantFuture
        var categoryIds: Set<String>?
        if let name = args["category"] as? String, !name.isEmpty {
            let matches = s.categories.filter { $0.name.caseInsensitiveCompare(name) == .orderedSame }
            guard !matches.isEmpty else {
                throw ToolError(message: "No category named \(name). Categories: \(s.categories.map(\.name).joined(separator: ", "))")
            }
            // A group name covers its categories too.
            categoryIds = Set(matches.map(\.id) + s.categories.filter { c in matches.contains { $0.id == c.parentId } }.map(\.id))
        }
        let accountsById = Dictionary(s.accounts.map { ($0.providerAccountId, $0) }, uniquingKeysWith: { a, _ in a })

        var descriptor = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.transactedAt >= from && $0.transactedAt < to },
            sortBy: [SortDescriptor(\.transactedAt, order: .reverse)])
        descriptor.fetchLimit = search.isEmpty && accountText.isEmpty && categoryIds == nil ? limit * 2 : nil
        var rows = [[String: Any]]()
        var matched = 0
        for tx in try context.fetch(descriptor) {
            if !includeHidden && (tx.isHidden || !s.ledger.isVisible(tx)) { continue }
            if let wanted = args["needs_review"] as? Bool, tx.needsReview != wanted { continue }
            if let categoryIds, !categoryIds.contains(tx.categoryId ?? "") { continue }
            let account = accountsById[tx.accountId]
            if !accountText.isEmpty {
                let text = "\(account?.displayName ?? "") \(account?.institutionName ?? "")".lowercased()
                if !text.contains(accountText) { continue }
            }
            if !search.isEmpty {
                let text = "\(tx.title) \(tx.payee ?? "") \(tx.transactionDescription) \(tx.note)".lowercased()
                if !text.contains(search) { continue }
            }
            matched += 1
            if rows.count < limit {
                var r: [String: Any] = [
                    "date": dayString(tx.transactedAt),
                    "title": tx.title,
                    "amount": money(tx.amount),
                    "category": s.ledger.category(for: tx)?.name ?? (tx.isTransfer ? "Transfer" : "Uncategorized"),
                    "account": account?.displayName ?? tx.accountId,
                ]
                if tx.transactionDescription != tx.title, !tx.transactionDescription.isEmpty { r["statement"] = tx.transactionDescription }
                if tx.needsReview { r["needs_review"] = true }
                if tx.isPending { r["pending"] = true }
                if !tx.note.isEmpty { r["note"] = tx.note }
                if !tx.tags.isEmpty { r["tags"] = tx.tags }
                rows.append(r)
            }
        }
        return [
            "returned": rows.count,
            "more_not_returned": matched > rows.count,
            "sum_of_returned": money(rows.reduce(0) { $0 + amount($1["amount"]) }),
            "transactions": rows,
        ]
    }

    private func accounts() throws -> Any {
        try context.fetch(FetchDescriptor<LocalAccount>()).sorted { $0.displayName < $1.displayName }.map { a in
            var r: [String: Any] = [
                "name": a.displayName, "institution": a.institutionName, "kind": a.kind.singularLabel,
                "balance": money(a.balance), "currency": a.currency, "balance_as_of": iso(a.balanceDate),
            ]
            if a.isHidden { r["hidden"] = true }
            if a.hideTransactions { r["transactions_hidden"] = true }
            return r
        }
    }

    private func recurring() throws -> Any {
        let s = try snapshot()
        return try context.fetch(FetchDescriptor<RecurringItem>(sortBy: [SortDescriptor(\.nextDate)]))
            .filter(\.isActive)
            .map { item -> [String: Any] in
                [
                    "name": item.title.isEmpty ? item.merchant : item.title,
                    "amount": money(item.amount),
                    "how_often": item.cadence.label,
                    "next_date": dayString(item.nextDate),
                    "last_date": dayString(item.lastDate),
                    "category": item.categoryId.flatMap { s.ledger.categoriesById[$0]?.name } ?? "",
                ]
            }
    }

    // MARK: Trips and lists (local files kept by TripStore and EatsBook)

    private struct TripsFile: Decodable { var trips: [Trip]; var items: [TripItem] }
    private struct EatsFile: Decodable { var mine: [EatsPlace]; var wishlist: [EatsPlace]? }

    private func readJSON<T: Decodable>(_ type: T.Type, _ path: String) -> T? {
        let url = URL.applicationSupportDirectory.appending(path: path)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private func trips(matching text: String?) throws -> Any {
        guard let file = readJSON(TripsFile.self, "Trips/trips.json") else {
            throw ToolError(message: "No trips on this Mac yet. Open Wooli once so it can download them from iCloud.")
        }
        let sorted = file.trips.sorted { $0.startDay > $1.startDay }
        guard let text, !text.isEmpty else {
            return sorted.map { ["name": $0.name, "destination": $0.destination, "start": $0.startDay, "end": $0.endDay,
                                 "shared": $0.isShared || !$0.isMine] as [String: Any] }
        }
        guard let trip = sorted.first(where: { "\($0.name) \($0.destination)".localizedCaseInsensitiveContains(text) }) else {
            throw ToolError(message: "No trip matches \(text). Trips: \(sorted.map(\.name).joined(separator: ", "))")
        }
        let items = file.items.filter { $0.tripID == trip.id }
        func describe(_ item: TripItem) -> [String: Any] {
            var r: [String: Any] = ["id": item.id, "kind": item.kind.label, "title": item.title]
            if let t = item.transport {
                if let from = t.fromStation { r["from_station"] = from.name }
                if let to = t.toStation { r["to_station"] = to.name }
                if !t.fromAirport.isEmpty { r["from_airport"] = t.fromAirport }
                if !t.toAirport.isEmpty { r["to_airport"] = t.toAirport }
                if !t.flightNumber.isEmpty { r["flight"] = t.flightNumber }
            }
            if let time = item.time { r["time"] = String(format: "%02d:%02d", time / 60, time % 60) }
            if let place = item.place { r["place"] = place.address.isEmpty ? place.name : "\(place.name), \(place.address)" }
            if !item.notes.isEmpty { r["notes"] = item.notes }
            if let out = item.checkOutDay { r["check_out"] = out }
            if let cost = item.cost {
                r["cost"] = cost
                r["currency"] = item.currencyCode
            }
            if let points = item.points {
                r["points"] = points
                if let program = item.pointsProgram { r["points_program"] = program }
            }
            return r
        }
        let days = Dictionary(grouping: items.filter { $0.day != nil }, by: { $0.day! })
            .sorted { $0.key < $1.key }
            .map { key, items -> [String: Any] in
                var d: [String: Any] = ["day": key, "plans": items.sorted(by: TripItem.dayOrder).map(describe)]
                if let title = trip.dayTitles[key], !title.isEmpty { d["title"] = title }
                return d
            }
        return [
            "name": trip.name, "destination": trip.destination, "start": trip.startDay, "end": trip.endDay,
            "notes": trip.notes,
            "stops": trip.legs.filter { !$0.isHome }.map { ["id": $0.id, "city": $0.name, "start": $0.startDay, "end": $0.endDay] },
            "days": days, "ideas": items.filter { $0.day == nil }.map(describe),
        ]
    }

    private func lists(_ list: String, search: String?) throws -> Any {
        let q = (search ?? "").lowercased()
        func keep(_ parts: String...) -> Bool { q.isEmpty || parts.joined(separator: " ").lowercased().contains(q) }
        switch list {
        case "eats":
            let file = readJSON(EatsFile.self, "Eats/eats.json")
            let mine = file?.mine ?? []
            let scores = EatsRanking.scores(mine.map(\.candidate))
            let ranked = mine.filter { keep($0.name, $0.address) }
                .sorted { (scores[$0.id] ?? 0) > (scores[$1.id] ?? 0) }
                .map { p -> [String: Any] in
                    ["name": p.name, "address": p.address, "score": NSDecimalNumber(string: String(format: "%.1f", scores[p.id] ?? 0)), "visited": p.visitedDay]
                }
            let wishes = (file?.wishlist ?? []).filter { keep($0.name, $0.address) }.map { ["name": $0.name, "address": $0.address] }
            return ["ranked": ranked, "want_to_try": wishes]
        case "movies":
            let all = try context.fetch(FetchDescriptor<MovieEntry>()).filter { keep($0.title, $0.director, $0.genre, $0.notes) }
            let scores = EatsRanking.scores(all.filter { !$0.isWishlist }.map {
                RankCandidate(id: $0.id, title: $0.title, subtitle: "", sentiment: $0.sentiment, rank: $0.rank)
            }, scale: .movies)
            return [
                "watched": all.filter { !$0.isWishlist }.sorted { (scores[$0.id] ?? 0) > (scores[$1.id] ?? 0) }.map { m -> [String: Any] in
                    ["title": m.title, "year": m.year, "director": m.director, "genre": m.genre,
                     "score": NSDecimalNumber(string: String(format: "%.1f", scores[m.id] ?? 0)), "watched": m.watchedDay, "notes": m.notes]
                },
                "watchlist": all.filter(\.isWishlist).map { ["title": $0.title, "year": $0.year] },
            ]
        case "recipes":
            return try context.fetch(FetchDescriptor<RecipeEntry>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]))
                .filter { keep($0.title, $0.cuisine, $0.mainIngredient, $0.ingredientsText, $0.notes) }
                .map { r -> [String: Any] in
                    ["title": r.title, "meal": r.meal, "cuisine": r.cuisine, "main_ingredient": r.mainIngredient,
                     "minutes": r.minutes, "ingredients": r.ingredients, "steps": r.steps, "notes": r.notes, "link": r.sourceURL]
                }
        case "sights":
            return try context.fetch(FetchDescriptor<SightEntry>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)]))
                .filter { keep($0.name, $0.address, $0.notes) }
                .map { ["name": $0.name, "address": $0.address, "visited": $0.visitedDay, "notes": $0.notes] }
        default:
            throw ToolError(message: "`list` must be eats, movies, recipes or sights.")
        }
    }

    // MARK: Editing trips

    /// Edits go through `TripStore`'s import file (Documents/trip-import.json),
    /// which the app picks up on launch and saves through its normal sync path.
    /// A plan's cash and points price from an edit; 0 clears either.
    private func applyPrice(_ args: [String: Any], to item: inout TripItem) {
        if let cost = (args["cost"] as? NSNumber)?.doubleValue { item.cost = cost == 0 ? nil : cost }
        if let currency = args["currency"] as? String, !currency.isEmpty { item.currency = currency.uppercased() }
        if let points = (args["points"] as? NSNumber)?.doubleValue { item.points = points == 0 ? nil : points }
        if let program = args["points_program"] as? String { item.pointsProgram = program.isEmpty ? nil : program }
    }

    private func editTrip(_ args: [String: Any]) throws -> Any {
        guard let file = readJSON(TripsFile.self, "Trips/trips.json") else {
            throw ToolError(message: "No trips on this Mac yet. Open Wooli once so it can download them from iCloud.")
        }
        let text = args["trip"] as? String ?? ""
        guard var trip = file.trips.first(where: { "\($0.name) \($0.destination)".localizedCaseInsensitiveContains(text) }) else {
            throw ToolError(message: "No trip matches \(text).")
        }
        var changed = [TripItem]()
        var summary = [String]()

        for edit in args["update_items"] as? [[String: Any]] ?? [] {
            let id = edit["id"] as? String ?? ""
            guard var item = file.items.first(where: { $0.id == id && $0.tripID == trip.id }) else {
                throw ToolError(message: "No plan with id \(id) in \(trip.name).")
            }
            if let title = edit["title"] as? String { item.title = title }
            if let day = edit["day"] as? String { _ = try self.day(day); item.day = day }
            if let time = edit["time"] as? String { item.time = time.isEmpty ? nil : try minutes(time) }
            if let notes = edit["notes"] as? String { item.notes = notes }
            if let place = edit["place"] as? String, !place.isEmpty { item.place = try findPlace(place, near: edit["near"] as? String) }
            if let from = edit["from_station"] as? String {
                var t = item.transport ?? TripTransport(mode: .train)
                t.fromStation = from.isEmpty ? nil : try findPlace(from, near: edit["from_near"] as? String)
                item.transport = t
            }
            if let to = edit["to_station"] as? String {
                var t = item.transport ?? TripTransport(mode: .train)
                t.toStation = to.isEmpty ? nil : try findPlace(to, near: edit["to_near"] as? String)
                item.transport = t
            }
            applyPrice(edit, to: &item)
            changed.append(item)
            summary.append("Changed \(item.title) (\(item.day ?? "ideas"))")
        }

        for add in args["add_items"] as? [[String: Any]] ?? [] {
            var item = TripItem(tripID: trip.id)
            item.kind = switch add["kind"] as? String {
            case "meal": .meal
            case "travel": .transit
            case "stay": .stay
            case "note": .note
            default: .activity
            }
            item.title = add["title"] as? String ?? ""
            if let day = add["day"] as? String { _ = try self.day(day); item.day = day }
            if let out = add["check_out"] as? String { _ = try self.day(out); item.checkOutDay = out }
            if let time = add["time"] as? String, !time.isEmpty { item.time = try minutes(time) }
            if let notes = add["notes"] as? String { item.notes = notes }
            if let place = add["place"] as? String, !place.isEmpty { item.place = try findPlace(place, near: add["near"] as? String) }
            applyPrice(add, to: &item)
            changed.append(item)
            summary.append("Added \(item.kind.label.lowercased()) \(item.title) (\(item.day ?? "ideas")\(item.checkOutDay.map { "–\($0)" } ?? ""))")
        }

        let stopEdits = args["update_stops"] as? [[String: Any]] ?? []
        for edit in stopEdits {
            let id = edit["id"] as? String ?? ""
            guard let i = trip.legs.firstIndex(where: { $0.id == id }) else {
                throw ToolError(message: "No stop with id \(id) in \(trip.name).")
            }
            if let city = edit["city"] as? String { trip.legs[i].name = city }
            if let start = edit["start"] as? String { _ = try day(start); trip.legs[i].startDay = start }
            if let end = edit["end"] as? String { _ = try day(end); trip.legs[i].endDay = end }
            summary.append("Moved stop \(trip.legs[i].name) to \(trip.legs[i].startDay)–\(trip.legs[i].endDay)")
        }
        trip.legs.sort { $0.isHome == $1.isHome ? $0.startDay < $1.startDay : !$0.isHome }

        guard !summary.isEmpty else { throw ToolError(message: "Nothing to change.") }
        try queueImport(TripStore.ImportBundle(trip: trip, items: changed, itemsOnly: stopEdits.isEmpty))
        return [
            "queued": summary,
            "next": "Quit and reopen Wooli on this Mac (or open it if it's closed) to apply these. They then sync to the user's other devices.",
        ]
    }

    /// Adds to any import already waiting, so two edits before the app opens both apply.
    private func queueImport(_ bundle: TripStore.ImportBundle) throws {
        let url = TripStore.pendingImportURL
        var bundles = [TripStore.ImportBundle]()
        if let data = try? Data(contentsOf: url) {
            bundles = (try? JSONDecoder().decode([TripStore.ImportBundle].self, from: data))
                ?? (try? JSONDecoder().decode(TripStore.ImportBundle.self, from: data)).map { [$0] } ?? []
        }
        bundles.append(bundle)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(bundles).write(to: url, options: .atomic)
    }

    /// Finds a place: Google Places first, then Apple Maps (Apple put the
    /// city "Lijiang, Yunnan" 400 km away and matched "Lijiang Station" to a
    /// hotel named after it). With `near` (a city), both searches are biased
    /// to it and anything over 80 km away is rejected.
    private func findPlace(_ query: String, near: String? = nil) throws -> TripPlace {
        var center: CLLocationCoordinate2D?
        if let near, !near.isEmpty {
            if let city = (wait { await GooglePlaces.search(near) } ?? []).first {
                center = CLLocationCoordinate2D(latitude: city.latitude, longitude: city.longitude)
            } else if let city = appleSearch(near, around: nil).first {
                center = city.location.coordinate
            } else {
                throw ToolError(message: "Couldn't find the city \(near) to search near.")
            }
        }
        func isClose(_ c: CLLocationCoordinate2D) -> Bool {
            guard let center else { return true }
            return CLLocation(latitude: c.latitude, longitude: c.longitude)
                .distance(from: CLLocation(latitude: center.latitude, longitude: center.longitude)) < 80_000
        }
        let google = wait { await GooglePlaces.search(query, near: center, radius: 50_000) } ?? []
        if let hit = google.first(where: { isClose(CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)) }) {
            return hit.place
        }
        if let item = appleSearch(query, around: center).first(where: { isClose($0.location.coordinate) }) {
            let c = item.location.coordinate
            return TripPlace(name: item.name ?? query, address: item.address?.shortAddress ?? item.address?.fullAddress ?? "",
                             latitude: c.latitude, longitude: c.longitude, mapItemID: item.identifier?.rawValue ?? "")
        }
        throw ToolError(message: "Neither Google nor Apple Maps found \(query)\(near.map { " near \($0)" } ?? ""). Try another name, or leave the place out.")
    }

    private func appleSearch(_ query: String, around center: CLLocationCoordinate2D?) -> [MKMapItem] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        if let center { request.region = MKCoordinateRegion(center: center, latitudinalMeters: 100_000, longitudinalMeters: 100_000) }
        return wait {
            await withCheckedContinuation { (done: CheckedContinuation<[MKMapItem], Never>) in
                MKLocalSearch(request: request).start { response, _ in done.resume(returning: response?.mapItems ?? []) }
            }
        } ?? []
    }

    /// The server loop runs on the main thread: spin its run loop until the
    /// async work finishes (MapKit and URLSession call back there).
    private func wait<T>(_ work: @escaping @MainActor () async -> T) -> T? {
        var result: T?
        var finished = false
        Task { @MainActor in result = await work(); finished = true }
        let deadline = Date.now.addingTimeInterval(20)
        while !finished && Date.now < deadline { RunLoop.main.run(mode: .default, before: .now.addingTimeInterval(0.05)) }
        return result
    }

    private func minutes(_ text: String) throws -> Int {
        let parts = text.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else {
            throw ToolError(message: "Times must look like 14:30.")
        }
        return parts[0] * 60 + parts[1]
    }

    // MARK: Helpers

    private func month(_ value: Any?) throws -> DateInterval {
        guard let text = value as? String, !text.isEmpty else { return .month(containing: .now) }
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2, let date = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)) else {
            throw ToolError(message: "`month` must look like 2026-11.")
        }
        return .month(containing: date)
    }

    private func day(_ text: String) throws -> Date {
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let date = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else {
            throw ToolError(message: "Dates must look like 2026-11-09.")
        }
        return date
    }

    private func monthKey(_ month: DateInterval) -> String {
        let c = Calendar.current.dateComponents([.year, .month], from: month.start)
        return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }

    private func dayString(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private func iso(_ date: Date) -> String { date.formatted(.iso8601) }
    /// Two decimal places that print as written (a Double would print 3523.3099999999999).
    private func money(_ value: Double) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.2f", value)) }
    private func amount(_ value: Any?) -> Double { (value as? NSNumber)?.doubleValue ?? 0 }
}
#endif
