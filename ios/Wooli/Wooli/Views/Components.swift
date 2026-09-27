import SwiftUI

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(s, radix: 16) ?? 0x64748b
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

/// Emoji in a soft tinted circle — the category "avatar" used across the app.
struct CategoryBadge: View {
    let category: BudgetCategory?
    var size: CGFloat = 36

    var body: some View {
        let tint = category.map { Color(hex: $0.colorHex) } ?? .secondary
        ZStack {
            Circle().fill(tint.opacity(0.18))
            if let category {
                Text(category.icon).font(.system(size: size * 0.5))
            } else {
                Image(systemName: "questionmark").font(.system(size: size * 0.4, weight: .semibold)).foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// SF Symbol on a filled rounded square, like the icons in the Settings app.
struct SymbolTile: View {
    let symbol: String
    var tint: Color = .accentColor
    var size: CGFloat = 30

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(tint.gradient, in: RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
            .accessibilityHidden(true)
    }
}

struct TransactionRow: View {
    let transaction: LocalTransaction
    let category: BudgetCategory?
    var accountName: String?

    var body: some View {
        HStack(spacing: 12) {
            CategoryBadge(category: category)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    if transaction.needsReview {
                        Circle().fill(Color.accentColor).frame(width: 8, height: 8)
                            .accessibilityLabel("Needs review")
                    }
                    Text(transaction.title).font(.body).lineLimit(1)
                }
                Group {
                    if let category {
                        Text(category.name)
                    } else {
                        Text("Uncategorized").foregroundStyle(.orange)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            .layoutPriority(1)
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(transaction.amount.signedCurrency())
                    .font(.body.monospacedDigit())
                    .foregroundStyle(transaction.amount > 0 ? .green : .primary)
                    .strikethrough(transaction.isHidden)
                if transaction.isPending {
                    Text("Pending").font(.caption).foregroundStyle(.secondary)
                } else if let accountName {
                    Text(accountName).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
        .opacity(transaction.isHidden ? 0.5 : 1)
    }
}

/// Toolbar sync button that shows a spinner while syncing.
struct SyncButton: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context

    var body: some View {
        if app.mode == .live {
            Button {
                Task { await app.sync(context: context) }
            } label: {
                if app.isSyncing {
                    ProgressView()
                } else {
                    Label("Sync", systemImage: "arrow.clockwise")
                }
            }
            .disabled(app.isSyncing)
        }
    }
}

/// Banner row shown at the top of lists when something needs attention.
struct StatusBanner: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        if app.mode == .sample {
            Label("You're looking at sample data. Connect your bank in Settings.", systemImage: "sparkles")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else if let error = app.syncError {
            Label(error, systemImage: "exclamationmark.triangle.fill")
                .font(.footnote)
                .foregroundStyle(.orange)
        }
    }
}

extension Date {
    var dayHeader: String {
        let cal = Calendar.current
        if cal.isDateInToday(self) { return "Today" }
        if cal.isDateInYesterday(self) { return "Yesterday" }
        let sameYear = cal.isDate(self, equalTo: .now, toGranularity: .year)
        return formatted(sameYear ? .dateTime.weekday(.wide).month(.wide).day()
                                  : .dateTime.month(.wide).day().year())
    }
}
