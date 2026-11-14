#if os(macOS)
import SwiftUI

/// "What do I do next?" (M3-5): the trip's generated To do list, most urgent first.
/// Each row goes to, and selects, the thing it describes.
struct TripTodoCard: View {
    let trip: Trip
    let items: [TripItem]
    /// Selects a plan and/or scrolls to a day.
    var onGo: (_ itemID: String?, _ day: String?) -> Void

    var body: some View {
        let rows = TripTodo.list(trip: trip, items: items)
        VStack(alignment: .leading, spacing: Space.s) {
            Text("To do").font(.headline).foregroundStyle(Theme.text)
            if rows.isEmpty {
                Label("Nothing left to plan", systemImage: "checkmark.circle")
                    .font(.callout).foregroundStyle(Theme.textSecondary)
            }
            ForEach(rows) { row in
                Button { onGo(row.itemID, row.day) } label: {
                    HStack(spacing: Space.s) {
                        Image(systemName: symbol(row.kind))
                            .font(.caption.weight(.semibold)).foregroundStyle(Theme.brand)
                            .frame(width: 20)
                        Text(row.title).font(.callout).foregroundStyle(Theme.text)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Space.l)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
    }

    private func symbol(_ kind: TripTodoItem.Kind) -> String {
        switch kind {
        case .noBed: "bed.double"
        case .unbookedTravel: "ticket"
        case .warnings: "exclamationmark.triangle"
        case .unpriced: "dollarsign.circle"
        case .emptyDays: "calendar.badge.exclamationmark"
        case .checklist: "checklist"
        case .ideas: "lightbulb"
        }
    }
}
#endif
