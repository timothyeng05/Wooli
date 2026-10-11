import UIKit
import CloudKit

/// Apple's share sheet for a trip: invite people through Messages, Mail or
/// a link, choose who can edit, and see or remove participants. Presented
/// from UIKit — `UICloudSharingController` misbehaves inside a SwiftUI sheet.
@MainActor
enum TripSharingPresenter {
    /// The controller only holds its delegate weakly.
    private static var delegate: Delegate?

    static func present(share: CKShare, container: CKContainer, trip: Trip) {
        let controller = UICloudSharingController(share: share, container: container)
        controller.availablePermissions = [.allowReadWrite, .allowReadOnly, .allowPrivate, .allowPublic]
        let delegate = Delegate(tripID: trip.id, tripName: trip.name)
        self.delegate = delegate
        controller.delegate = delegate

        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        guard var top = scene?.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController { top = presented }
        top.present(controller, animated: true)
    }

    final class Delegate: NSObject, UICloudSharingControllerDelegate {
        let tripID: String
        let tripName: String

        init(tripID: String, tripName: String) {
            self.tripID = tripID
            self.tripName = tripName
        }

        func itemTitle(for csc: UICloudSharingController) -> String? { tripName }

        func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {
            Task { @MainActor in TripStore.shared.lastError = "Couldn't update sharing: \(error.localizedDescription)" }
        }

        func cloudSharingControllerDidStopSharing(_ csc: UICloudSharingController) {
            let tripID = tripID
            Task { @MainActor in TripStore.shared.setShared(false, tripID: tripID) }
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
