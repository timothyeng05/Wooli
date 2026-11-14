import SwiftUI

/// The line between two stops on a day (M3-2): "14 min walk", "22 min by transit".
/// Tap it to pick another way of getting there; the choice is remembered for that pair.
/// The estimate is looked up (and cached) when the row first appears.
struct TravelConnectorRow: View {
    let from: TripPlace
    let to: TripPlace
    @State private var estimate: TravelEstimate?
    @State private var chosen: TravelMode?

    /// The same pair keeps the mode you picked, on this device.
    private var defaultsKey: String { Self.defaultsKey(from: from, to: to) }

    static func defaultsKey(from: TripPlace, to: TripPlace) -> String {
        "travel.mode." + TravelTime.cacheKey(from: from, to: to, mode: .walk)
    }

    var body: some View {
        Menu {
            ForEach(TravelMode.allCases) { mode in
                Button(mode.label.capitalized, systemImage: mode.symbol) { choose(mode) }
            }
            if chosen != nil {
                Divider()
                Button("Pick Automatically") { choose(nil) }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: (estimate?.mode ?? chosen ?? .walk).symbol)
                Text(estimate.map(TravelTime.text) ?? "…").monospacedDigit()
            }
            .font(.caption)
            .foregroundStyle(Theme.textTertiary)
        }
        #if os(macOS)
        .menuStyle(.borderlessButton)
        #endif
        .fixedSize()
        // Indented under the row's icon column.
        .padding(.leading, 44)
        .accessibilityLabel(estimate.map { "Getting there: \(TravelTime.text($0))" } ?? "Getting there")
        .task(id: defaultsKey) {
            chosen = UserDefaults.standard.string(forKey: defaultsKey).flatMap(TravelMode.init(rawValue:))
            await load()
        }
    }

    private func choose(_ mode: TravelMode?) {
        chosen = mode
        if let mode { UserDefaults.standard.set(mode.rawValue, forKey: defaultsKey) } else { UserDefaults.standard.removeObject(forKey: defaultsKey) }
        Task { await load() }
    }

    private func load() async {
        estimate = await TravelEstimator.shared.estimate(from: from, to: to, mode: chosen)
    }
}
