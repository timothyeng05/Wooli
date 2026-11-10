import SwiftUI
import MapKit

// Pieces shared by the Beli-style place pages (Eats places, trip activities
// and stays): a map across the top, a row of action pills, and list rows.

/// The place's pin on a map across the top of the page, fading into it so
/// the name can sit over the bottom edge. Tapping opens Apple's place card.
struct PlaceHeroMap: View {
    let coordinate: CLLocationCoordinate2D?
    let name: String
    var tint: Color = .red
    var onTap: (() -> Void)?

    static let height: CGFloat = 280
    /// How far the title should overlap the map's faded bottom.
    static let titleOverlap: CGFloat = 44

    var body: some View {
        if let coordinate {
            Map(initialPosition: .camera(MapCamera(centerCoordinate: coordinate, distance: 1600)), interactionModes: []) {
                Marker(name, coordinate: coordinate).tint(tint)
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .allowsHitTesting(false)
            .frame(height: Self.height)
            .overlay(alignment: .bottom) {
                LinearGradient(colors: [Theme.card.opacity(0), Theme.card], startPoint: .top, endPoint: .bottom)
                    .frame(height: 110)
            }
            .contentShape(Rectangle())
            .onTapGesture { onTap?() }
        } else {
            Color.clear.frame(height: 110)
        }
    }
}

/// Website, call, directions and photos — from Apple's listing when there
/// is one — plus Google Maps.
struct PlaceActionBar: View {
    let place: TripPlace?
    let mapItem: MKMapItem?
    let onPhotos: () -> Void
    @Environment(\.openURL) private var openURL

    /// Eats' action colour: Wooli blue, like every other button in the app.
    static let ink = Theme.brand

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                if let url = mapItem?.url { pill("Website", systemImage: "globe") { openURL(url) } }
                if let phone = mapItem?.phoneNumber, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    pill("Call", systemImage: "phone.fill") { openURL(url) }
                }
                if let mapItem {
                    pill("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill") {
                        mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault])
                    }
                    pill("Photos & info", systemImage: "photo.on.rectangle", action: onPhotos)
                } else if let url = place?.mapsURL {
                    pill("Apple Maps", systemImage: "map.fill") { openURL(url) }
                }
                if let url = place?.googleMapsURL { pill("Google Maps", systemImage: "g.circle.fill") { openURL(url) } }
            }
        }
        .scrollClipDisabled()
    }

    private func pill(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold)).foregroundStyle(Self.ink)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .overlay(Capsule().strokeBorder(Self.ink, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }
}

/// A list row with an icon on the left and a divider below, like Beli's
/// "Your notes and photos".
struct PlaceDetailRow<Content: View>: View {
    let systemImage: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Image(systemName: systemImage).font(.title3).foregroundStyle(Theme.textSecondary).frame(width: 28)
                content.font(.body)
            }
            .padding(.vertical, 14)
            Divider()
        }
    }
}

/// A row that opens something: a title, an optional detail line, a chevron.
struct PlaceDetailLink: View {
    let title: String
    var detail: String = ""
    var role: ButtonRole?
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundStyle(role == .destructive ? Color.red : Theme.text)
                    if !detail.isEmpty {
                        Text(detail).font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                if role != .destructive {
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
