import Foundation
import Security

/// Stores the SimpleFIN access URL (which embeds bank credentials) in the
/// Keychain instead of SwiftData/UserDefaults, since it's a secret.
///
/// Saved as a synchronizable item, so it rides along in the user's iCloud
/// Keychain (end-to-end encrypted, like their saved passwords) and a new
/// iPhone on the same Apple ID is connected without a new setup token. If
/// iCloud Keychain is off, it simply stays on this device. It is never put in
/// SwiftData/CloudKit or anywhere Wooli could read it.
enum KeychainHelper {
    private static let service = "com.wooli.simplefin"

    private static func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    static func save(_ value: String, forKey key: String) {
        delete(forKey: key)
        var attributes = baseQuery(key)
        attributes[kSecValueData as String] = Data(value.utf8)
        // Synced items can't use a ...ThisDeviceOnly class.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        attributes[kSecAttrSynchronizable as String] = kCFBooleanTrue
        if SecItemAdd(attributes as CFDictionary, nil) != errSecSuccess {
            // Environments without iCloud Keychain support (e.g. an unsigned
            // Simulator build) reject synced items; keep a local copy instead.
            attributes[kSecAttrSynchronizable as String] = kCFBooleanFalse
            SecItemAdd(attributes as CFDictionary, nil)
        }
    }

    static func load(forKey key: String) -> String? {
        var query = baseQuery(key)
        query[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Removes the key everywhere: this device and, through iCloud Keychain,
    /// the user's other devices.
    static func delete(forKey key: String) {
        var query = baseQuery(key)
        query[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
        SecItemDelete(query as CFDictionary)
    }
}
