#if os(macOS)
import Foundation
import SwiftData

/// A local MCP server so Claude (Claude Code, Claude Desktop) can read your
/// Wooli data. Claude starts the Mac app with `--mcp` and talks JSON-RPC over
/// stdin/stdout, one message per line. There is no window, no bank sync and no
/// iCloud traffic from this process: it opens the same store the app uses,
/// read-only, so it answers from whatever the Mac app last synced.
///
/// Register it with Claude Code:
///   claude mcp add --scope user wooli -- /Applications/Wooli.app/Contents/MacOS/Wooli --mcp
@MainActor
enum WooliMCPServer {
    static let protocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

    static func run() -> Never {
        // stdout carries the protocol; anything else (logs) must go to stderr.
        setvbuf(stdout, nil, _IOLBF, 0)
        let tools: WooliMCPTools
        do {
            tools = try WooliMCPTools()
        } catch {
            log("Couldn't open the Wooli store: \(error)")
            exit(1)
        }
        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty,
                  let data = line.data(using: .utf8),
                  let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                send(["jsonrpc": "2.0", "id": NSNull(), "error": ["code": -32700, "message": "Parse error"]])
                continue
            }
            if let reply = handle(message, tools: tools) { send(reply) }
        }
        exit(0)
    }

    private static func handle(_ message: [String: Any], tools: WooliMCPTools) -> [String: Any]? {
        let method = message["method"] as? String ?? ""
        guard let id = message["id"] else { return nil } // A notification: no reply.
        let params = message["params"] as? [String: Any] ?? [:]
        func result(_ value: [String: Any]) -> [String: Any] { ["jsonrpc": "2.0", "id": id, "result": value] }
        func failure(_ code: Int, _ text: String) -> [String: Any] {
            ["jsonrpc": "2.0", "id": id, "error": ["code": code, "message": text]]
        }

        switch method {
        case "initialize":
            let requested = params["protocolVersion"] as? String ?? ""
            return result([
                "protocolVersion": protocolVersions.contains(requested) ? requested : protocolVersions[0],
                "capabilities": ["tools": ["listChanged": false]],
                "serverInfo": ["name": "wooli", "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1"],
                "instructions": """
                Read-only access to the user's Wooli data on this Mac: budget, bank transactions, \
                accounts, recurring bills, trips, and their Eats, Movies, Recipes and Sights lists. \
                Amounts are in the account's currency; spending is negative in transactions. \
                Data is as of the Mac app's last iCloud and bank sync.
                """,
            ])
        case "ping":
            return result([:])
        case "tools/list":
            return result(["tools": WooliMCPTools.definitions])
        case "tools/call":
            let name = params["name"] as? String ?? ""
            let arguments = params["arguments"] as? [String: Any] ?? [:]
            ClaudeConnection.markUsed() // Shown in Settings → Claude.
            do {
                let output = try tools.call(name, arguments: arguments)
                return result(["content": [["type": "text", "text": json(output)]], "isError": false])
            } catch let error as WooliMCPTools.ToolError {
                return result(["content": [["type": "text", "text": error.message]], "isError": true])
            } catch {
                return result(["content": [["type": "text", "text": "\(error)"]], "isError": true])
            }
        default:
            return failure(-32601, "Method not found: \(method)")
        }
    }

    static func json(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes]) else {
            return "\(value)"
        }
        return String(decoding: data, as: UTF8.self)
    }

    private static func send(_ message: [String: Any]) {
        FileHandle.standardOutput.write(Data((json(message) + "\n").utf8))
    }

    static func log(_ text: String) {
        FileHandle.standardError.write(Data(("wooli-mcp: " + text + "\n").utf8))
    }
}
#endif
