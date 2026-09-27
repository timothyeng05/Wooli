import Foundation

/// Port of the web app's `lib/budget/categorize/normalize-merchant.ts`.
///
/// Bank merchant strings are noisy: "SQ *BLUE BOTTLE COFFEE 0123 NEW YORK NY",
/// "TST* JOE'S PIZZA", "POS DEBIT 04/12 WHOLEFDS NYC". Strip the noise so the
/// same real-world merchant collapses to one stable key that merchant rules can
/// match on, while keeping the brand words.
enum MerchantNormalizer {
    private static let processorPrefixes: Set<String> = [
        "sq", "sqc", "tst", "tst*", "sp", "spk", "pp", "paypal", "pos", "ach",
        "dd", "doordash", "gh", "ext", "che", "pmt", "web", "bill", "recur",
    ]

    private static let noiseTokens: Set<String> = [
        "debit", "credit", "card", "purchase", "pos", "ach", "visa", "mastercard",
        "mc", "amex", "discover", "payment", "pmt", "recurring", "recur", "autopay",
        "auto", "pay", "web", "id", "ppd", "des", "indn", "co", "ref", "trn",
        "transaction", "online", "bill", "checkcard", "ckcd", "withdrawal", "dda",
        "us", "usa", "inc", "llc", "intl",
    ]

    private static let stateCodes: Set<String> = [
        "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il",
        "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt",
        "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri",
        "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc",
    ]

    private static let cleanupPatterns: [NSRegularExpression] = [
        #"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b"#, // dates
        #"#\s*\d+"#,                                // "#1234"
        #"\bx{2,}\d+\b"#,                           // masked card "xxxx1234"
        #"\b\d{4,}\b"#,                             // long id numbers
        #"\b\d+\s*(?:st|nd|rd|th)\b"#,              // ordinals
        #"[^a-z0-9'\s]"#,                           // punctuation
    ].map { try! NSRegularExpression(pattern: $0) }

    static func normalize(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        var s = raw.lowercased().replacingOccurrences(of: "*", with: " ")
        for pattern in cleanupPatterns {
            s = pattern.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: " ")
        }

        var tokens = s.split(whereSeparator: \.isWhitespace).map(String.init)
        if tokens.count > 1, processorPrefixes.contains(tokens[0]) { tokens.removeFirst() }
        if tokens.count > 1, let last = tokens.last, last.count == 5, last.allSatisfy(\.isNumber) { tokens.removeLast() }
        if tokens.count > 1, let last = tokens.last, stateCodes.contains(last) { tokens.removeLast() }

        let meaningful = tokens.filter { !noiseTokens.contains($0) && !$0.allSatisfy(\.isNumber) && $0.count > 1 }
        return (meaningful.isEmpty ? tokens : meaningful).joined(separator: " ")
    }
}
