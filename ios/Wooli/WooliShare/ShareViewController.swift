import UIKit
import SwiftUI

/// Wooli in the share sheet: shows the place shared from Apple Maps and
/// hands it to the app (via the App Group) for Eats, Sights or a trip's Ideas. An
/// Instagram reel goes straight to the app, which works out from the caption
/// whether it's a recipe or places to eat.
final class ShareViewController: UIViewController {
    private let model = ShareModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.onCancel = { [weak self] in
            self?.extensionContext?.cancelRequest(withError: CocoaError(.userCancelled))
        }
        model.onSaved = { [weak self] in
            self?.openApp()
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
        let host = UIHostingController(rootView: ShareView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)

        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        Task { await model.load(items) }
    }

    /// Extensions can't call `UIApplication.open` directly, but the
    /// application object is on the responder chain; going through the
    /// runtime is the usual way share extensions open their app. If it
    /// fails, the place still waits in the inbox for the next launch.
    private func openApp() {
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        var responder: UIResponder? = self
        while let current = responder {
            if current is UIApplication, let method = current.method(for: selector) {
                typealias Open = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
                unsafeBitCast(method, to: Open.self)(current, selector, SharedPlaceHandoff.openURL as NSURL, NSDictionary(), nil)
                return
            }
            responder = current.next
        }
    }
}

@MainActor
@Observable
final class ShareModel {
    enum State {
        case loading, ready(SharedPlace), notAPlace, saveFailed
    }

    var state: State = .loading
    var onCancel: () -> Void = {}
    var onSaved: () -> Void = {}

    func load(_ items: [NSExtensionItem]) async {
        if let place = await PlaceResolver.resolve(items) {
            state = .ready(place)
        } else if let link = await PlaceResolver.instagramLink(in: items) {
            // Nothing to ask: the app reads the caption.
            send(reel: link)
        } else {
            state = .notAPlace
        }
    }

    func send(_ place: SharedPlace, to destination: SharedPlace.Destination) {
        var place = place
        place.destination = destination
        if SharedPlaceHandoff.add(place) { onSaved() } else { state = .saveFailed }
    }

    func send(reel url: URL) {
        if SharedPlaceHandoff.add(SharedReel(url: url)) { onSaved() } else { state = .saveFailed }
    }
}

struct ShareView: View {
    let model: ShareModel
    private let orange = Color(red: 0.976, green: 0.451, blue: 0.086)
    private let violet = Color(red: 0.486, green: 0.227, blue: 0.929)

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                switch model.state {
                case .loading:
                    ProgressView("Finding the place…").frame(maxHeight: .infinity)
                case .ready(let place):
                    ready(place)
                case .notAPlace:
                    message("No place here", detail: "Share a place from Apple Maps, or an Instagram reel, to add it to Eats, Sights, a trip or Recipes.")
                case .saveFailed:
                    message("Couldn't hand this to Wooli", detail: "Open Wooli once, then try sharing again.")
                }
            }
            .padding(20)
            .navigationTitle("Wooli")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { model.onCancel() } }
            }
        }
    }

    private func ready(_ place: SharedPlace) -> some View {
        VStack(spacing: 20) {
            VStack(spacing: 6) {
                Image(systemName: place.isFood ? "fork.knife" : "mappin")
                    .font(.title2.weight(.bold)).foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(orange.gradient, in: Circle())
                Text(place.name).font(.title3.weight(.bold)).multilineTextAlignment(.center)
                if !place.address.isEmpty {
                    Text(place.address).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
            }
            .padding(.top, 8)
            Spacer(minLength: 0)
            VStack(spacing: 10) {
                // A restaurant leads with Eats; anything else leads with Sights.
                if place.isFood {
                    action("I've been — rank it", systemImage: "fork.knife", tint: orange, prominent: true) { model.send(place, to: .eats) }
                    action("Want to try", systemImage: "bookmark", tint: orange, prominent: false) { model.send(place, to: .eatsWishlist) }
                    action("Save to Sights", systemImage: "mappin.and.ellipse", tint: violet, prominent: false) { model.send(place, to: .sights) }
                } else {
                    action("Save to Sights", systemImage: "mappin.and.ellipse", tint: violet, prominent: true) { model.send(place, to: .sights) }
                    action("I've been — rank it in Eats", systemImage: "fork.knife", tint: orange, prominent: false) { model.send(place, to: .eats) }
                    action("Want to try in Eats", systemImage: "bookmark", tint: orange, prominent: false) { model.send(place, to: .eatsWishlist) }
                }
                Button { model.send(place, to: .tripIdeas) } label: {
                    Label("Add to a trip's Ideas", systemImage: "airplane").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder
    private func action(_ title: String, systemImage: String, tint: Color, prominent: Bool, run: @escaping () -> Void) -> some View {
        let label = Label(title, systemImage: systemImage).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
        if prominent {
            Button(action: run) { label }.buttonStyle(.borderedProminent).tint(tint)
        } else {
            Button(action: run) { label }.buttonStyle(.bordered).tint(tint)
        }
    }

    private func message(_ title: String, detail: String) -> some View {
        VStack(spacing: 8) {
            Text(title).font(.headline)
            Text(detail).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxHeight: .infinity)
    }
}
