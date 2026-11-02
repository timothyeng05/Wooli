import SwiftUI

struct DepartureRow: Identifiable {
    enum Status {
        case due, paid, late
        var word: String {
            switch self {
            case .due: "DUE"
            case .paid: "PAID"
            case .late: "LATE"
            }
        }
    }

    let id = UUID()
    let date: Date
    let title: String
    var amount: String?
    var status: Status = .due
}

/// Upcoming bills and scheduled things with a status, as a plain list: title,
/// date and status on the left, amount on the right. Up to five rows, soonest
/// first; it doesn't scroll ("See all" opens the full list).
struct DepartureBoard: View {
    let rows: [DepartureRow]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.prefix(5).enumerated()), id: \.element.id) { index, row in
                if index > 0 { Divider() }
                HStack(alignment: .firstTextBaseline, spacing: Space.s) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.title).font(.body.weight(.medium)).foregroundStyle(Theme.text).lineLimit(1)
                        HStack(spacing: 6) {
                            Text(row.date.formatted(.dateTime.month(.abbreviated).day()))
                            Text(row.status.word.capitalized).fontWeight(.semibold).foregroundStyle(color(row.status))
                        }
                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer(minLength: Space.s)
                    if let amount = row.amount {
                        Text(amount).font(.body).monospacedDigit().foregroundStyle(Theme.text)
                    }
                }
                .padding(.vertical, 10)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(row.date.formatted(.dateTime.month(.wide).day())), \(row.title)\(row.amount.map { ", \($0)" } ?? ""), \(row.status.word.lowercased())")
            }
        }
    }

    private func color(_ status: DepartureRow.Status) -> Color {
        switch status {
        case .due: Theme.pending
        case .paid: Theme.income
        case .late: Theme.expense
        }
    }
}

#Preview {
    LightDark {
        DepartureBoard(rows: [
            DepartureRow(date: .now, title: "Rent", amount: "$2,100", status: .due),
            DepartureRow(date: .now.addingTimeInterval(86400 * 3), title: "Netflix", amount: "$15.49", status: .paid),
            DepartureRow(date: .now.addingTimeInterval(-86400 * 2), title: "Phone", amount: "$62", status: .late),
        ])
    }
}
