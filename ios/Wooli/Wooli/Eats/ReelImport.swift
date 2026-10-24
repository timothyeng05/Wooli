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
        /// The name as the caption wrote it, so a wrong match is easy to spot.
        var fromCaption = ""
    }

    /// A place the caption names, with whatever it says about where it is.
    struct Spot {
        var name: String
        /// The name in its own script (人和馆), when the caption gives both.
        var localName = ""
        var address = ""
        var area = ""

        var label: String { localName.isEmpty || localName == name ? name : "\(name) \(localName)" }
    }

    struct Result {
        /// nil when Instagram didn't hand over the caption (it often wants a login).
        var caption: String?
        var found: [Found] = []
        /// Names from the caption that Apple Maps couldn't find.
        var missing: [String] = []
    }

    static func look(at caption: String?) async -> Result {
        guard let caption else { return Result() }
        var result = Result(caption: caption)
        for spot in await spots(in: caption) {
            if let place = await lookUp(spot) {
                if !result.found.contains(where: { $0.place.mapItemID == place.mapItemID && !place.mapItemID.isEmpty }) {
                    result.found.append(Found(place: place, fromCaption: spot.label))
                }
            } else {
                result.missing.append(spot.label)
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

    /// What the caption names: 📍 lines first, then Apple Intelligence's
    /// reading of it. At most 10.
    static func spots(in caption: String) async -> [Spot] {
        var spots = pinned(in: caption)
        for spot in await modelSpots(in: caption) {
            // The same place from a 📍 line: keep that, filling in what the model adds.
            if let i = spots.firstIndex(where: { matches($0.name, [spot.name, spot.localName]) }) {
                if spots[i].localName.isEmpty { spots[i].localName = spot.localName }
                if spots[i].address.isEmpty { spots[i].address = spot.address }
                if spots[i].area.isEmpty { spots[i].area = spot.area }
            } else {
                spots.append(spot)
            }
        }
        return Array(spots.prefix(10))
    }

    /// 📍 lines name a place ("📍 Joe's Pizza, Greenwich Village") or give
    /// the address of the one named just above:
    ///
    ///     Sheng Yong Xing: $$$$
    ///     📍 Bund 5, No. 20 Guangdong Road, Huangpu District, Shanghai
    static func pinned(in caption: String) -> [Spot] {
        let lines = caption.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
        return lines.indices.compactMap { index in
            let line = lines[index]
            guard let pin = line.range(of: "📍") else { return nil }
            let text = line[pin.upperBound...]
                .replacingOccurrences(of: "@", with: "")
                .replacingOccurrences(of: "_", with: " ") // @lucali_bk → "lucali bk" for Maps
                .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters.subtracting(CharacterSet(charactersIn: "'&"))))
            guard !text.isEmpty else { return nil }
            let parts = text.split(separator: ",", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            let rest = parts.count > 1 ? parts[1] : ""
            // "Bund 5, No. 20 Guangdong Road, …" is an address; "Pizza 4P's, Hanoi" is a name.
            if looksLikeAddress(parts[0], numbersCount: false) || (looksLikeAddress(parts[0]) && looksLikeAddress(rest)) {
                guard let name = nameAbove(index, in: lines) else { return nil }
                return Spot(name: name, address: text)
            }
            return looksLikeAddress(rest) ? Spot(name: parts[0], address: rest) : Spot(name: parts[0], area: rest)
        }
    }

    /// A word streets have ("No. 20 Guangdong Road", "肇嘉浜路"), or with
    /// `numbersCount`, any number ("Bund 5").
    static func looksLikeAddress(_ text: String, numbersCount: Bool = true) -> Bool {
        guard !text.isEmpty else { return false }
        if numbersCount && text.contains(where: \.isNumber) { return true }
        if ["路", "号", "街", "区"].contains(where: { text.contains($0) }) { return true }
        let words = Set(text.lowercased().split { !$0.isLetter && $0 != "." }.map(String.init))
        return !words.isDisjoint(with: ["road", "rd", "rd.", "street", "st.", "avenue", "ave", "ave.", "blvd", "lane", "district", "no."])
    }

    /// The place a 📍 address belongs to: the nearest line above that isn't
    /// blank, a hashtag or another pin, up to its ":" or " - " ("Sheng Yong Xing: $$$$").
    private static func nameAbove(_ index: Int, in lines: [String]) -> String? {
        for line in lines[..<index].reversed() where !line.isEmpty {
            guard !line.contains("📍"), !line.hasPrefix("#") else { return nil }
            var name = line
            for separator in [":", " - ", " – ", " — ", " | "] {
                if let range = name.range(of: separator) { name = String(name[..<range.lowerBound]) }
            }
            name = name.filter { $0.isLetter || $0.isNumber || " '&.".contains($0) }.trimmingCharacters(in: .whitespaces)
            return name.isEmpty ? nil : name
        }
        return nil
    }

    private static func modelSpots(in caption: String) async -> [Spot] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), case .available = SystemLanguageModel.default.availability {
            let session = LanguageModelSession(instructions: """
                You read Instagram captions about food. List the restaurants, cafés, bars, bakeries and other \
                food spots the caption names. Only include places that are named; never guess. Copy names and \
                addresses exactly as written.
                """)
            if let response = try? await session.respond(to: caption, generating: CaptionSpots.self) {
                return response.content.spots.compactMap { spot in
                    let name = spot.name.replacingOccurrences(of: "@", with: "").trimmingCharacters(in: .whitespaces)
                    guard !name.isEmpty else { return nil }
                    return Spot(name: name, localName: spot.localName, address: spot.address, area: spot.area)
                }
            }
        }
        #endif
        return []
    }

    // MARK: Apple Maps

    /// Finds the place near where the caption says it is (its street
    /// address, else its city), and only accepts a result whose name looks
    /// like the caption's — an unrestricted search happily answers "Ren He
    /// Guan, Shanghai" with an airport in Russia. If the address is found but
    /// no matching place, the caption's name is pinned at the address.
    private static func lookUp(_ spot: Spot) async -> TripPlace? {
        var anchor: CLLocation?
        var region: MKCoordinateRegion?
        // Addresses often start with a building ("Bund 5, No. 20 Guangdong
        // Road, …") Maps doesn't know: drop leading parts until one is found.
        var parts = [spot.address, spot.area].joined(separator: ", ")
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !spot.address.isEmpty {
            while parts.count >= 2, anchor == nil {
                if let item = await search(parts.joined(separator: ", "), types: .address)?.mapItems.first {
                    anchor = item.location
                    region = MKCoordinateRegion(center: item.location.coordinate, latitudinalMeters: 3000, longitudinalMeters: 3000)
                } else {
                    parts.removeFirst()
                }
            }
        }
        // No street found: at least stay in its city ("Shanghai, China").
        let city = spot.area.isEmpty ? parts.suffix(2).joined(separator: ", ") : spot.area
        if region == nil, !city.isEmpty, let response = await search(city, types: [.address, .pointOfInterest]) {
            region = response.boundingRegion
        }

        let names = [spot.name, spot.localName].filter { !$0.isEmpty }
        for query in names {
            let items = await search(query, types: .pointOfInterest, in: region)?.mapItems ?? []
            if let item = items.first(where: { item in
                matches(item.name ?? "", names) || anchor.map { item.location.distance(from: $0) < 150 } == true
            }) {
                return place(item, fallbackName: spot.label)
            }
        }
        guard let anchor else { return nil }
        return TripPlace(name: spot.label, address: spot.address,
                         latitude: anchor.coordinate.latitude, longitude: anchor.coordinate.longitude, mapItemID: "")
    }

    private static func search(_ query: String, types: MKLocalSearch.ResultType, in region: MKCoordinateRegion? = nil) async -> MKLocalSearch.Response? {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = types
        if let region {
            request.region = region
            request.regionPriority = .required
        }
        return try? await MKLocalSearch(request: request).start()
    }

    private static func place(_ item: MKMapItem, fallbackName: String) -> TripPlace {
        let coordinate = item.location.coordinate
        return TripPlace(name: item.name ?? fallbackName,
                         address: item.address?.shortAddress ?? item.address?.fullAddress ?? "",
                         latitude: coordinate.latitude, longitude: coordinate.longitude,
                         mapItemID: item.identifier?.rawValue ?? "")
    }

    /// Whether a name from Apple Maps is plausibly one of the caption's:
    /// one contains the other ("人和馆(肇嘉浜路店)" ⊃ "人和馆"), or every
    /// distinctive word of the caption's name is there (at least two — one
    /// shared word let "Bund 5" match "The Westin Bund Center").
    static func matches(_ found: String, _ wanted: [String]) -> Bool {
        let squashed = squash(found)
        let words = Set(found.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init))
        return wanted.contains { name in
            let target = squash(name)
            guard !target.isEmpty, !squashed.isEmpty else { return false }
            // Two letters is enough for Chinese names (鼎泰), not much less.
            if min(squashed.count, target.count) >= 2, squashed.contains(target) || target.contains(squashed) { return true }
            let distinctive = name.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init)
                .filter { $0.count >= 4 && !genericWords.contains($0) }
            return distinctive.count >= 2 && distinctive.allSatisfy(words.contains)
        }
    }

    private static let genericWords: Set<String> = ["restaurant", "cafe", "café", "coffee", "kitchen", "house", "pizza", "sushi",
                                                    "ramen", "noodle", "noodles", "bakery", "grill", "dining", "food", "street"]

    private static func squash(_ name: String) -> String {
        name.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil).filter { $0.isLetter || $0.isNumber }
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
    @Guide(description: "The place's name as written in Latin letters, without @ or hashtags")
    var name: String
    @Guide(description: "The name in another script if the caption also gives it (e.g. Chinese or Japanese), or empty")
    var localName: String
    @Guide(description: "The street address the caption gives for it, or empty")
    var address: String
    @Guide(description: "The city or neighborhood the caption gives for it, or empty")
    var area: String
}
#endif

/// Shown when a shared reel reads as places (`SharedReelSheet`): the places
/// found in its caption, all ticked, to add to Want to try.
struct ReelImportSheet: View {
    let reel: SharedReel
    /// Already downloaded; nil when Instagram didn't share it.
    let caption: String?
    /// "It's a recipe": hands the reel to Recipes instead.
    let onRecipe: () -> Void

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
            }
            // Says where the places go, not just "Add".
            .safeAreaInset(edge: .bottom) {
                if result != nil {
                    Button { add() } label: {
                        Label(picked.count > 1 ? "Save \(picked.count) to Want to Try" : "Save to Want to Try", systemImage: "bookmark.fill")
                            .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent).tint(AppSpace.eats.tint)
                    .disabled(picked.isEmpty)
                    .padding(.horizontal, 20).padding(.bottom, 8)
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
                let looked = await ReelPlaces.look(at: caption)
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
                                if !found.fromCaption.isEmpty && found.fromCaption != found.place.name {
                                    Text("Caption: \(found.fromCaption)").font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(1)
                                }
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Button("Add a place by name", systemImage: "magnifyingglass") { searching = true }
            } header: {
                if !result.found.isEmpty { Text(result.found.count == 1 ? "Found in the caption" : "Found in the caption · tap to pick") }
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
                Button("It's a recipe — save it to Recipes", systemImage: AppSpace.recipes.systemImage, action: onRecipe)
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
