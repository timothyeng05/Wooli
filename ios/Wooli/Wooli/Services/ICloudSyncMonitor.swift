import CloudKit
import CoreData
import Foundation
import Observation
import SwiftUI
import os.log

private let logger = Logger(subsystem: "com.timothyeng.wooli", category: "iCloudSync")

@MainActor
@Observable
final class ICloudSyncMonitor {
    static let shared = ICloudSyncMonitor()

    enum SyncState: Equatable {
        case checking
        case notSignedIn
        case restricted
        case syncing
        case upToDate
        case error(String)
    }

    var state: SyncState = .checking
    var isSyncing: Bool = false
    var lastSyncAt: Date?
    var lastError: String?
    var accountStatus: CKAccountStatus = .couldNotDetermine

    private let containerIdentifier = "iCloud.com.timothyeng.wooli"
    private static let lastSyncKey = "wooli.icloud.lastSyncAt"

    private init() {
        if let saved = UserDefaults.standard.object(forKey: Self.lastSyncKey) as? Date {
            self.lastSyncAt = saved
            self.state = .upToDate
        }
        setupNotificationObserver()
        Task { await checkAccountStatus() }
    }

    func checkAccountStatus() async {
        guard !LaunchFlags.localStore else { return }
        state = .checking
        let container = CKContainer(identifier: containerIdentifier)
        do {
            let status = try await container.accountStatus()
            self.accountStatus = status
            switch status {
            case .available:
                self.lastError = nil
                self.state = lastSyncAt != nil ? .upToDate : .checking
            case .noAccount:
                self.state = .notSignedIn
                self.lastError = "No Apple Account signed into iCloud in Settings."
            case .restricted:
                self.state = .restricted
                self.lastError = "iCloud access is restricted (e.g. Screen Time / MDM)."
            case .couldNotDetermine:
                self.state = .checking
                self.lastError = "Could not determine iCloud account status."
            case .temporarilyUnavailable:
                self.state = .checking
                self.lastError = "iCloud temporarily unavailable. Please try again later."
            @unknown default:
                break
            }
        } catch {
            let desc = Self.unpackError(error)
            self.lastError = desc
            self.state = .error(desc)
        }
    }

    private func setupNotificationObserver() {
        NotificationCenter.default.addObserver(
            forName: NSPersistentCloudKitContainer.eventChangedNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated {
                guard let self else { return }
                guard let event = note.userInfo?[NSPersistentCloudKitContainer.eventNotificationUserInfoKey]
                        as? NSPersistentCloudKitContainer.Event else { return }

                if event.endDate == nil {
                    // Event is currently running
                    self.isSyncing = true
                    self.state = .syncing
                } else {
                    // Event completed
                    self.isSyncing = false
                    if event.succeeded {
                        let now = Date.now
                        self.lastSyncAt = now
                        UserDefaults.standard.set(now, forKey: Self.lastSyncKey)
                        self.lastError = nil
                        self.state = .upToDate
                        logger.info("iCloud sync event \(String(describing: event.type)) succeeded")
                    } else if event.error != nil {
                        let desc = Self.detailedDescription(for: event)
                        logger.error("iCloud sync event error: \(desc)")
                        self.lastError = desc
                        self.state = .error(desc)
                    }
                }
            }
        }
    }

    private static func detailedDescription(for event: NSPersistentCloudKitContainer.Event) -> String {
        let typeName: String
        switch event.type {
        case .setup: typeName = "Setup"
        case .import: typeName = "Import"
        case .export: typeName = "Export"
        @unknown default: typeName = "Sync"
        }
        guard let error = event.error else { return "\(typeName) succeeded" }
        return "[\(typeName)] \(unpackError(error))"
    }

    private static func unpackError(_ error: Error) -> String {
        let ns = error as NSError
        if ns.domain == CKErrorDomain {
            if let ckCode = CKError.Code(rawValue: ns.code) {
                switch ckCode {
                case .partialFailure:
                    if let partials = ns.userInfo[CKPartialErrorsByItemIDKey] as? [AnyHashable: Error], !partials.isEmpty {
                        let lines = partials.map { key, subError in
                            let keyName = (key as? CKRecord.ID)?.recordName ?? "\(key)"
                            let subNs = subError as NSError
                            let codeName = (CKError.Code(rawValue: subNs.code)).map { "\($0)" } ?? "\(subNs.code)"
                            return "\(keyName): \(codeName) (\(subNs.localizedDescription))"
                        }
                        return lines.joined(separator: "\n")
                    }
                    return "Partial failure (CloudKit retrying automatically)"
                case .networkUnavailable, .networkFailure:
                    return "Network unavailable"
                case .notAuthenticated:
                    return "iCloud account not signed in"
                case .quotaExceeded:
                    return "iCloud storage is full"
                case .zoneNotFound:
                    return "Database zone initializing or not found"
                case .userDeletedZone:
                    return "Database zone was deleted"
                case .changeTokenExpired:
                    return "Sync token expired (re-fetching)"
                case .serverRecordChanged:
                    return "Conflict detected (merging automatically)"
                case .serviceUnavailable, .requestRateLimited:
                    return "Apple iCloud servers busy (retrying)"
                case .badDatabase:
                    return "Bad database configuration"
                case .incompatibleVersion:
                    return "Incompatible schema version"
                case .permissionFailure:
                    return "Permission failure (check iCloud permissions)"
                default:
                    return "\(error.localizedDescription) (CKError \(ckCode.rawValue))"
                }
            }
        }
        return error.localizedDescription
    }

    var iconName: String {
        switch state {
        case .checking:
            return "icloud"
        case .notSignedIn:
            return "icloud.slash"
        case .restricted:
            return "lock.icloud"
        case .syncing:
            return "icloud.and.arrow.up"
        case .upToDate:
            return "checkmark.icloud"
        case .error:
            return "exclamationmark.icloud"
        }
    }

    var statusColor: Color {
        switch state {
        case .checking:
            return .secondary
        case .notSignedIn:
            return .orange
        case .restricted:
            return .red
        case .syncing:
            return .accentColor
        case .upToDate:
            return .secondary
        case .error:
            return .red
        }
    }

    var shortLabel: String {
        switch state {
        case .checking:
            return "iCloud: Checking…"
        case .notSignedIn:
            return "iCloud: Not signed in"
        case .restricted:
            return "iCloud: Restricted"
        case .syncing:
            return "iCloud: Syncing…"
        case .upToDate:
            if let last = lastSyncAt {
                return "iCloud: \(last.formatted(.relative(presentation: .named)))"
            }
            return "iCloud: Up to date"
        case .error:
            return "iCloud: Sync issue"
        }
    }
}
