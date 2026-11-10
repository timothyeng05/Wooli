#if os(macOS)
import AppKit
import SwiftUI

/// Connecting Wooli to Claude on a Mac without Terminal or config files.
/// "Add to Claude" hands the Claude app a small Desktop Extension (`.mcpb`)
/// that points at this app's `--mcp` mode (`WooliMCPServer`); Claude shows
/// its own Install dialog. Claude Code users copy one command instead.
@MainActor
enum ClaudeConnection {
    static let claudeBundleID = "com.anthropic.claudefordesktop"
    private static let lastUsedKey = "claudeLastUsedAt"

    /// When Claude last called one of Wooli's tools (set by the MCP process,
    /// which shares this app's settings).
    static var lastUsed: Date? { UserDefaults.standard.object(forKey: lastUsedKey) as? Date }
    static func markUsed() { UserDefaults.standard.set(Date.now, forKey: lastUsedKey) }

    static var claudeAppURL: URL? { NSWorkspace.shared.urlForApplication(withBundleIdentifier: claudeBundleID) }

    private static var executable: String { Bundle.main.executablePath ?? "/Applications/Wooli.app/Contents/MacOS/Wooli" }

    static var claudeCodeCommand: String {
        "claude mcp add --scope user wooli -- \"\(executable)\" --mcp"
    }

    /// Builds `Wooli.mcpb` (a zip of manifest.json and the icon) in a temporary folder.
    static func makeExtension() throws -> URL {
        let fm = FileManager.default
        let folder = fm.temporaryDirectory.appending(path: "WooliExtension-\(UUID().uuidString)")
        let contents = folder.appending(path: "contents")
        try fm.createDirectory(at: contents, withIntermediateDirectories: true)

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let manifest: [String: Any] = [
            "manifest_version": "0.3",
            "name": "wooli",
            "display_name": "Wooli",
            "version": version.split(separator: ".").count == 2 ? version + ".0" : version,
            "description": "Ask Claude about your Wooli budget, trips and lists. Claude reads your Wooli data on this Mac and can add plans to your trips when you ask.",
            "author": ["name": "Wooli", "url": "https://wooliapp.com"],
            "icon": "icon.png",
            "server": [
                "type": "binary",
                "entry_point": executable,
                "mcp_config": ["command": executable, "args": ["--mcp"]],
            ],
            "tools": WooliMCPTools.definitions.map { ["name": $0["name"] ?? "", "description": $0["description"] ?? ""] },
            "compatibility": ["platforms": ["darwin"]],
        ]
        try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
            .write(to: contents.appending(path: "manifest.json"))
        if let icon = NSApp.applicationIconImage, let tiff = icon.tiffRepresentation,
           let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
            try png.write(to: contents.appending(path: "icon.png"))
        }

        let output = folder.appending(path: "Wooli.mcpb")
        let zip = Process()
        zip.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
        zip.arguments = ["-c", "-k", contents.path, output.path]
        try zip.run()
        zip.waitUntilExit()
        guard zip.terminationStatus == 0 else { throw CocoaError(.fileWriteUnknown) }
        return output
    }
}

/// The Claude section of Settings on the Mac.
struct ClaudeConnectSection: View {
    @State private var copied = false
    @State private var error: String?
    @State private var lastUsed = ClaudeConnection.lastUsed

    var body: some View {
        Section {
            if let claude = ClaudeConnection.claudeAppURL {
                Button("Add to Claude", systemImage: "plus.circle") { add(using: claude) }
            } else {
                Link(destination: URL(string: "https://claude.ai/download")!) {
                    Label("Get Claude for Mac", systemImage: "arrow.down.circle")
                }
            }
            Button(copied ? "Copied" : "Copy command for Claude Code", systemImage: copied ? "checkmark" : "terminal") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(ClaudeConnection.claudeCodeCommand, forType: .string)
                copied = true
            }
            LabeledContent("Last used by Claude") {
                Text(lastUsed.map { $0.formatted(.relative(presentation: .named)) } ?? "Not yet")
            }
            if let error {
                Text(error).foregroundStyle(Theme.expense)
            }
        } header: {
            Text("Claude")
        } footer: {
            Text("Ask Claude about your budget, trips and lists, like \u{201C}How much have I spent on restaurants this month?\u{201D} Claude reads your Wooli data on this \(ThisDevice.name), and changes a trip only when you ask. What it reads becomes part of your chat with Claude.")
        }
        .onAppear { lastUsed = ClaudeConnection.lastUsed }
    }

    private func add(using claude: URL) {
        do {
            let file = try ClaudeConnection.makeExtension()
            NSWorkspace.shared.open([file], withApplicationAt: claude, configuration: NSWorkspace.OpenConfiguration())
            error = nil
        } catch {
            self.error = "Couldn't make the Claude extension: \(error.localizedDescription)"
        }
    }
}
#endif
