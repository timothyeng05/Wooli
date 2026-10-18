import SwiftUI

/// The web app's meal rating scale (10 → 1), with a short verdict for each.
enum MealRating {
    static let scale: [(score: Int, label: String)] = [
        (10, "Must try"), (9, "Should try"), (8, "Safe bet"), (7, "Average"), (6, "Plan B"),
        (5, "Tolerable"), (4, "Skip"), (3, "Avoid"), (2, "Danger"), (1, "Do you even love yourself"),
    ]

    static func label(_ score: Int) -> String? { scale.first { $0.score == score }?.label }

    static func color(_ score: Int) -> Color {
        score >= 8 ? Color(hex: "#22c55e") : score >= 5 ? Color(hex: "#f59e0b") : Color(hex: "#f87171")
    }

    /// Meals worth listing: rated ones, plus any on a day that's already
    /// passed. Best first, then in trip order.
    static func meals(in items: [TripItem]) -> [TripItem] {
        let today = DayKey.key(.now)
        return items.filter { $0.kind == .meal && ($0.rating != nil || ($0.day.map { $0 < today } ?? false)) }
            .sorted { ($0.rating ?? 0, $1.day ?? "", $1.time ?? 0) > ($1.rating ?? 0, $0.day ?? "", $0.time ?? 0) }
    }
}

struct RatingChip: View {
    let score: Int

    var body: some View {
        Text("\(score)/10")
            .font(.caption2.weight(.bold)).monospacedDigit()
            .foregroundStyle(.white)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(MealRating.color(score), in: Capsule())
            .accessibilityLabel("Rated \(score) out of 10, \(MealRating.label(score) ?? "")")
    }
}

/// Every meal of the trip, ranked — the "where should we go back to" list.
struct WhatWeAteView: View {
    let tripID: String
    @State private var store = TripStore.shared
    @State private var editingItem: TripItem?

    var body: some View {
        let meals = MealRating.meals(in: store.items(in: tripID))
        List {
            if meals.isEmpty {
                ContentUnavailableView("No meals yet", systemImage: "fork.knife",
                                       description: Text("Food on past days shows up here. Rate a meal from its details to rank it."))
            } else {
                Section {
                    ForEach(meals) { meal in
                        Button { editingItem = meal } label: { row(meal) }
                            .buttonStyle(.plain)
                    }
                }
            }
            Section {
                DisclosureGroup("Rating scale") {
                    ForEach(MealRating.scale, id: \.score) { entry in
                        HStack(spacing: 10) {
                            RatingChip(score: entry.score)
                            Text(entry.label).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("What we ate")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editingItem) { item in
            if let trip = store.trip(tripID) { TripItemEditor(item: item, trip: trip) }
        }
    }

    private func row(_ meal: TripItem) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(meal.title.isEmpty ? (meal.place?.name ?? "Meal") : meal.title)
                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.text).lineLimit(1)
                Text([meal.rating.flatMap(MealRating.label),
                      meal.day.map { DayKey.date($0).formatted(.dateTime.month(.abbreviated).day()) }]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 8)
            if let rating = meal.rating {
                RatingChip(score: rating)
            } else {
                Text("Rate").font(.caption.weight(.semibold)).foregroundStyle(Theme.brand)
            }
        }
        .contentShape(Rectangle())
    }
}
