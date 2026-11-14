import Foundation
import PDFKit

// M2-3: turning a dropped file into plain text for `BookingImport`. All local:
// PDFKit for PDFs, a small MIME reader for .eml, UTF-8 for anything else.

enum BookingFiles {
    static let types = ["txt", "text", "eml", "pdf", "md"]

    static func text(from url: URL) -> String? {
        switch url.pathExtension.lowercased() {
        case "pdf":
            guard let doc = PDFDocument(url: url) else { return nil }
            let text = (0..<doc.pageCount).compactMap { doc.page(at: $0)?.string }.joined(separator: "\n")
            return text.isEmpty ? nil : text
        case "eml":
            guard let data = try? Data(contentsOf: url) else { return nil }
            return emlText(String(decoding: data, as: UTF8.self))
        default:
            guard let data = try? Data(contentsOf: url) else { return nil }
            let text = String(decoding: data, as: UTF8.self)
            return text.isEmpty ? nil : text
        }
    }

    // MARK: .eml

    /// The subject and readable body of a raw message: text parts first, HTML with tags removed as a fallback.
    static func emlText(_ raw: String) -> String {
        let normalized = raw.replacingOccurrences(of: "\r\n", with: "\n")
        let (headers, body) = split(normalized)
        var out: [String] = []
        if let subject = headers["subject"] { out.append(decodeWords(subject)) }
        out.append(bodyText(headers: headers, body: body))
        return out.filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    private static func split(_ entity: String) -> (headers: [String: String], body: String) {
        let parts = entity.components(separatedBy: "\n\n")
        let head = parts.first ?? ""
        let body = parts.dropFirst().joined(separator: "\n\n")
        var headers: [String: String] = [:]
        var key: String?
        for line in head.components(separatedBy: "\n") {
            if line.first == " " || line.first == "\t", let key {
                headers[key, default: ""] += " " + line.trimmingCharacters(in: .whitespaces)
            } else if let colon = line.firstIndex(of: ":") {
                let name = line[..<colon].lowercased()
                headers[name] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
                key = name
            }
        }
        return (headers, body)
    }

    private static func bodyText(headers: [String: String], body: String) -> String {
        let type = (headers["content-type"] ?? "text/plain").lowercased()
        if type.hasPrefix("multipart/"), let boundary = parameter("boundary", in: headers["content-type"] ?? "") {
            let parts = body.components(separatedBy: "--" + boundary).dropFirst().filter { !$0.hasPrefix("--") }
            let texts = parts.map { part -> (isPlain: Bool, text: String) in
                let (h, b) = split(part.hasPrefix("\n") ? String(part.dropFirst()) : part)
                let t = (h["content-type"] ?? "text/plain").lowercased()
                return (t.hasPrefix("text/plain"), t.hasPrefix("text/") || t.hasPrefix("multipart/") ? bodyText(headers: h, body: b) : "")
            }
            let plain = texts.filter { $0.isPlain && !$0.text.isEmpty }
            return (plain.isEmpty ? texts : plain).map(\.text).filter { !$0.isEmpty }.joined(separator: "\n")
        }
        var decoded = body
        switch (headers["content-transfer-encoding"] ?? "").lowercased() {
        case "base64":
            if let data = Data(base64Encoded: body, options: .ignoreUnknownCharacters) { decoded = String(decoding: data, as: UTF8.self) }
        case "quoted-printable":
            decoded = decodeQuotedPrintable(body)
        default: break
        }
        return type.hasPrefix("text/html") ? stripHTML(decoded) : decoded.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func parameter(_ name: String, in value: String) -> String? {
        guard let range = value.range(of: name + "=", options: .caseInsensitive) else { return nil }
        let rest = value[range.upperBound...]
        let end = rest.firstIndex(of: ";") ?? rest.endIndex
        return String(rest[..<end]).trimmingCharacters(in: CharacterSet(charactersIn: "\" "))
    }

    static func decodeQuotedPrintable(_ text: String) -> String {
        let joined = text.replacingOccurrences(of: "=\n", with: "")
        var bytes: [UInt8] = []
        let chars = Array(joined.utf8)
        var i = 0
        while i < chars.count {
            if chars[i] == UInt8(ascii: "="), i + 2 < chars.count,
               let byte = UInt8(String(decoding: chars[(i + 1)...(i + 2)], as: UTF8.self), radix: 16) {
                bytes.append(byte)
                i += 3
            } else {
                bytes.append(chars[i])
                i += 1
            }
        }
        return String(decoding: bytes, as: UTF8.self)
    }

    /// "=?UTF-8?B?...?=" subjects; anything else passes through.
    private static func decodeWords(_ text: String) -> String {
        guard text.contains("=?"),
              let regex = try? NSRegularExpression(pattern: #"=\?[^?]+\?([BbQq])\?([^?]*)\?="#) else { return text }
        var result = text
        let ns = text as NSString
        for m in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).reversed() {
            let kind = ns.substring(with: m.range(at: 1)).uppercased()
            let payload = ns.substring(with: m.range(at: 2))
            let decoded = kind == "B"
                ? Data(base64Encoded: payload).map { String(decoding: $0, as: UTF8.self) } ?? payload
                : decodeQuotedPrintable(payload.replacingOccurrences(of: "_", with: " "))
            result = (result as NSString).replacingCharacters(in: m.range, with: decoded)
        }
        return result
    }

    static func stripHTML(_ html: String) -> String {
        var text = html.replacingOccurrences(of: "(?is)<(script|style).*?</\\1>", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "(?i)<br\\s*/?>|</(p|div|tr|li|h\\d)>", with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        for (entity, char) in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'")] {
            text = text.replacingOccurrences(of: entity, with: char)
        }
        return text.replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\n\\s*\n+", with: "\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
