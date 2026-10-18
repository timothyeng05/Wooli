import SwiftUI
import SwiftData
import Photos
import PhotosUI
import AVKit

// A private journal per trip day: what you write, plus links to the photos
// and videos you starred. Media is never copied — only Photos identifiers
// are stored, and thumbnails are drawn from your library when shown. It's
// yours alone (SwiftData + your iCloud), even on a shared trip: the links
// point into your library, which trip mates can't see.

@Model
final class JournalEntry {
    var id: String = UUID().uuidString
    var tripID: String = ""
    /// "yyyy-MM-dd"
    var day: String = ""
    var text: String = ""
    /// Starred photos and videos, in the order starred: "cloud:<id>" with
    /// iCloud Photos (resolves on all your devices) or "local:<id>".
    var favorites: [String] = []
    var updatedAt: Date = Date.now

    init(tripID: String, day: String) {
        self.tripID = tripID
        self.day = day
    }
}

enum JournalPhotos {
    static var status: PHAuthorizationStatus { PHPhotoLibrary.authorizationStatus(for: .readWrite) }
    static var canRead: Bool { status == .authorized || status == .limited }

    static func requestAccess() async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        return status == .authorized || status == .limited
    }

    /// Photos and videos taken that day (phone's time zone), oldest first.
    static func assets(on day: String) -> [PHAsset] {
        let start = DayKey.date(day)
        guard canRead, let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else { return [] }
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate < %@ AND (mediaType == %d OR mediaType == %d)",
                                        start as NSDate, end as NSDate,
                                        PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue)
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        return fetchAll(PHAsset.fetchAssets(with: options))
    }

    /// The link to store for a photo: its iCloud Photos identifier when it has one.
    static func link(forLocalID localID: String) -> String {
        if case .success(let cloud)? = PHPhotoLibrary.shared().cloudIdentifierMappings(forLocalIdentifiers: [localID])[localID] {
            return "cloud:" + cloud.stringValue
        }
        return "local:" + localID
    }

    /// Each stored link's identifier on this device (links that no longer
    /// resolve — deleted photos — are left out).
    static func localIDs(for links: [String]) -> [String: String] {
        guard canRead else { return [:] }
        var result: [String: String] = [:]
        let clouds = links.filter { $0.hasPrefix("cloud:") }.map { PHCloudIdentifier(stringValue: String($0.dropFirst(6))) }
        if !clouds.isEmpty {
            for (cloud, mapped) in PHPhotoLibrary.shared().localIdentifierMappings(for: clouds) {
                if case .success(let local) = mapped { result["cloud:" + cloud.stringValue] = local }
            }
        }
        for link in links where link.hasPrefix("local:") { result[link] = String(link.dropFirst(6)) }
        return result
    }

    static func assets(localIDs: [String]) -> [PHAsset] {
        guard !localIDs.isEmpty else { return [] }
        let found = fetchAll(PHAsset.fetchAssets(withLocalIdentifiers: localIDs, options: nil))
        return localIDs.compactMap { id in found.first { $0.localIdentifier == id } }
    }

    private static func fetchAll(_ result: PHFetchResult<PHAsset>) -> [PHAsset] {
        var assets: [PHAsset] = []
        result.enumerateObjects { asset, _, _ in assets.append(asset) }
        return assets
    }
}

/// A photo or video in the journal, for `.fullScreenCover(item:)`.
struct JournalAsset: Identifiable {
    let asset: PHAsset
    var id: String { asset.localIdentifier }
}

/// A square thumbnail from the photo library, with a duration for videos.
struct PhotoThumb: View {
    let asset: PHAsset
    var size: CGFloat = 72
    @Environment(\.displayScale) private var displayScale
    @State private var image: UIImage?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Rectangle().fill(Theme.track)
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            }
            if asset.mediaType == .video {
                Text(Duration.seconds(asset.duration).formatted(.time(pattern: .minuteSecond)))
                    .font(.caption2.weight(.semibold)).monospacedDigit().foregroundStyle(.white)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(4)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .task(id: asset.localIdentifier) { image = await Self.load(asset, pixels: size * displayScale) }
        .accessibilityLabel(asset.mediaType == .video ? "Video" : "Photo")
    }

    static func load(_ asset: PHAsset, pixels: CGFloat) async -> UIImage? {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat // one callback, so the continuation resumes once
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true     // iCloud Photos originals
        return await withCheckedContinuation { continuation in
            PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: pixels, height: pixels),
                                                  contentMode: .aspectFill, options: options) { image, _ in
                continuation.resume(returning: image)
            }
        }
    }
}

// MARK: - On the day card

/// A past day's photos on its card: favorites first, then the day's first
/// shots. Opens the day's journal.
struct JournalStrip: View {
    let trip: Trip
    let day: String
    @Query private var entries: [JournalEntry]
    @State private var dayAssets: [PHAsset] = []
    @State private var favoriteAssets: [PHAsset] = []
    @State private var access = JournalPhotos.status

    private var entry: JournalEntry? { entries.first { $0.tripID == trip.id && $0.day == day } }

    var body: some View {
        Group {
            if access == .notDetermined {
                Button {
                    Task {
                        _ = await JournalPhotos.requestAccess()
                        access = JournalPhotos.status
                        reload()
                    }
                } label: {
                    Label("Add photos from this day", systemImage: "photo.on.rectangle.angled")
                        .font(.subheadline.weight(.medium))
                }
            } else {
                NavigationLink {
                    JournalDayView(trip: trip, day: day)
                } label: {
                    content
                }
                .buttonStyle(.plain)
            }
        }
        .task(id: "\(day)-\(entry?.favorites.count ?? 0)") { reload() }
    }

    private var content: some View {
        let shown = favoriteAssets + dayAssets.filter { a in !favoriteAssets.contains { $0.localIdentifier == a.localIdentifier } }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "book.closed.fill").foregroundStyle(Color(hex: "#a855f7"))
                Text("Journal").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                if !dayAssets.isEmpty {
                    Text("· \(dayAssets.count) \(dayAssets.count == 1 ? "photo" : "photos")")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Theme.textTertiary)
            }
            if !shown.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(shown.prefix(10), id: \.localIdentifier) { PhotoThumb(asset: $0, size: 64) }
                    }
                }
                .allowsHitTesting(false)
            }
            if let text = entry?.text, !text.isEmpty {
                Text(text).font(.footnote).italic().foregroundStyle(Theme.textSecondary).lineLimit(2)
            } else if shown.isEmpty {
                Text("Write about this day").font(.footnote).foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(12)
        .background(Theme.track.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .contentShape(Rectangle())
    }

    private func reload() {
        guard JournalPhotos.canRead else { return }
        dayAssets = JournalPhotos.assets(on: day)
        let links = entry?.favorites ?? []
        let ids = JournalPhotos.localIDs(for: links)
        favoriteAssets = JournalPhotos.assets(localIDs: links.compactMap { ids[$0] })
    }
}

// MARK: - A day's journal

struct JournalDayView: View {
    let trip: Trip
    let day: String
    @Environment(\.modelContext) private var context
    @Query private var entries: [JournalEntry]
    @State private var dayAssets: [PHAsset] = []
    @State private var favoriteAssets: [PHAsset] = []
    /// Favorite links by this device's identifier, to star/unstar.
    @State private var favoriteLinks: [String: String] = [:]
    @State private var picked: [PhotosPickerItem] = []
    @State private var viewing: JournalAsset?

    private var entry: JournalEntry? { entries.first { $0.tripID == trip.id && $0.day == day } }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 3)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                TextField("How was the day?", text: Binding(get: { entry?.text ?? "" }, set: { text in
                    let entry = ensureEntry()
                    entry.text = text
                    entry.updatedAt = .now
                }), axis: .vertical)
                .lineLimit(3...20)
                .padding(14)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border))

                if !JournalPhotos.canRead {
                    Label("Allow Wooli to read your photos in Settings to see this day's photos here. Nothing is copied — the journal only links to them.",
                          systemImage: "photo.badge.exclamationmark")
                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                }

                if !favoriteAssets.isEmpty {
                    section("Favorites", assets: favoriteAssets)
                }

                section(dayAssets.isEmpty ? "No photos from this day" : "From this day · \(dayAssets.count)", assets: dayAssets)

                PhotosPicker(selection: $picked, matching: .any(of: [.images, .videos]), photoLibrary: .shared()) {
                    Label("Add other photos", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(!JournalPhotos.canRead)

                Text("Your journal is private — trip mates don't see it. Photos stay in your library; deleting one there removes it here.")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            }
            .padding(16)
        }
        .pageBackground()
        .navigationTitle(DayKey.date(day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
        .navigationBarTitleDisplayMode(.inline)
        .task { reload() }
        .onChange(of: picked) { _, items in
            let ids = items.compactMap(\.itemIdentifier)
            guard !ids.isEmpty else { return }
            let entry = ensureEntry()
            for id in ids {
                let link = JournalPhotos.link(forLocalID: id)
                if !entry.favorites.contains(link) { entry.favorites.append(link) }
            }
            entry.updatedAt = .now
            picked = []
            reload()
        }
        .onDisappear { try? context.save() }
        .fullScreenCover(item: $viewing) { JournalViewer(asset: $0.asset) }
    }

    private func section(_ title: String, assets: [PHAsset]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline).foregroundStyle(Theme.text)
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(assets, id: \.localIdentifier) { asset in
                    GeometryReader { geo in
                        Button { viewing = JournalAsset(asset: asset) } label: {
                            PhotoThumb(asset: asset, size: geo.size.width)
                        }
                        .buttonStyle(.plain)
                        .overlay(alignment: .topTrailing) { star(asset) }
                    }
                    .aspectRatio(1, contentMode: .fit)
                }
            }
        }
    }

    private func star(_ asset: PHAsset) -> some View {
        let isFavorite = favoriteLinks[asset.localIdentifier] != nil
        return Button { toggleFavorite(asset) } label: {
            Image(systemName: isFavorite ? "star.fill" : "star")
                .font(.footnote.weight(.bold))
                .foregroundStyle(isFavorite ? Color(hex: "#facc15") : .white)
                .padding(6)
                .background(.black.opacity(0.35), in: Circle())
                .padding(5)
        }
        .accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
        .sensoryFeedback(.selection, trigger: isFavorite)
    }

    private func toggleFavorite(_ asset: PHAsset) {
        let entry = ensureEntry()
        if let link = favoriteLinks[asset.localIdentifier] {
            entry.favorites.removeAll { $0 == link }
        } else {
            entry.favorites.append(JournalPhotos.link(forLocalID: asset.localIdentifier))
        }
        entry.updatedAt = .now
        reload()
    }

    private func ensureEntry() -> JournalEntry {
        if let entry { return entry }
        let entry = JournalEntry(tripID: trip.id, day: day)
        context.insert(entry)
        return entry
    }

    private func reload() {
        dayAssets = JournalPhotos.assets(on: day)
        let links = entry?.favorites ?? []
        let ids = JournalPhotos.localIDs(for: links)
        favoriteLinks = Dictionary(ids.map { ($0.value, $0.key) }, uniquingKeysWith: { a, _ in a })
        favoriteAssets = JournalPhotos.assets(localIDs: links.compactMap { ids[$0] })
    }
}

/// Full screen: the photo, or the video playing.
struct JournalViewer: View {
    let asset: PHAsset
    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let player {
                VideoPlayer(player: player).ignoresSafeArea()
            } else if let image {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                ProgressView().tint(.white)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button("Close", systemImage: "xmark") { dismiss() }
                .labelStyle(.iconOnly)
                .font(.headline).foregroundStyle(.white)
                .padding(12).background(.ultraThinMaterial, in: Circle())
                .padding()
        }
        .task {
            if asset.mediaType == .video {
                let options = PHVideoRequestOptions()
                options.isNetworkAccessAllowed = true
                let item: AVPlayerItem? = await withCheckedContinuation { continuation in
                    PHImageManager.default().requestPlayerItem(forVideo: asset, options: options) { item, _ in
                        continuation.resume(returning: item)
                    }
                }
                if let item {
                    player = AVPlayer(playerItem: item)
                    player?.play()
                }
            } else {
                image = await PhotoThumb.load(asset, pixels: 2400)
            }
        }
        .onDisappear { player?.pause() }
    }
}
