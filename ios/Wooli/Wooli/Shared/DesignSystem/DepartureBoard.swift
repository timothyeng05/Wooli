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

/// An airport departures board for scheduled things with a status: bills, reservations, the next leg.
/// Up to five rows, soonest first; it doesn't scroll ("See all" opens the full list).
struct DepartureBoard: View {
    let rows: [DepartureRow]

    var body: some View {
        VStack(spacing: Space.s) {
            HStack {
                Text("Due").frame(width: 92, alignment: .leading)
                Text("What")
                Spacer()
                Text("Status")
            }
            .wooliFont(.eyebrow).foregroundStyle(Theme.boardMuted)
            ForEach(rows.prefix(5)) { row in
                HStack(spacing: Space.s) {
                    HStack(spacing: Space.xs) {
                        cells(row.date.formatted(.dateTime.month(.abbreviated)).uppercased())
                        cells(row.date.formatted(.dateTime.day(.twoDigits)))
                    }
                    .frame(width: 92, alignment: .leading)
                    Text(row.title).font(.body).foregroundStyle(Theme.onTicket).lineLimit(1)
                    if let amount = row.amount {
                        Text(amount).font(.body).monospacedDigit().foregroundStyle(Theme.onTicket)
                    }
                    Spacer(minLength: Space.s)
                    Text(row.status.word).font(.footnote.weight(.bold)).foregroundStyle(color(row.status))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(row.date.formatted(.dateTime.month(.wide).day())), \(row.title)\(row.amount.map { ", \($0)" } ?? ""), \(row.status.word.lowercased())")
            }
        }
        .padding(Space.l)
        .background(Theme.board, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.boardCell))
    }

    /// Split-flap style: one cell per character.
    private func cells(_ text: String) -> some View {
        HStack(spacing: 2) {
            ForEach(Array(text.enumerated()), id: \.offset) { _, ch in
                Text(String(ch))
                    .font(.system(.callout, design: .monospaced).weight(.bold))
                    .foregroundStyle(Theme.onBoard)
                    .frame(width: 18, height: 26)
                    .background(Theme.boardCell, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
            }
        }
    }

    private func color(_ status: DepartureRow.Status) -> Color {
        switch status {
        case .due: Theme.onBoard
        case .paid: Theme.boardMuted
        case .late: Theme.boardLate
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
