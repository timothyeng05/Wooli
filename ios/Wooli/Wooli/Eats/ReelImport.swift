import SwiftUI
import MapKit
#if canImport(FoundationModels)
import FoundationModels
#endif

// Restaurants from an Instagram reel, Wanderlog-style but without a server:
// the iPhone downloads the reel's public caption, picks out the places it
// names (📍 lines, plus Apple Intelligence when it's on), and looks each
// one up on Apple Maps. Found places go to Eats' Want to try.

enum ReelPlaces {
    struct Found: Identifiable {
        let id = UUID().uuidString
        let place: TripPlace
    }

    struct Result {
        /// nil when Instagram didn't hand over the caption (it often wants a login).
        var caption: String?
        var found: [Found] = []
        /// Names from the caption that Apple Maps couldn't find.
        var missing: [String] = []
    }

    static func look(at url: URL) async -> Result {
        guard let caption = await caption(for: url) else { return Result() }
        var result = Result(caption: caption)
        for query in await names(in: caption) {
            if let place = await lookUp(query) {
                if !result.found.contains(where: { $0.place.mapItemID == place.mapItemID && !place.mapItemID.isEmpty }) {
                    result.found.append(Found(place: place))
                }
            } else {
                result.missing.append(query)
            }
        }
        return result
    }

    // MARK: Caption

    /// The public embed page carries the caption; the post page's
    /// description tag is the fallback.
    static func caption(for url: URL) async -> String? {
        let parts = url.pathComponents
        guard parts.count >= 3 else { return nil }
        let code = parts[2]
        for page in ["https://www.instagram.com/p/\(code)/embed/captioned/", "https://www.instagram.com/p/\(code)/"] {
            guard let pageURL = URL(string: page),
                  let response = try? await URLSession.shared.data(from: pageURL),
                  let html = String(data: response.0, encoding: .utf8) else { continue }
            if let text = embedCaption(in: html) ?? metaDescription(in: html), !text.isEmpty { return text }
        }
        return nil
    }

    /// `<div class="Caption"><a class="CaptionUsername">name</a><br/>text…<div class="CaptionComments">`
    static func embedCaption(in html: String) -> String? {
        guard let start = html.range(of: "class=\"Caption\"") else { return nil }
        var body = html[start.upperBound...]
        guard let tagEnd = body.firstIndex(of: ">") else { return nil }
        body = body[body.index(after: tagEnd)...]
        if let end = body.range(of: "<div class=\"CaptionComments\"") ?? body.range(of: "</div>") {
            body = body[..<end.lowerBound]
        }
        let text = plainText(String(body).replacing(try! Regex("(?s)<a[^>]*CaptionUsername[^>]*>.*?</a>"), with: ""))
        return text.isEmpty ? nil : text
    }

    /// `content="12 likes, 3 comments - user on May 1, 2025: &quot;caption&quot;"`
    static func metaDescription(in html: String) -> String? {
        guard let match = html.firstMatch(of: try! Regex("<meta[^>]+property=\"og:description\"[^>]+content=\"([^\"]*)\"")),
              let raw = match.output[1].substring else { return nil }
        var text = plainText(String(raw))
        if let quote = text.range(of: ": \"") { text = String(text[quote.upperBound...]) }
        if text.hasSuffix("\".") { text.removeLast(2) } else if text.hasSuffix("\"") { text.removeLast() }
        return text.isEmpty ? nil : text
    }

    /// Tags out, line breaks kept, HTML entities decoded.
    static func plainText(_ html: String) -> String {
        var text = html.replacing(try! Regex("(?i)<br\\s*/?>"), with: "\n")
        text = text.replacing(try! Regex("<[^>]+>"), with: "")
        for (entity, char) in ["&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " "] {
            text = text.replacingOccurrences(of: entity, with: char)
        }
        text = text.replacing(try! Regex("&#(x?)([0-9a-fA-F]+);")) { match in
            let hex = match.output[1].substring == "x"
            let digits = match.output[2].substring.map(String.init) ?? ""
            guard let value = UInt32(digits, radix: hex ? 16 : 10), let scalar = Unicode.Scalar(value) else { return "" }
            return String(Character(scalar))
        }
        // Last, so "&amp;quot;" stays "&quot;".
        return text.replacingOccurrences(of: "&amp;", with: "&").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: Names

    /// What to search Apple Maps for: 📍 lines first, then Apple
    /// Intelligence's reading of the caption. At most 10.
    static func names(in caption: String) async -> [String] {
        var names = pinned(in: caption)
        for name in await modelNames(in: caption)
        where !names.contains(where: { $0.localizedCaseInsensitiveContains(name.split(separator: ",").first.map(String.init) ?? name) }) {
            names.append(name)
        }
        return Array(names.prefix(10))
    }

    /// "📍 Joe's Pizza, Greenwich Village" → "Joe's Pizza, Greenwich Village"
    static func pinned(in caption: String) -> [String] {
        caption.split(separator: "\n").compactMap { line in
            guard let pin = line.range(of: "📍") else { return nil }
            let name = line[pin.upperBound...]
                .replacingOccurrences(of: "@", with: "")
                .replacingOccurrences(of: "_", with: " ") // @lucali_bk → "lucali bk" for Maps
                .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters.subtracting(CharacterSet(charactersIn: "'&"))))
            return name.isEmpty ? nil : name
        }
    }

    private static func modelNames(in caption: String) async -> [String] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), case .available = SystemLanguageModel.default.availability {
            let session = LanguageModelSession(instructions: """
                You read Instagram captions about food. List the restaurants, cafés, bars, bakeries and other \
                food spots the caption names. Only include places that are named; never guess.
                """)
            if let response = try? await session.respond(to: caption, generating: CaptionSpots.self) {
                return response.content.spots.compactMap { spot in
                    let name = spot.name.replacingOccurrences(of: "@", with: "").trimmingCharacters(in: .whitespaces)
                    guard !name.isEmpty else { return nil }
                    return spot.area.isEmpty ? name : "\(name), \(spot.area)"
                }
            }
        }
        #endif
        return []
    }

    private static func lookUp(_ query: String) async -> TripPlace? {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = .pointOfInterest
        guard let item = try? await MKLocalSearch(request: request).start().mapItems.first else { return nil }
        let coordinate = item.location.coordinate
        return TripPlace(name: item.name ?? query,
                         address: item.address?.shortAddress ?? item.address?.fullAddress ?? "",
                         latitude: coordinate.latitude, longitude: coordinate.longitude,
                         mapItemID: item.identifier?.rawValue ?? "")
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
private struct CaptionSpots {
    @Guide(description: "Each food place the caption names; empty if it names none")
    var spots: [CaptionSpot]
}

@available(iOS 26.0, *)
@Generable
private struct CaptionSpot {
    @Guide(description: "The place's name as written, without @ or hashtags")
    var name: String
    @Guide(description: "The city or neighborhood the caption gives for it, or empty")
    var area: String
}
#endif

/// Shown when a reel arrives from the share sheet: the places found in its
/// caption, all ticked, to add to Want to try.
struct ReelImportSheet: View {
    let reel: SharedReel

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var result: ReelPlaces.Result?
    @State private var picked: Set<String> = []
    @State private var searching = false
    @State private var showCaption = false

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    list(result)
                } else {
                    ProgressView("Reading the reel…").frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Places in this reel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(picked.isEmpty ? "Add" : "Add \(picked.count)") { add() }.disabled(picked.isEmpty)
                }
            }
            .sheet(isPresented: $searching) {
                NavigationStack {
                    PlaceSearchView(near: "") { place in
                        let found = ReelPlaces.Found(place: place)
                        result?.found.append(found)
                        picked.insert(found.id)
                    }
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { searching = false } } }
                }
            }
            .task {
                let looked = await ReelPlaces.look(at: reel.url)
                picked = Set(looked.found.map(\.id))
                result = looked
            }
        }
    }

    private func list(_ result: ReelPlaces.Result) -> some View {
        List {
            Section {
                ForEach(result.found) { found in
                    Button { toggle(found.id) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: picked.contains(found.id) ? "checkmark.circle.fill" : "circle")
                                .font(.title3).foregroundStyle(picked.contains(found.id) ? AppSpace.eats.tint : Theme.textTertiary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(found.place.name).font(.headline).foregroundStyle(Theme.text)
                                if !found.place.address.isEmpty {
                                    Text(found.place.address).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                                }
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Button("Add a place by name", systemImage: "magnifyingglass") { searching = true }
            } header: {
                if !result.found.isEmpty { Text("Save to Want to try") }
            } footer: {
                if result.caption == nil {
                    Text("Instagram didn't share this reel's caption. Add the place by name.")
                } else if result.found.isEmpty {
                    Text("No places found in the caption. Add the place by name.")
                } else if !result.missing.isEmpty {
                    Text("Not found on Apple Maps: \(result.missing.joined(separator: ", "))")
                }
            }

            Section {
                if let caption = result.caption {
                    Text(caption).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .lineLimit(showCaption ? nil : 4)
                        .onTapGesture { withAnimation(.snappy) { showCaption.toggle() } }
                }
                Link(destination: reel.url) { Label("Watch on Instagram", systemImage: "play.rectangle") }
            } header: {
                if result.caption != nil { Text("Caption") }
            }
        }
    }

    private func toggle(_ id: String) {
        if picked.contains(id) { picked.remove(id) } else { picked.insert(id) }
    }

    private func add() {
        for found in result?.found ?? [] where picked.contains(found.id) {
            var place = EatsPlace(name: found.place.name, place: found.place)
            // The reel, so you can watch it again from Want to try.
            place.notes = reel.url.absoluteString
            EatsBook.shared.addToWishlist(place)
        }
        app.space = .eats
        dismiss()
    }
}
