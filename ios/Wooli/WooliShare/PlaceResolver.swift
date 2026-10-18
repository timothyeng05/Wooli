import Foundation
import MapKit
import UniformTypeIdentifiers

/// Turns whatever the share sheet handed over into one Apple Maps place.
/// Apple Maps shares an `MKMapItem` plus a maps.apple.com link; other apps
/// may share only the link (or text containing it).
enum PlaceResolver {
    static func resolve(_ items: [NSExtensionItem]) async -> SharedPlace? {
        let providers = items.flatMap { $0.attachments ?? [] }
        var mapItem: MKMapItem?
        var links: [URL] = []
        for provider in providers {
            if mapItem == nil, provider.canLoadObject(ofClass: MKMapItem.self) {
                mapItem = await loadMapItem(provider)
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier), let url = await loadURL(provider) {
                links.append(url)
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                links += await loadLinks(inTextOf: provider)
            }
        }

        // A shared map item may come without its place ID; the link has it.
        if mapItem?.identifier == nil {
            for link in links {
                if let found = await lookUp(link) { mapItem = found; break }
            }
        }
        guard let mapItem else { return nil }
        let coordinate = mapItem.location.coordinate
        return SharedPlace(name: mapItem.name ?? "Shared place",
                           address: mapItem.address?.shortAddress ?? mapItem.address?.fullAddress ?? "",
                           latitude: coordinate.latitude, longitude: coordinate.longitude,
                           mapItemID: mapItem.identifier?.rawValue ?? "",
                           isFood: mapItem.pointOfInterestCategory.map(foodCategories.contains) ?? false,
                           destination: .eats)
    }

    private static let foodCategories: Set<MKPointOfInterestCategory> = [
        .restaurant, .cafe, .bakery, .brewery, .winery, .distillery, .nightlife, .foodMarket,
    ]

    // MARK: - Links

    /// maps.apple.com links: `place-id` looks the place up directly; older
    /// links carry a name (`q`/`name`) and coordinate (`ll`/`coordinate`).
    private static func lookUp(_ link: URL) async -> MKMapItem? {
        guard let link = await expanded(link), let parts = URLComponents(url: link, resolvingAgainstBaseURL: false),
              parts.host?.hasSuffix("maps.apple.com") == true else { return nil }
        let query = Dictionary((parts.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } }) { first, _ in first }

        if let raw = query["place-id"] ?? query["pid"], let id = MKMapItem.Identifier(rawValue: raw),
           let item = try? await MKMapItemRequest(mapItemIdentifier: id).mapItem {
            return item
        }
        guard let ll = query["ll"] ?? query["coordinate"] ?? query["sll"] else { return nil }
        let numbers = ll.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard numbers.count == 2 else { return nil }
        let location = CLLocation(latitude: numbers[0], longitude: numbers[1])
        let name = query["name"] ?? query["q"] ?? ""
        if !name.isEmpty, let match = await search(name, near: location) { return match }
        let item = MKMapItem(location: location, address: nil)
        item.name = name.isEmpty ? nil : name
        return item
    }

    /// Short links (maps.apple/p/…) redirect to the full maps.apple.com URL.
    private static func expanded(_ link: URL) async -> URL? {
        if link.host?.hasSuffix("maps.apple.com") == true, link.query != nil { return link }
        var request = URLRequest(url: link, timeoutInterval: 8)
        request.httpMethod = "HEAD"
        return (try? await URLSession.shared.data(for: request))?.1.url ?? link
    }

    /// The closest Apple Maps result with that name, within 300 m.
    private static func search(_ name: String, near location: CLLocation) async -> MKMapItem? {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = name
        request.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 1000, longitudinalMeters: 1000)
        guard let items = try? await MKLocalSearch(request: request).start().mapItems else { return nil }
        return items
            .map { ($0, $0.location.distance(from: location)) }
            .filter { $0.1 < 300 }
            .min { $0.1 < $1.1 }?.0
    }

    // MARK: - Loading

    private static func loadMapItem(_ provider: NSItemProvider) async -> MKMapItem? {
        await withCheckedContinuation { continuation in
            _ = provider.loadObject(ofClass: MKMapItem.self) { object, _ in
                continuation.resume(returning: object as? MKMapItem)
            }
        }
    }

    private static func loadURL(_ provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                switch item {
                case let url as URL: continuation.resume(returning: url)
                case let data as Data: continuation.resume(returning: URL(dataRepresentation: data, relativeTo: nil))
                case let text as String: continuation.resume(returning: URL(string: text))
                default: continuation.resume(returning: nil)
                }
            }
        }
    }

    private static func loadLinks(inTextOf provider: NSItemProvider) async -> [URL] {
        let text: String? = await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                continuation.resume(returning: (item as? String) ?? (item as? Data).flatMap { String(data: $0, encoding: .utf8) })
            }
        }
        guard let text, let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return [] }
        return detector.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap(\.url)
    }
}
