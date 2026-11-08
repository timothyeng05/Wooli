import SwiftUI
import CloudKit
import Observation

/// Who's who on shared trips and the shared Eats list, so a place can say
/// who added it. Every CloudKit record carries its creator; names come from
/// the participants of the shares as they sync. Kept per device.
@MainActor
@Observable
final class People {
    static let shared = People()

    /// User record name → first name.
    private(set) var names: [String: String]
    /// Your own user record name (CloudKit says `__defaultOwner__` in your zones).
    private(set) var myID: String?

    private static let namesKey = "people.names"
    private static let myIDKey = "people.myID"

    private init() {
        names = UserDefaults.standard.dictionary(forKey: Self.namesKey) as? [String: String] ?? [:]
        myID = UserDefaults.standard.string(forKey: Self.myIDKey)
    }

    func learnMyID(from container: CKContainer) async {
        guard let id = try? await container.userRecordID().recordName, id != myID else { return }
        myID = id
        UserDefaults.standard.set(id, forKey: Self.myIDKey)
    }

    /// Picks up names from a share's owner and participants.
    func learn(from share: CKShare) {
        var learned = names
        for participant in share.participants {
            guard let id = participant.userIdentity.userRecordID?.recordName, id != CKCurrentUserDefaultName,
                  let name = participant.userIdentity.nameComponents?.formatted(.name(style: .short)), !name.isEmpty else { continue }
            learned[id] = name
        }
        if learned != names {
            names = learned
            UserDefaults.standard.set(learned, forKey: Self.namesKey)
        }
        if let me = share.currentUserParticipant?.userIdentity.userRecordID?.recordName,
           me != CKCurrentUserDefaultName, me != myID {
            myID = me
            UserDefaults.standard.set(me, forKey: Self.myIDKey)
        }
    }

    /// The first name of whoever created a record, unless it was you (or
    /// they're not known yet).
    func addedBy(_ creatorID: String?) -> String? {
        guard let creatorID, creatorID != CKCurrentUserDefaultName, creatorID != myID else { return nil }
        return names[creatorID]
    }
}

/// "Added by Alex" on a place someone else put on a shared list; nothing for yours.
struct AddedByLabel: View {
    let creatorID: String?

    var body: some View {
        if let name = People.shared.addedBy(creatorID) {
            Label("Added by \(name)", systemImage: "person.crop.circle")
                .labelStyle(.titleAndIcon).imageScale(.small)
                .font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(1)
        }
    }
}
