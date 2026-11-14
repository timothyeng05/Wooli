import Foundation

/// Plain text out of a dropped confirmation (M2-3): an `.eml` message (MIME parts,
/// quoted-printable and base64 decoded, HTML stripped when there's no plain part)
/// or a `.txt`. Pure and on-device; PDFs are read with PDFKit by the caller.
enum ConfirmationText {
    static func text(fromFile name: String, data: Data) -> String? {
        let string = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1)
        guard let string else { return nil }
        return name.lowercased().hasSuffix(".eml") ? fromEML(string) : string
    }

    /// The readable body of a message, with the subject on top (hotel names often live there).
    static func fromEML(_ raw: String) -> String {
        let message = raw.replacingOccurrences(of: "\r\n", with: "\n")
        let (headers, body) = split(message)
        var parts: [String] = []
        if let subject = headerValue("subject", in: headers) { parts.append(subject) }
        parts.append(readableBody(headers: headers, body: body))
        return parts.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: MIME

    private static func readableBody(headers: String, body: String) -> String {
        let type = (headerValue("content-type", in: headers) ?? "text/plain").lowercased()
        if type.hasPrefix("multipart/"), let boundary = parameter("boundary", in: headerValue("content-type", in: headers) ?? "") {
            let pieces = body.components(separatedBy: "--" + boundary).dropFirst().filter { !$0.hasPrefix("--") }
            let decoded = pieces.map { piece -> (type: String, text: String) in
                let (h, b) = split(piece.trimmingCharacters(in: .newlines))
                let t = (headerValue("content-type", in: h) ?? "text/plain").lowercased()
                return (t, readableBody(headers: h, body: b))
            }
            // Prefer a plain-text part; fall back to whatever HTML there was.
            if let plain = decoded.first(where: { $0.type.hasPrefix("text/plain") }) { return plain.text }
            return decoded.first { $0.type.hasPrefix("text/") || $0.type.hasPrefix("multipart/") }?.text ?? ""
        }
        let encoding = (headerValue("content-transfer-encoding", in: headers) ?? "").lowercased()
        var text = decode(body, encoding: encoding)
        if type.hasPrefix("text/html") { text = stripHTML(text) }
        return text
    }

    private static func split(_ message: String) -> (headers: String, body: String) {
        guard let range = message.range(of: "\n\n") else { return (message, "") }
        return (String(message[..<range.lowerBound]), String(message[range.upperBound...]))
    }

    /// A header's value, with folded continuation lines joined.
    static func headerValue(_ name: String, in headers: String) -> String? {
        var lines: [String] = []
        for line in headers.split(separator: "\n", omittingEmptySubsequences: false) {
            if (line.hasPrefix(" ") || line.hasPrefix("\t")), !lines.isEmpty {
                lines[lines.count - 1] += " " + line.trimmingCharacters(in: .whitespaces)
            } else {
                lines.append(String(line))
            }
        }
        for line in lines {
            guard let colon = line.firstIndex(of: ":") else { continue }
            if line[..<colon].lowercased() == name.lowercased() {
                return line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            }
        }
        return nil
    }

    private static func parameter(_ name: String, in value: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: "(?i)" + name + #"\s*=\s*"?([^";\s]+)"?"#),
              let m = re.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
              let range = Range(m.range(at: 1), in: value) else { return nil }
        return String(value[range])
    }

    // MARK: Encodings

    static func decode(_ body: String, encoding: String) -> String {
        switch encoding {
        case "quoted-printable": return decodeQuotedPrintable(body)
        case "base64":
            let cleaned = body.filter { !$0.isWhitespace }
            return Data(base64Encoded: cleaned).flatMap { String(data: $0, encoding: .utf8) } ?? body
        default: return body
        }
    }

    static func decodeQuotedPrintable(_ text: String) -> String {
        // Soft line breaks first, then =XX bytes (UTF-8 sequences stay together).
        let joined = text.replacingOccurrences(of: "=\n", with: "")
        var bytes: [UInt8] = []
        let chars = Array(joined.utf8)
        var i = 0
        while i < chars.count {
            if chars[i] == UInt8(ascii: "="), i + 2 < chars.count + 0,
               let value = UInt8(String(decoding: chars[(i + 1)...(i + 2)], as: UTF8.self), radix: 16) {
                bytes.append(value)
                i += 3
            } else {
                bytes.append(chars[i])
                i += 1
            }
        }
        return String(decoding: bytes, as: UTF8.self)
    }

    /// Tags out, entities for the few that matter, blocks to lines.
    static func stripHTML(_ html: String) -> String {
        var text = html
        for tag in ["br", "/p", "/div", "/tr", "/li", "/h1", "/h2", "/h3"] {
            text = text.replacingOccurrences(of: "<\(tag)[^>]*>", with: "\n", options: [.regularExpression, .caseInsensitive])
        }
        text = text.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        for (entity, char) in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'")] {
            text = text.replacingOccurrences(of: entity, with: char)
        }
        return text.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .joined(separator: "\n")
            .replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
    }
}
