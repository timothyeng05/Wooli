import SwiftUI
import SwiftData

/// Today's hero: what's coming up across the apps you use — bills, the next flight or
/// reservation, the predicted period — on one departures board, soonest first.
struct NextUpBoard: View {
    @Query private var recurring: [RecurringItem]
    @Query(sort: \PeriodEntry.startDay, order: .reverse) private var periods: [PeriodEntry]
    @State private var lineup = AppLineup.shared
    @State private var store = TripStore.shared

    var body: some View {
        let rows = Array(self.rows.prefix(5))
        if !rows.isEmpty { DepartureBoard(rows: rows) }
    }

    private var rows: [DepartureRow] {
        var rows: [DepartureRow] = []
        if lineup.isEnabled(.budget) {
            rows += RecurringMonth(items: recurring).departures(limit: 5)
        }
        if lineup.isEnabled(.trips) {
            let today = DayKey.key(.now)
            let nowMinutes = Calendar.current.component(.hour, from: .now) * 60 + Calendar.current.component(.minute, from: .now)
            let upcoming = store.items
                .filter { item in
                    guard let day = item.day, item.kind == .transit || (item.kind == .meal && item.time != nil) else { return false }
                    return day > today || (day == today && (item.time ?? 0) >= nowMinutes)
                }
                .sorted { ($0.day ?? "", $0.time ?? 0) < ($1.day ?? "", $1.time ?? 0) }
                .prefix(2)
            rows += upcoming.compactMap { item in
                item.day.map { DepartureRow(date: DayKey.date($0), title: item.title.isEmpty ? item.kind.label : item.title,
                                            amount: item.timeText, status: .due) }
            }
        }
        if lineup.isEnabled(.period), let next = CycleMath.predictedNextStart(periods.map(\.cycleEntry)),
           next >= Calendar.current.startOfDay(for: .now) {
            rows.append(DepartureRow(date: next, title: "Period (predicted)", status: .due))
        }
        return rows.sorted { $0.date < $1.date }
    }
}
