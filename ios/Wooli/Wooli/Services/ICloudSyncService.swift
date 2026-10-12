import Foundation
import SwiftData
import os.log

private let logger = Logger(subsystem: "com.timothyeng.wooli", category: "iCloudSyncService")

@MainActor
enum ICloudSyncService {
    private static let didPushKey = "didPushAllDataToProduction_v2"

    /// Touches every local persistent record so SwiftData / NSPersistentCloudKitContainer
    /// registers them as modified and exports them in a fresh CloudKit batch.
    @discardableResult
    static func pushAllLocalData(context: ModelContext) -> Int {
        var count = 0

        if let categories = try? context.fetch(FetchDescriptor<BudgetCategory>()) {
            for cat in categories {
                cat.name = cat.name
                count += 1
            }
        }

        if let accounts = try? context.fetch(FetchDescriptor<LocalAccount>()) {
            for acc in accounts {
                acc.name = acc.name
                count += 1
            }
        }

        if let transactions = try? context.fetch(FetchDescriptor<LocalTransaction>()) {
            for tx in transactions {
                tx.transactionDescription = tx.transactionDescription
                count += 1
            }
        }

        if let rules = try? context.fetch(FetchDescriptor<MerchantRule>()) {
            for r in rules {
                r.updatedAt = .now
                count += 1
            }
        }

        if let txRules = try? context.fetch(FetchDescriptor<TransactionRule>()) {
            for r in txRules {
                r.isEnabled = r.isEnabled
                count += 1
            }
        }

        if let catRules = try? context.fetch(FetchDescriptor<CategoryRule>()) {
            for r in catRules {
                r.text = r.text
                count += 1
            }
        }

        if let recurring = try? context.fetch(FetchDescriptor<RecurringItem>()) {
            for r in recurring {
                r.merchant = r.merchant
                count += 1
            }
        }

        if let periods = try? context.fetch(FetchDescriptor<PeriodEntry>()) {
            for p in periods {
                p.updatedAt = .now
                count += 1
            }
        }

        if let moods = try? context.fetch(FetchDescriptor<MoodEntry>()) {
            for m in moods {
                m.updatedAt = .now
                count += 1
            }
        }

        do {
            try context.save()
            logger.info("Successfully touched and queued \(count) records for iCloud export")
        } catch {
            logger.error("Failed to save context during pushAllLocalData: \(error.localizedDescription)")
        }

        return count
    }

    /// Automatically runs once on launch if this device has existing data
    /// (e.g. Phone 1 has categorized transactions) to make sure they are pushed to CloudKit Production.
    static func autoPushOnceIfNeeded(context: ModelContext) {
        guard !UserDefaults.standard.bool(forKey: didPushKey) else { return }
        let txCount = (try? context.fetchCount(FetchDescriptor<LocalTransaction>())) ?? 0
        let catCount = (try? context.fetchCount(FetchDescriptor<BudgetCategory>())) ?? 0
        if txCount > 0 || catCount > 0 {
            let total = pushAllLocalData(context: context)
            if total > 0 {
                UserDefaults.standard.set(true, forKey: didPushKey)
                logger.info("Auto-pushed \(total) existing records to CloudKit Production")
            }
        }
    }
}
