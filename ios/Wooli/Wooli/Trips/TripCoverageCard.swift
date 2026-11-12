import SwiftUI

/// The trip's "Planning" heatmap: one row per day, a cell per meal, activity
/// slot, night's stay and (on days you change city) travel. Green is planned,
/// grey is still open, and a dashed green outline is travel or a stay that's
/// down but not booked yet. Tapping a row jumps to that day.
struct TripCoverageCard: View {
    let trip: Trip
    let items: [TripItem]
    /// Only these days (the Mac's picked city); nil = the whole trip.
    var days: [String]? = nil
    var onSelect: (String) -> Void
    @AppStorage("trip.coverage.open") private var open = true
    @ScaledMetric(relativeTo: .caption) private var cellHeight: CGFloat = 16

    var body: some View {
        let all = TripCoverage.days(trip: trip, items: items)
        let rows = days.map { shown in all.filter { shown.contains($0.day) } } ?? all
        let cells = rows.flatMap { row in TripCoverage.Slot.allCases.map { row.state($0) } }.filter { $0 != .none }
        let planned = cells.filter { $0 == .planned }.count
        let nights = rows.filter { $0.state(.stay) == .open }.count

        VStack(alignment: .leading, spacing: Space.m) {
            Button {
                withAnimation(.snappy) { open.toggle() }
            } label: {
                CardHeader(title: "Planning", subtitle: summary(planned: planned, total: cells.count, nights: nights)) {
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold)).foregroundStyle(Theme.textTertiary)
                        .rotationEffect(.degrees(open ? 0 : -90))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if open {
                Grid(horizontalSpacing: Space.xs, verticalSpacing: Space.xs) {
                    GridRow {
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                        ForEach(TripCoverage.Slot.allCases) { slot in heading(slot) }
                    }
                    ForEach(rows) { row in
                        GridRow {
                            dayLabel(row.day)
                            ForEach(TripCoverage.Slot.allCases) { slot in
                                cell(row.state(slot))
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture { onSelect(row.day) }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(accessibility(row))
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction { onSelect(row.day) }
                    }
                }
                legend
            }
        }
        .card()
    }

    private func summary(planned: Int, total: Int, nights: Int) -> String {
        var text = "\(planned) of \(total) planned"
        if nights > 0 { text += " · \(nights) night\(nights == 1 ? "" : "s") without a bed" }
        return text
    }

    @ViewBuilder
    private func heading(_ slot: TripCoverage.Slot) -> some View {
        Group {
            if let symbol = slot.symbol { Image(systemName: symbol) } else { Text(slot.short) }
        }
        .font(.caption2.weight(.semibold))
        .foregroundStyle(Theme.textTertiary)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(slot.label)
    }

    private func dayLabel(_ day: String) -> some View {
        let date = DayKey.date(day)
        return HStack(spacing: Space.xs) {
            Text(date, format: .dateTime.weekday(.narrow)).foregroundStyle(Theme.textTertiary)
            Text(date, format: .dateTime.month(.abbreviated).day()).foregroundStyle(day == DayKey.key(.now) ? Theme.brand : Theme.textSecondary)
        }
        .font(.caption.weight(.medium).monospacedDigit())
        .lineLimit(1)
        .fixedSize()
        .gridColumnAlignment(.leading)
    }

    @ViewBuilder
    private func cell(_ state: TripCoverage.State) -> some View {
        switch state {
        case .planned: Capsule().fill(Theme.income).frame(height: cellHeight)
        case .unbooked:
            Capsule().fill(Theme.income.opacity(0.18))
                .overlay(Capsule().strokeBorder(Theme.income, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])))
                .frame(height: cellHeight)
        case .open: Capsule().fill(Theme.track).frame(height: cellHeight)
        case .none: Color.clear.frame(height: cellHeight)
        }
    }

    private var legend: some View {
        HStack(spacing: Space.m) {
            legendItem("Planned", state: .planned)
            legendItem("Not booked", state: .unbooked)
            legendItem("Open", state: .open)
        }
        .font(.caption2).foregroundStyle(Theme.textTertiary)
    }

    private func legendItem(_ title: String, state: TripCoverage.State) -> some View {
        HStack(spacing: Space.xs) {
            cell(state).frame(width: cellHeight * 1.5)
            Text(title)
        }
    }

    private func accessibility(_ row: TripCoverage.Day) -> String {
        let date = DayKey.date(row.day).formatted(.dateTime.weekday(.wide).month(.wide).day())
        let open = TripCoverage.Slot.allCases.filter { row.state($0) == .open }.map(\.label)
        let unbooked = TripCoverage.Slot.allCases.filter { row.state($0) == .unbooked }.map(\.label)
        var parts = [date]
        parts.append(open.isEmpty ? "Everything planned" : "Open: " + open.joined(separator: ", "))
        if !unbooked.isEmpty { parts.append("Not booked: " + unbooked.joined(separator: ", ")) }
        return parts.joined(separator: ". ")
    }
}
