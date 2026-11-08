import Foundation
import MapKit
import UniformTypeIdentifiers

/// Turns whatever the share sheet handed over into one Apple Maps place.
/// Apple Maps shares an `MKMapItem` plus a maps.apple.com link; other apps
/// may share only the link (or text containing it). Google Maps shares a
/// maps.app.goo.gl link, matched to the Apple Maps place by name and pin.
enum PlaceResolver {
    static func resolve(_ items: [NSExtensionItem]) async -> SharedPlace? {
        let providers = items.flatMap { $0.attachments ?? [] }
        var mapItem: MKMapItem?
        for provider in providers where provider.canLoadObject(ofClass: MKMapItem.self) {
            mapItem = await loadMapItem(provider)
            if mapItem != nil { break }
        }
        let sharedLinks = await links(in: items)

        // A shared map item may come without its place ID; the link has it.
        if mapItem?.identifier == nil {
            for link in sharedLinks {
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

    /// An Instagram reel or post among the shared links (Instagram shares just the link).
    static func instagramLink(in items: [NSExtensionItem]) async -> URL? {
        await links(in: items).first(where: SharedPlaceHandoff.isInstagramPost)
    }

    private static func links(in items: [NSExtensionItem]) async -> [URL] {
        var links: [URL] = []
        for provider in items.flatMap({ $0.attachments ?? [] }) {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier), let url = await loadURL(provider) {
                links.append(url)
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                links += await loadLinks(inTextOf: provider)
            }
        }
        return links
    }

    /// maps.apple.com links: `place-id` looks the place up directly; older
    /// links carry a name (`q`/`name`) and coordinate (`ll`/`coordinate`).
    private static func lookUp(_ link: URL) async -> MKMapItem? {
        guard let link = await expanded(link), let parts = URLComponents(url: link, resolvingAgainstBaseURL: false) else { return nil }
        let query = Dictionary((parts.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } }) { first, _ in first }
        if isGoogleMaps(parts) { return await lookUpGoogle(parts, query: query) }
        guard parts.host?.hasSuffix("maps.apple.com") == true else { return nil }

        if let raw = query["place-id"] ?? query["pid"], let id = MKMapItem.Identifier(rawValue: raw),
           let item = try? await MKMapItemRequest(mapItemIdentifier: id).mapItem {
            return item
        }
        guard let ll = query["ll"] ?? query["coordinate"] ?? query["sll"] else { return nil }
        let numbers = ll.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard numbers.count == 2 else { return nil }
        let location = CLLocation(latitude: numbers[0], longitude: numbers[1])
        return await place(named: query["name"] ?? query["q"] ?? "", at: location)
    }

    /// The Apple Maps place with that name at the pin, or a bare pin.
    private static func place(named name: String, at location: CLLocation) async -> MKMapItem {
        if !name.isEmpty, let match = await search(name, near: location) { return match }
        let item = MKMapItem(location: location, address: nil)
        item.name = name.isEmpty ? nil : name
        return item
    }

    /// Short links (maps.apple/p/…, maps.app.goo.gl/…) redirect to the full URL.
    /// Google's cookie-consent page (EU) wraps the real link in `continue`.
    private static func expanded(_ link: URL) async -> URL? {
        if link.host?.hasSuffix("maps.apple.com") == true, link.query != nil { return link }
        if let parts = URLComponents(url: link, resolvingAgainstBaseURL: false), isGoogleMaps(parts) { return link }
        var request = URLRequest(url: link, timeoutInterval: 8)
        request.httpMethod = "HEAD"
        guard let final = (try? await URLSession.shared.data(for: request))?.1.url else { return link }
        if final.host?.hasPrefix("consent.google.") == true,
           let wrapped = URLComponents(url: final, resolvingAgainstBaseURL: false)?.queryItems?
               .first(where: { $0.name == "continue" })?.value.flatMap(URL.init(string:)) {
            return wrapped
        }
        return final
    }

    // MARK: - Google Maps

    /// google.com/maps/…, maps.google.com/…, or any country domain of either.
    private static func isGoogleMaps(_ parts: URLComponents) -> Bool {
        guard let host = parts.host?.lowercased() else { return false }
        return host.hasPrefix("maps.google.") || (host.contains("google.") && parts.path.hasPrefix("/maps"))
    }

    /// Google links come in two shapes:
    /// - `/maps/place/<Name>/@lat,lng,17z/data=…!3d<lat>!4d<lng>…`: the name
    ///   and the place's pin (`!3d!4d`; `@` is only the map's centre).
    /// - `?q=<Name, address>` (or `query=`), sometimes just `q=lat,lng`:
    ///   looked up in Apple Maps as typed.
    private static func lookUpGoogle(_ parts: URLComponents, query: [String: String]) async -> MKMapItem? {
        let path = parts.percentEncodedPath
        let segments = path.split(separator: "/").map(String.init)
        var name = ""
        if let index = segments.firstIndex(where: { $0 == "place" || $0 == "search" }), index + 1 < segments.count,
           !segments[index + 1].hasPrefix("@") {
            name = segments[index + 1].replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? ""
        }
        if let location = coordinate(in: path, after: "!3d", and: "!4d") ?? coordinate(in: path, after: "@", and: ",") {
            return await place(named: name, at: location)
        }

        let text = (query["q"] ?? query["query"] ?? name).trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        if let location = coordinate(in: text) { return await place(named: "", at: location) }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = text
        return try? await MKLocalSearch(request: request).start().mapItems.first
    }

    /// "…<latMarker>40.73<lngMarker>-74.00…" → a location.
    private static func coordinate(in text: String, after latMarker: String, and lngMarker: String) -> CLLocation? {
        guard let start = text.range(of: latMarker, options: .backwards) else { return nil }
        return coordinate(in: text[start.upperBound...].replacingOccurrences(of: lngMarker, with: ","))
    }

    /// "40.73,-74.00" (anything after a third comma or `!` is ignored) → a location.
    private static func coordinate(in text: String) -> CLLocation? {
        let numbers = text.split(separator: "!").first.map { $0.split(separator: ",").prefix(2) } ?? []
        let values = numbers.compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard values.count == 2, abs(values[0]) <= 90, abs(values[1]) <= 180 else { return nil }
        return CLLocation(latitude: values[0], longitude: values[1])
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
