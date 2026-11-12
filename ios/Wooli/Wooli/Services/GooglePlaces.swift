import CoreLocation
import Foundation

/// Google Places text search, the fallback when Apple Maps can't find a
/// place (it's thin on restaurants and sights in much of the world). The key
/// comes from `GOOGLE_PLACES_API_KEY` in the git-ignored
/// `Config/Secrets.xcconfig`, through Info.plist; without it the fallback is
/// hidden. Restrict the key to this bundle id and the Places API (New) in
/// Google Cloud: it ships inside the app.
enum GooglePlaces {
    struct Result: Identifiable, Hashable {
        let id: String
        let name: String
        let address: String
        let latitude: Double
        let longitude: Double

        var place: TripPlace {
            TripPlace(name: name, address: address, latitude: latitude, longitude: longitude)
        }
    }

    private struct Response: Decodable {
        let places: [Place]?
    }

    private struct Place: Decodable {
        struct Text: Decodable { let text: String }
        struct Location: Decodable { let latitude: Double; let longitude: Double }
        let id: String
        let displayName: Text?
        let shortFormattedAddress: String?
        let formattedAddress: String?
        let location: Location?
    }

    private static let key = (Bundle.main.object(forInfoDictionaryKey: "GooglePlacesAPIKey") as? String ?? "")
        .trimmingCharacters(in: .whitespaces)

    static var isConfigured: Bool { !key.isEmpty && !key.hasPrefix("$(") }

    /// The person has agreed to their search text going to Google (asked once,
    /// before the first Google search; off again in Settings).
    static let consentKey = "search.googleConsent"
    static var hasConsent: Bool { UserDefaults.standard.bool(forKey: consentKey) }

    /// Configured and agreed: the only time Wooli searches Google by itself.
    static var isEnabled: Bool { isConfigured && hasConsent }

    /// Up to 10 places matching `text`, favouring those within `radius`
    /// metres of `near` when given. Empty on any failure.
    static func search(_ text: String, near: CLLocationCoordinate2D? = nil, radius: Double = 30_000) async -> [Result] {
        guard isConfigured, let url = URL(string: "https://places.googleapis.com/v1/places:searchText") else { return [] }
        var body: [String: Any] = ["textQuery": text, "pageSize": 10]
        if let near {
            body["locationBias"] = ["circle": [
                "center": ["latitude": near.latitude, "longitude": near.longitude],
                "radius": min(radius, 50_000), // the API's maximum
            ]]
        }
        if let language = Locale.current.language.languageCode?.identifier { body["languageCode"] = language }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "X-Goog-Api-Key")
        // Only the fields we show, which keeps each search in the cheaper tier.
        request.setValue("places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location",
                         forHTTPHeaderField: "X-Goog-FieldMask")
        // Lets a key restricted to iOS apps accept the request.
        if let bundle = Bundle.main.bundleIdentifier { request.setValue(bundle, forHTTPHeaderField: "X-Ios-Bundle-Identifier") }

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let decoded = try? JSONDecoder().decode(Response.self, from: data)
        else { return [] }
        return (decoded.places ?? []).compactMap { place in
            guard let name = place.displayName?.text, let location = place.location else { return nil }
            return Result(id: place.id, name: name,
                          address: place.shortFormattedAddress ?? place.formattedAddress ?? "",
                          latitude: location.latitude, longitude: location.longitude)
        }
    }
}
