import Foundation
import CoreLocation
import SwiftData

// Sights: places to see — landmarks, museums, parks, viewpoints — saved from
// Apple Maps. Like Eats' Been / Want to try, without ranking or friends.
// Stored in SwiftData, so it syncs through the user's iCloud like Movies.

@Model
final class SightEntry {
    var id: String = UUID().uuidString
    var name: String = ""
    var address: String = ""
    var latitude: Double?
    var longitude: Double?
    /// Apple Maps place ID ("I…"), so the same place added twice merges.
    var mapItemID: String = ""
    /// "yyyy-MM-dd" you went; "" while it's still on your want-to-go list.
    var visitedDay: String = ""
    var notes: String = ""
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now

    init(name: String, place: TripPlace? = nil, visitedDay: String = "") {
        self.name = name
        self.visitedDay = visitedDay
        if let place {
            address = place.address
            latitude = place.latitude
            longitude = place.longitude
            mapItemID = place.mapItemID
        }
    }

    var isVisited: Bool { !visitedDay.isEmpty }

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var tripPlace: TripPlace? {
        guard let latitude, let longitude else { return nil }
        return TripPlace(name: name, address: address, latitude: latitude, longitude: longitude, mapItemID: mapItemID)
    }

    /// The city from the address, worked out the way Eats does it.
    var city: String? {
        var place = EatsPlace(name: name)
        place.address = address
        return place.city
    }

    /// "Visited Jun 2, 2026", or "" while it's on the want-to-go list.
    var visitedText: String {
        isVisited ? DayKey.date(visitedDay).formatted(.dateTime.month(.abbreviated).day().year()) : ""
    }

    /// Already saved: same Apple Maps ID, else same name in the same place.
    func isSamePlace(as place: TripPlace) -> Bool {
        if !mapItemID.isEmpty && mapItemID == place.mapItemID { return true }
        return name.caseInsensitiveCompare(place.name) == .orderedSame && address == place.address
    }
}
