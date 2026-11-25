#if DEBUG && os(macOS)
import CoreData
import SwiftData

/// `--init-cloudkit-schema` (debug, Mac): pushes every model's record type to
/// the CloudKit **Development** environment so it can be deployed to
/// Production in the CloudKit Console. Uses a throwaway local store, so the
/// real one is never opened, then quits. Run it from a build whose
/// `icloud-container-environment` entitlement is Development.
enum CloudKitSchemaInit {
    static func run() -> Never {
        guard let model = NSManagedObjectModel.makeManagedObjectModel(for: WooliApp.modelTypes) else {
            print("schema-init: could not build the Core Data model")
            exit(1)
        }
        let url = URL.temporaryDirectory.appending(path: "wooli-schema-init-\(UUID().uuidString).sqlite")
        let description = NSPersistentStoreDescription(url: url)
        description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.timothyeng.wooli")
        description.shouldAddStoreAsynchronously = false
        let container = NSPersistentCloudKitContainer(name: "WooliSchemaInit", managedObjectModel: model)
        container.persistentStoreDescriptions = [description]
        var loadError: Error?
        container.loadPersistentStores { _, error in loadError = error }
        if let loadError {
            print("schema-init: store failed to load: \(loadError)")
            exit(1)
        }
        do {
            try container.initializeCloudKitSchema(options: [])
            print("schema-init: done — record types are in the Development environment")
            exit(0)
        } catch {
            print("schema-init: failed: \(error)")
            exit(1)
        }
    }
}
#endif
