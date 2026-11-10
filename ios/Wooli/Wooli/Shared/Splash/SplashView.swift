#if os(iOS)
import ImageIO
import SwiftUI

/// The waving sheep shown on a cold launch, between the static launch screen
/// and the app.
///
/// The launch screen (`UILaunchScreen` in Info.plist) is the clip's first frame
/// (`LaunchSheep`, 320 pt square) centred on `LaunchBackground`, the clip's own
/// blue. This view draws the clip at the same size and spot, so the sheep simply
/// starts waving, then fades into the app. Tap to skip. With Reduce Motion it
/// holds the still frame for a moment instead of playing. If the clip hasn't
/// started within `startTimeout`, the app opens rather than keep anyone waiting.
///
/// It runs in its own window above the app (`SplashWindow`), so sheets the app
/// opens at launch (onboarding, "Welcome to Today") stay underneath it.
struct SplashView: View {
    /// Called once the clip has finished (or been skipped).
    var onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var finished = false

    /// Matches the launch image's size in points (960 px @3x).
    static let side: CGFloat = 320
    static let startTimeout: Duration = .seconds(1.2)

    var body: some View {
        ZStack {
            Color("LaunchBackground")
            // The still sits under the player so nothing flashes before the first frame.
            Image("LaunchSheep")
                .resizable()
                .frame(width: Self.side, height: Self.side)
            if !reduceMotion {
                SplashPlayer(onStart: started, onEnd: finish)
                    .frame(width: Self.side, height: Self.side)
            }
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture(perform: finish)
        .accessibilityElement()
        .accessibilityLabel("Wooli")
        .accessibilityAddTraits(.isImage)
        .task {
            try? await Task.sleep(for: reduceMotion ? .seconds(0.6) : Self.startTimeout)
            if reduceMotion || !playing { finish() }
        }
    }

    @State private var playing = false

    private func started() {
        guard !playing else { return }
        playing = true
        // Safety net in case the end-of-clip notice never comes (the clip is 1.75 s).
        Task {
            try? await Task.sleep(for: .seconds(2.5))
            finish()
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onFinish()
    }

    /// Whether to show the splash on this launch: skipped while unit tests run
    /// and, in DEBUG, with `-noSplash` (for scripted screenshots).
    static var isEnabled: Bool {
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil { return false }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-noSplash") { return false }
        #endif
        return Bundle.main.url(forResource: "WooliSplash", withExtension: "heics") != nil
    }
}

/// A window above the app's own that shows `SplashView`, then fades out and goes away.
@MainActor
enum SplashWindow {
    private static var window: UIWindow?

    /// Call from the scene delegate's `willConnectTo`, before the app draws its first frame.
    static func show(in scene: UIWindowScene) {
        guard SplashView.isEnabled, window == nil else { return }
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.backgroundColor = .clear
        let host = UIHostingController(rootView: SplashView { dismiss() })
        host.view.backgroundColor = .clear
        window.rootViewController = host
        window.isHidden = false
        self.window = window
    }

    private static func dismiss() {
        guard let window else { return }
        UIView.animate(withDuration: 0.35, delay: 0, options: .curveEaseOut) {
            window.alpha = 0
        } completion: { _ in
            window.isHidden = true
            self.window = nil
        }
    }
}

/// Plays `WooliSplash.heics` (an animated HEIC, 42 frames at 24 fps) once.
/// ImageIO decodes each frame as it's due, so it starts at once and keeps
/// memory low; a video player can take seconds to warm up on first launch.
private struct SplashPlayer: UIViewRepresentable {
    var onStart: () -> Void
    var onEnd: () -> Void

    func makeUIView(context: Context) -> UIImageView {
        let view = UIImageView()
        view.backgroundColor = .clear
        view.contentMode = .scaleAspectFit
        view.clipsToBounds = true
        // Size comes from SwiftUI's frame, not the frames' 960 px.
        for axis in [NSLayoutConstraint.Axis.horizontal, .vertical] {
            view.setContentHuggingPriority(.defaultLow, for: axis)
            view.setContentCompressionResistancePriority(.defaultLow, for: axis)
        }
        guard let url = Bundle.main.url(forResource: "WooliSplash", withExtension: "heics"),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return view }
        let last = CGImageSourceGetCount(source) - 1
        let coordinator = context.coordinator
        let status = CGAnimateImageAtURLWithBlock(url as CFURL, nil) { index, image, stop in
            guard !coordinator.stopped else { stop.pointee = true; return }
            view.image = UIImage(cgImage: image)
            if index == 0 { onStart() }
            if index >= last {
                stop.pointee = true
                // Let the last frame show for its 1/24 s before finishing.
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0 / 24) { onEnd() }
            }
        }
        if status != noErr { onEnd() }
        return view
    }

    func updateUIView(_ uiView: UIImageView, context: Context) {}

    static func dismantleUIView(_ uiView: UIImageView, coordinator: Coordinator) {
        coordinator.stopped = true
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var stopped = false
    }
}

#Preview {
    SplashView {}
}
#endif
