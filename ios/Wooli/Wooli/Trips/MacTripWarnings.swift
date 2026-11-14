#if os(macOS)
import SwiftUI

/// The trip's amber warnings (M3-4) as a card in the inspector summary: one line
/// each, a click selects the plan, Ignore hides it for everyone on the trip.
struct TripWarningsCard: View {
    let trip: Trip
    let items: [TripItem]
    /// Selects the plan a warning is about.
    var onSelect: (String) -> Void
    @State private var store = TripStore.shared

    var body: some View {
        let warnings = TripChecks.warnings(trip: trip, items: items)
        if !warnings.isEmpty {
            VStack(alignment: .leading, spacing: Space.s) {
                Label("\(warnings.count) thing\(warnings.count == 1 ? "" : "s") to check", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline).foregroundStyle(Theme.pending)
                ForEach(warnings) { warning in
                    HStack(alignment: .firstTextBaseline, spacing: Space.s) {
                        Button { onSelect(warning.itemID) } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(title(warning)).font(.callout.weight(.medium)).foregroundStyle(Theme.text)
                                Text(warning.message).font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Button("Ignore") { ignore(warning) }
                            .buttonStyle(.link).font(.caption)
                            .help("Stop showing this warning, for everyone on the trip")
                    }
                }
            }
            .padding(Space.l)
            .background(Theme.pendingSoft, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.pending.opacity(0.4)))
        }
    }

    private func title(_ warning: TripWarning) -> String {
        items.first { $0.id == warning.itemID }.map(TripBookings.what) ?? "Plan"
    }

    private func ignore(_ warning: TripWarning) {
        guard var item = items.first(where: { $0.id == warning.itemID }) else { return }
        var extras = item.extras ?? ItemExtras()
        var ignored = extras.ignoredWarnings ?? []
        if !ignored.contains(warning.id) { ignored.append(warning.id) }
        extras.ignoredWarnings = ignored
        item.extras = extras
        store.save(item)
    }
}
#endif
