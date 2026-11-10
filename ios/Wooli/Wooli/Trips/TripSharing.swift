import CloudKit
#if os(iOS)
import UIKit

/// Apple's share sheet for a trip or an Eats list: invite people through
/// Messages, Mail or a link, choose permissions, and see or remove
/// participants. Presented from UIKit — `UICloudSharingController`
/// misbehaves inside a SwiftUI sheet.
@MainActor
enum TripSharingPresenter {
    /// The controller only holds its delegate weakly.
    private static var delegate: Delegate?

    static func present(share: CKShare, container: CKContainer, trip: Trip) {
        let tripID = trip.id
        present(share: share, container: container, title: trip.name,
                permissions: [.allowReadWrite, .allowReadOnly, .allowPrivate, .allowPublic]) {
            TripStore.shared.setShared(false, tripID: tripID)
        }
    }

    static func present(share: CKShare, container: CKContainer, title: String,
                        permissions: UICloudSharingController.PermissionOptions,
                        onStopSharing: @escaping @MainActor () -> Void) {
        let controller = UICloudSharingController(share: share, container: container)
        controller.availablePermissions = permissions
        let delegate = Delegate(title: title, onStopSharing: onStopSharing)
        self.delegate = delegate
        controller.delegate = delegate

        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        guard var top = scene?.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        top.present(controller, animated: true)
    }

    final class Delegate: NSObject, UICloudSharingControllerDelegate {
        let title: String
        let onStopSharing: @MainActor () -> Void

        init(title: String, onStopSharing: @escaping @MainActor () -> Void) {
            self.title = title
            self.onStopSharing = onStopSharing
        }

        func itemTitle(for csc: UICloudSharingController) -> String? { title }

        func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {
            Task { @MainActor in TripStore.shared.lastError = "Couldn't update sharing: \(error.localizedDescription)" }
        }

        func cloudSharingControllerDidStopSharing(_ csc: UICloudSharingController) {
            let onStopSharing = onStopSharing
            Task { @MainActor in onStopSharing() }
        }
    }
}

// MARK: - Accepting invites

/// Tapping an iCloud share link opens Wooli (Info.plist `CKSharingSupported`)
/// and iOS hands the invite to the scene delegate. SwiftUI apps only get a
/// scene delegate through the app delegate, hence both.
final class WooliAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        configuration.delegateClass = WooliSceneDelegate.self
        return configuration
    }
}

final class WooliSceneDelegate: NSObject, UIWindowSceneDelegate {
    // The link was tapped while Wooli wasn't running.
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // The waving sheep, above the app, on a cold launch.
        if let windowScene = scene as? UIWindowScene { MainActor.assumeIsolated { SplashWindow.show(in: windowScene) } }
        if let metadata = connectionOptions.cloudKitShareMetadata { accept(metadata) }
    }

    func windowScene(_ windowScene: UIWindowScene, userDidAcceptCloudKitShareWith cloudKitShareMetadata: CKShare.Metadata) {
        accept(cloudKitShareMetadata)
    }

    private func accept(_ metadata: CKShare.Metadata) {
        Task { @MainActor in
            TripStore.shared.start()
            await TripStore.shared.accept(metadata)
        }
    }
}
#else
import AppKit

/// Mac: the system's iCloud sharing panel, through `NSSharingService`.
@MainActor
enum TripSharingPresenter {
    struct PermissionOptions: OptionSet {
        let rawValue: Int
        static let allowReadWrite = PermissionOptions(rawValue: 1 << 0)
        static let allowReadOnly = PermissionOptions(rawValue: 1 << 1)
        static let allowPrivate = PermissionOptions(rawValue: 1 << 2)
        static let allowPublic = PermissionOptions(rawValue: 1 << 3)

        var cloudKit: CKAllowedSharingOptions {
            var participant: CKSharingParticipantAccessOption = []
            if contains(.allowPrivate) { participant.insert(.specifiedRecipientsOnly) }
            if contains(.allowPublic) { participant.insert(.anyoneWithLink) }
            var permission: CKSharingParticipantPermissionOption = []
            if contains(.allowReadWrite) { permission.insert(.readWrite) }
            if contains(.allowReadOnly) { permission.insert(.readOnly) }
            return CKAllowedSharingOptions(allowedParticipantPermissionOptions: permission,
                                           allowedParticipantAccessOptions: participant)
        }
    }

    private static var delegate: Delegate?

    static func present(share: CKShare, container: CKContainer, trip: Trip) {
        let tripID = trip.id
        present(share: share, container: container, title: trip.name,
                permissions: [.allowReadWrite, .allowReadOnly, .allowPrivate, .allowPublic]) {
            TripStore.shared.setShared(false, tripID: tripID)
        }
    }

    static func present(share: CKShare, container: CKContainer, title: String,
                        permissions: PermissionOptions,
                        onStopSharing: @escaping @MainActor () -> Void) {
        share[CKShare.SystemFieldKey.title] = title
        let provider = NSItemProvider()
        provider.registerCKShare(share, container: container, allowedSharingOptions: permissions.cloudKit)
        guard let service = NSSharingService(named: .cloudSharing) else { return }
        let delegate = Delegate(onStopSharing: onStopSharing)
        self.delegate = delegate
        service.delegate = delegate
        service.perform(withItems: [provider])
    }

    final class Delegate: NSObject, NSSharingServiceDelegate, NSCloudSharingServiceDelegate {
        let onStopSharing: @MainActor () -> Void
        init(onStopSharing: @escaping @MainActor () -> Void) { self.onStopSharing = onStopSharing }

        func sharingService(_ sharingService: NSSharingService, didFailToShareItems items: [Any], error: Error) {
            Task { @MainActor in TripStore.shared.lastError = "Couldn't update sharing: \(error.localizedDescription)" }
        }

        func sharingService(_ sharingService: NSSharingService, didSave share: CKShare) {}

        func sharingService(_ sharingService: NSSharingService, didStopSharing share: CKShare) {
            let onStopSharing = onStopSharing
            Task { @MainActor in onStopSharing() }
        }
    }
}

// MARK: - Accepting invites

/// Mac: clicking an iCloud share link opens Wooli and AppKit hands over the invite.
final class WooliAppDelegate: NSObject, NSApplicationDelegate {
    func application(_ application: NSApplication, userDidAcceptCloudKitShareWith metadata: CKShare.Metadata) {
        Task { @MainActor in
            TripStore.shared.start()
            await TripStore.shared.accept(metadata)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
#endif
