import Foundation

/// Duplicate a trip, or save it as a template (M4-4). The copy keeps the cities (with their places and
/// zones), the ideas and the plans that don't depend on a date, shifted to a new start day. Flights, trains,
/// stays and every price are dropped, since they belong to the original dates. Pure.
enum TripTemplate {
    static func make(from trip: Trip, items: [TripItem], newStart: String, name: String? = nil)
        -> (trip: Trip, items: [TripItem]) {
        let offset = days(from: trip.startDay, to: newStart)
        var copy = trip
        copy.id = UUID().uuidString
        copy.name = name ?? (trip.name.isEmpty ? "Trip copy" : trip.name + " copy")
        copy.startDay = shift(trip.startDay, by: offset)
        copy.endDay = shift(trip.endDay, by: offset)
        copy.legs = trip.legs.map { leg in
            var l = leg
            l.startDay = shift(leg.startDay, by: offset)
            l.endDay = shift(leg.endDay, by: offset)
            return l
        }
        // Keep the shape of the trip (budget, travellers, currency); start the checklist fresh, drop rates' date.
        copy.extras = trip.extras
        copy.extras.checklist = TripChecklist.startingFrom(trip.extras.checklist ?? [])
        if copy.extras.checklist?.isEmpty == true { copy.extras.checklist = nil }
        copy.extras.fxUpdatedAt = nil
        copy.systemFields = nil
        copy.zoneOwner = ""
        copy.isShared = false
        copy.dayTitles = Dictionary(uniqueKeysWithValues: trip.dayTitles.map { (shift($0.key, by: offset), $0.value) })

        let kept = TripExport.exportable(items).filter { keeps($0) }
        let plans = kept.map { original -> TripItem in
            var item = original
            item.id = UUID().uuidString
            item.tripID = copy.id
            item.systemFields = nil
            item.createdAt = .now
            item.day = original.day.map { shift($0, by: offset) }
            item.cost = nil; item.currency = nil; item.points = nil; item.pointsProgram = nil
            // Status, confirmation and import history belong to the booking, not the idea.
            var extras = item.extras ?? ItemExtras()
            extras.status = nil; extras.source = nil; extras.ignoredWarnings = nil; extras.attachmentIDs = nil
            item.extras = extras.isEmpty ? nil : extras
            item.notes = TripItem.strippingNotBooked(item.notes)
            return item
        }
        return (copy, plans)
    }

    /// Ideas and untimed activities, food and notes. Travel and stays are bookings; timed plans are reservations.
    static func keeps(_ item: TripItem) -> Bool {
        switch item.kind {
        case .transit, .stay: false
        default: item.day == nil || item.time == nil
        }
    }

    private static func days(from a: String, to b: String) -> Int {
        Calendar.current.dateComponents([.day], from: DayKey.date(a), to: DayKey.date(b)).day ?? 0
    }

    private static func shift(_ day: String, by days: Int) -> String {
        DayKey.key(Calendar.current.date(byAdding: .day, value: days, to: DayKey.date(day)) ?? DayKey.date(day))
    }
}
