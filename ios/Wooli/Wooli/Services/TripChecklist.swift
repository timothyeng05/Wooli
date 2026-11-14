import Foundation

/// A trip's checklist (M4-2): packing, documents, things to book. Pure list operations over
/// `TripExtras.checklist`, so each edit gives back the whole new list for the caller to save.
enum TripChecklist {
    static let suggestedGroups = ["Packing", "Documents", "To book"]

    static func progress(_ items: [ChecklistItem]) -> (done: Int, total: Int) {
        (items.filter(\.done).count, items.count)
    }

    /// Items grouped by name in order of first appearance, with the ungrouped ones first.
    static func groups(_ items: [ChecklistItem]) -> [(name: String, items: [ChecklistItem])] {
        var order: [String] = items.contains { $0.group.isEmpty } ? [""] : []
        for item in items where !order.contains(item.group) { order.append(item.group) }
        return order.map { name in (name, items.filter { $0.group == name }) }
    }

    /// Adds an item. An empty title, or the same title already in the same group, changes nothing.
    static func adding(_ title: String, group: String = "", to items: [ChecklistItem]) -> [ChecklistItem] {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let group = group.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty,
              !items.contains(where: { $0.group == group && $0.title.caseInsensitiveCompare(title) == .orderedSame }) else { return items }
        return items + [ChecklistItem(title: title, group: group)]
    }

    static func toggling(_ id: String, in items: [ChecklistItem]) -> [ChecklistItem] {
        items.map { item in
            guard item.id == id else { return item }
            var copy = item
            copy.done.toggle()
            return copy
        }
    }

    static func removing(_ id: String, from items: [ChecklistItem]) -> [ChecklistItem] {
        items.filter { $0.id != id }
    }

    static func clearingDone(_ items: [ChecklistItem]) -> [ChecklistItem] {
        items.filter { !$0.done }
    }

    /// A fresh copy of a list for a new trip: same titles and groups, new ids, nothing ticked.
    static func startingFrom(_ source: [ChecklistItem]) -> [ChecklistItem] {
        source.map { ChecklistItem(title: $0.title, group: $0.group) }
    }

    /// "Start from my last trip's list": the checklist of the trip that started most recently
    /// before this one (else the most recent other trip) that has one.
    static func lastTripsList(for trip: Trip, among trips: [Trip]) -> (from: Trip, items: [ChecklistItem])? {
        let others = trips.filter { $0.id != trip.id && !($0.extras.checklist ?? []).isEmpty }
        let before = others.filter { $0.startDay < trip.startDay }.max { $0.startDay < $1.startDay }
        guard let pick = before ?? others.max(by: { $0.startDay < $1.startDay }) else { return nil }
        return (pick, pick.extras.checklist ?? [])
    }
}
