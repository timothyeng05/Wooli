import SwiftUI
import MapKit

extension TripPlace {
    /// The place's Apple Maps listing: by its place ID when it came from
    /// search, else the best name match right at its spot, else a bare pin.
    func mapItem() async -> MKMapItem {
        if !mapItemID.isEmpty, let id = MKMapItem.Identifier(rawValue: mapItemID),
           let item = try? await MKMapItemRequest(mapItemIdentifier: id).mapItem {
            return item
        }
        let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = name
        request.region = MKCoordinateRegion(center: center, latitudinalMeters: 400, longitudinalMeters: 400)
        request.regionPriority = .required
        let spot = CLLocation(latitude: latitude, longitude: longitude)
        if let match = try? await MKLocalSearch(request: request).start().mapItems
            .min(by: { $0.location.distance(from: spot) < $1.location.distance(from: spot) }),
           match.location.distance(from: spot) < 200 {
            return match
        }
        let item = MKMapItem(location: spot, address: nil)
        item.name = name
        return item
    }
}

/// Opens Apple's own place card for a place — hours, photos, ratings,
/// menu, phone, website — without leaving Wooli.
struct AppleMapsListingButton: View {
    let place: TripPlace
    @State private var item: MKMapItem?
    @State private var loading = false

    var body: some View {
        Button {
            loading = true
            Task {
                item = await place.mapItem()
                loading = false
            }
        } label: {
            HStack {
                Label("Apple Maps listing", systemImage: "mappin.and.ellipse")
                Spacer()
                if loading { ProgressView() }
            }
        }
        .disabled(loading)
        .mapItemDetailSheet(item: $item)
    }
}
