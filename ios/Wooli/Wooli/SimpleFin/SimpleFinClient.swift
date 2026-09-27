import Foundation

/// Low-level SimpleFIN protocol client. Every secret (the access URL) lives
/// only in the user's Keychain (synced via their iCloud Keychain) -- there is
/// no Wooli server in this path.
/// Mirrors lib/budget/simplefin-client.ts in the web app.
enum SimpleFinError: Error, LocalizedError {
    case invalidSetupToken
    case claimFailed(Int)
    case emptyAccessURL
    case requestFailed(Int)
    case notConnected

    var errorDescription: String? {
        switch self {
        case .invalidSetupToken: return "That doesn't look like a valid SimpleFIN setup token."
        case .claimFailed(let code): return "SimpleFIN claim failed: HTTP \(code)"
        case .emptyAccessURL: return "SimpleFIN claim returned an empty access URL."
        case .requestFailed(let code): return "SimpleFIN request failed: HTTP \(code)"
        case .notConnected: return "No SimpleFIN account connected yet."
        }
    }
}

struct SimpleFinCredentials {
    let url: URL
    let authHeader: String
}

enum SimpleFinClient {
    /// Splits an access URL's embedded user:pass into an explicit Basic-Auth
    /// header. URLSession, like Node's fetch, is unreliable with userinfo
    /// embedded directly in a URL passed to a request.
    static func splitAccessURL(_ accessURL: String) throws -> SimpleFinCredentials {
        guard var components = URLComponents(string: accessURL),
              let user = components.user,
              let password = components.password else {
            throw SimpleFinError.invalidSetupToken
        }
        let authHeader = "Basic " + Data("\(user):\(password)".utf8).base64EncodedString()
        components.user = nil
        components.password = nil
        guard let cleanURL = components.url else { throw SimpleFinError.invalidSetupToken }
        return SimpleFinCredentials(url: cleanURL, authHeader: authHeader)
    }

    /// One-time exchange: POST the claim URL (base64-decoded from the setup
    /// token) to get the long-lived access URL. Succeeds only once per token.
    static func claimSetupToken(_ setupToken: String) async throws -> String {
        guard let claimData = Data(base64Encoded: setupToken),
              let claimURLString = String(data: claimData, encoding: .utf8),
              let claimURL = URL(string: claimURLString) else {
            throw SimpleFinError.invalidSetupToken
        }
        var request = URLRequest(url: claimURL)
        request.httpMethod = "POST"
        request.httpBody = Data()
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SimpleFinError.claimFailed((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        guard let accessURL = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines), !accessURL.isEmpty else {
            throw SimpleFinError.emptyAccessURL
        }
        return accessURL
    }

    struct FetchOptions {
        var startDate: Date?
        var pending: Bool = false
    }

    static func fetchAccounts(accessURL: String, options: FetchOptions = FetchOptions()) async throws -> SimpleFinAccountsResponse {
        let credentials = try splitAccessURL(accessURL)
        let base = credentials.url.absoluteString.hasSuffix("/")
            ? String(credentials.url.absoluteString.dropLast())
            : credentials.url.absoluteString
        var components = URLComponents(string: base + "/accounts")!

        var query: [URLQueryItem] = []
        if let startDate = options.startDate {
            query.append(URLQueryItem(name: "start-date", value: String(Int(startDate.timeIntervalSince1970))))
        }
        if options.pending {
            query.append(URLQueryItem(name: "pending", value: "1"))
        }
        components.queryItems = query.isEmpty ? nil : query

        var request = URLRequest(url: components.url!)
        request.setValue(credentials.authHeader, forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SimpleFinError.requestFailed((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(SimpleFinAccountsResponse.self, from: data)
    }
}
