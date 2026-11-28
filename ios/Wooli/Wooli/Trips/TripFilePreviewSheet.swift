import SwiftUI

/// M2-5: what a `.woolitrip` file holds, before it becomes a new trip.
struct TripFilePreviewSheet: View {
    let preview: TripFilePreview
    var onImport: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text("Import Trip").font(.title3.weight(.semibold))
            VStack(alignment: .leading, spacing: 4) {
                Text(preview.trip.name.isEmpty ? "Untitled trip" : preview.trip.name).font(.headline)
                Text(preview.trip.dateRangeText).foregroundStyle(Theme.textSecondary)
                let plans = preview.items.filter { $0.day != nil && !$0.isHiddenPlaceholder }.count
                let ideas = preview.items.count - plans
                Text("\(plans) plans" + (ideas > 0 ? " and \(ideas) ideas" : "") + " in \(preview.trip.awayLegs.count) cities")
                    .foregroundStyle(Theme.textSecondary)
            }
            Text("It's added as a new trip. Nothing you already have is changed, and it isn't shared with anyone.")
                .font(.callout).foregroundStyle(Theme.textTertiary)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { TripStore.shared.tripFilePreview = nil; dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Add Trip") {
                    let id = TripStore.shared.importPreview(preview)
                    onImport(id)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(Space.l)
        .frame(width: 400)
    }
}
