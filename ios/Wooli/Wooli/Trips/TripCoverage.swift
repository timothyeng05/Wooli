import Foundation

/// How much of each trip day is planned: three meals, three activity slots,
/// a bed for the night and, on days the city changes, the travel. Drives the
/// trip's "Planning" heatmap. Pure, so it's tested in `WooliTests`.
enum TripCoverage {
    enum Slot: Int, CaseIterable, Identifiable {
        case breakfast, morning, lunch, afternoon, dinner, evening, stay, transit
        var id: Int { rawValue }

        var label: String {
            switch self {
            case .breakfast: "Breakfast"
            case .morning: "Morning"
            case .lunch: "Lunch"
            case .afternoon: "Afternoon"
            case .dinner: "Dinner"
            case .evening: "Evening"
            case .stay: "Stay"
            case .transit: "Travel"
            }
        }

        /// The column heading: a letter for meals, a time of day for activities.
        var short: String {
            switch self {
            case .breakfast: "B"
            case .morning: "AM"
            case .lunch: "L"
            case .afternoon: "PM"
            case .dinner: "D"
            case .evening: "Eve"
            case .stay, .transit: ""
            }
        }

        var symbol: String? {
            switch self {
            case .stay: "bed.double.fill"
            case .transit: "airplane"
            default: nil
            }
        }
    }

    enum State: Equatable {
        /// Something real is planned.
        case planned
        /// Travel or a stay is down but marked "Not booked yet".
        case unbooked
        case open
        /// Doesn't apply: no travel on a day the city stays the same, no
        /// bed on the trip's last day.
        case none
    }

    struct Day: Identifiable, Equatable {
        let day: String
        var cells: [Slot: State]
        var id: String { day }
        func state(_ slot: Slot) -> State { cells[slot] ?? .none }
    }

    static func days(trip: Trip, items: [TripItem]) -> [Day] {
        let items = items.filter { !$0.isCancelled }
        let days = trip.days
        let byDay = Dictionary(grouping: items.filter { $0.day != nil }, by: { $0.day! })
        let stays = items.filter { $0.kind == .stay && $0.day != nil }
        let transitDays = changeDays(trip)
        return days.enumerated().map { index, day in
            let plans = byDay[day] ?? []
            var cells = meals(plans).merging(activities(plans)) { a, _ in a }
            if index < days.count - 1 {
                let next = days[index + 1]
                cells[.stay] = night(day, stays: stays, travelToday: plans.filter { $0.kind == .transit },
                                     travelTomorrow: (byDay[next] ?? []).filter { $0.kind == .transit })
            }
            if let range = transitDays[day] {
                let travel = items.filter { $0.kind == .transit && $0.day.map { $0 >= range.lowerBound && $0 <= range.upperBound } ?? false }
                cells[.transit] = booking(travel)
            }
            return Day(day: day, cells: cells)
        }
    }

    // MARK: Meals

    private static func meals(_ plans: [TripItem]) -> [Slot: State] {
        var filled: Set<Slot> = []
        var untimed = 0
        for meal in plans where meal.kind == .meal && !meal.isMealPlaceholder {
            if let slot = mealSlot(meal) { filled.insert(slot) } else { untimed += 1 }
        }
        for slot in [Slot.breakfast, .lunch, .dinner] where untimed > 0 && !filled.contains(slot) {
            filled.insert(slot)
            untimed -= 1
        }
        return Dictionary(uniqueKeysWithValues: [Slot.breakfast, .lunch, .dinner].map { ($0, filled.contains($0) ? .planned : .open) })
    }

    /// By name first ("Dinner" at a place), then by time.
    private static func mealSlot(_ meal: TripItem) -> Slot? {
        let title = meal.title.lowercased()
        if title.contains("breakfast") || title.contains("brunch") { return .breakfast }
        if title.contains("lunch") { return .lunch }
        if title.contains("dinner") || title.contains("supper") { return .dinner }
        guard let time = meal.time else { return nil }
        return time < 11 * 60 ? .breakfast : time < 16 * 60 ? .lunch : .dinner
    }

    // MARK: Activities

    private static func activities(_ plans: [TripItem]) -> [Slot: State] {
        var filled: Set<Slot> = []
        var untimed = 0
        for activity in plans where activity.kind == .activity {
            guard let time = activity.time else { untimed += 1; continue }
            filled.insert(time < 12 * 60 ? .morning : time < 18 * 60 ? .afternoon : .evening)
        }
        for slot in [Slot.morning, .afternoon, .evening] where untimed > 0 && !filled.contains(slot) {
            filled.insert(slot)
            untimed -= 1
        }
        return Dictionary(uniqueKeysWithValues: [Slot.morning, .afternoon, .evening].map { ($0, filled.contains($0) ? .planned : .open) })
    }

    // MARK: Stays and travel

    /// A bed for the night after `day`: a stay that covers it, or an
    /// overnight flight or train (one arriving the next day, or leaving
    /// before 6 the next morning).
    private static func night(_ day: String, stays: [TripItem], travelToday: [TripItem], travelTomorrow: [TripItem]) -> State {
        let covering = stays.filter { stay in
            guard let start = stay.day else { return false }
            return start <= day && day < (stay.stayEnd ?? DayKey.key(Calendar.current.date(byAdding: .day, value: 1, to: DayKey.date(start))!))
        }
        let overnight = travelToday.filter { ($0.transport?.arriveDayOffset ?? 0) > 0 }
            + travelTomorrow.filter { ($0.time ?? Int.max) < 6 * 60 }
        let all = covering + overnight
        guard !all.isEmpty else { return .open }
        return all.contains { !isUnbooked($0) } ? .planned : .unbooked
    }

    private static func booking(_ travel: [TripItem]) -> State {
        guard !travel.isEmpty else { return .open }
        return travel.contains(where: isUnbooked) ? .unbooked : .planned
    }

    static func isUnbooked(_ item: TripItem) -> Bool { item.isUnbooked }

    /// The days you change city, each with the days its travel might be
    /// filed under (leave one city on its last day, arrive at the next on
    /// its first). The first and last day count too when the trip starts
    /// or ends away from a home stop: that's getting there and back.
    static func changeDays(_ trip: Trip) -> [String: ClosedRange<String>] {
        let legs = trip.legs.sorted { $0.startDay < $1.startDay }
        guard let first = legs.first, let last = legs.last else { return [:] }
        let days = Set(trip.days)
        var result: [String: ClosedRange<String>] = [:]
        for (a, b) in zip(legs, legs.dropFirst()) {
            let leave = min(a.endDay, b.startDay)
            guard days.contains(leave) else { continue }
            result[leave] = leave...max(a.endDay, b.startDay)
        }
        if !first.isHome, result[trip.startDay] == nil { result[trip.startDay] = trip.startDay...trip.startDay }
        if !last.isHome, result[trip.endDay] == nil { result[trip.endDay] = trip.endDay...trip.endDay }
        return result
    }
}
