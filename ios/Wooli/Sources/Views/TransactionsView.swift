import SwiftUI
import SwiftData

struct TransactionsView: View {
    let accountName: String

    @Query private var transactions: [LocalTransaction]

    init(accountId: String, accountName: String) {
        self.accountName = accountName
        // Captured by value at init time -- #Predicate can't close over `self`.
        _transactions = Query(
            filter: #Predicate<LocalTransaction> { $0.accountId == accountId },
            sort: \LocalTransaction.transactedAt,
            order: .reverse
        )
    }

    var body: some View {
        List(transactions) { transaction in
            HStack {
                VStack(alignment: .leading) {
                    Text(transaction.transactionDescription).font(.headline)
                    Text(transaction.transactedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(transaction.amount, format: .currency(code: "USD"))
                    .foregroundStyle(transaction.amount < 0 ? .red : .green)
            }
        }
        .overlay {
            if transactions.isEmpty {
                ContentUnavailableView("No transactions", systemImage: "list.bullet")
            }
        }
        .navigationTitle(accountName)
    }
}
