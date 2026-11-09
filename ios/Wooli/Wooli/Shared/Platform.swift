import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

// iPhone-only SwiftUI and UIKit calls, wrapped so the same views also build
// for the Mac. On iOS each one does exactly what the original call did.

enum WooliKeyboard {
    case decimalPad, numberPad, numbersAndPunctuation
}

enum WooliCapitalization {
    case never, characters
}

extension View {
    /// `.navigationBarTitleDisplayMode(.inline)`; Mac titles are always inline.
    func inlineNavigationTitle() -> some View {
        #if os(iOS)
        navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }

    /// `.keyboardType(_:)`; a Mac has a real keyboard.
    func wooliKeyboard(_ keyboard: WooliKeyboard) -> some View {
        #if os(iOS)
        let type: UIKeyboardType = switch keyboard {
        case .decimalPad: .decimalPad
        case .numberPad: .numberPad
        case .numbersAndPunctuation: .numbersAndPunctuation
        }
        return keyboardType(type)
        #else
        return self
        #endif
    }

    /// `.textInputAutocapitalization(_:)`; the Mac doesn't auto-capitalize.
    func wooliCapitalization(_ capitalization: WooliCapitalization) -> some View {
        #if os(iOS)
        textInputAutocapitalization(capitalization == .characters ? .characters : .never)
        #else
        self
        #endif
    }

    /// `.fullScreenCover`; a sheet on the Mac.
    func wooliFullScreenCover<Content: View>(isPresented: Binding<Bool>, @ViewBuilder content: @escaping () -> Content) -> some View {
        #if os(iOS)
        fullScreenCover(isPresented: isPresented, content: content)
        #else
        sheet(isPresented: isPresented, content: content)
        #endif
    }

    /// Lists that are always in reorder mode. Mac lists reorder by dragging without it.
    func alwaysEditing() -> some View {
        #if os(iOS)
        environment(\.editMode, .constant(.active))
        #else
        self
        #endif
    }
}

extension ToolbarItemPlacement {
    /// `.topBarLeading` / `.topBarTrailing` don't exist on the Mac.
    static var wooliLeading: ToolbarItemPlacement {
        #if os(iOS)
        .topBarLeading
        #else
        .navigation
        #endif
    }

    static var wooliTrailing: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .primaryAction
        #endif
    }

    static var wooliBottomBar: ToolbarItemPlacement {
        #if os(iOS)
        .bottomBar
        #else
        .automatic
        #endif
    }
}

extension SearchFieldPlacement {
    /// Search field that stays visible under the title on iPhone.
    static var wooliAlwaysVisible: SearchFieldPlacement {
        #if os(iOS)
        .navigationBarDrawer(displayMode: .always)
        #else
        .automatic
        #endif
    }
}

enum Haptics {
    static func light() {
        #if os(iOS)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
}

enum Pasteboard {
    static var string: String? {
        #if os(iOS)
        UIPasteboard.general.string
        #else
        NSPasteboard.general.string(forType: .string)
        #endif
    }
}

enum ExternalURL {
    @MainActor static func open(_ url: URL) {
        #if os(iOS)
        UIApplication.shared.open(url)
        #else
        NSWorkspace.shared.open(url)
        #endif
    }
}

extension Color {
    // System backgrounds that only exist as UIColor names.
    static var platformBackground: Color {
        #if os(iOS)
        Color(UIColor.systemBackground)
        #else
        Color(nsColor: .windowBackgroundColor)
        #endif
    }

    static var platformSecondaryBackground: Color {
        #if os(iOS)
        Color(.secondarySystemBackground)
        #else
        Color(nsColor: .controlBackgroundColor)
        #endif
    }

    static var platformGroupedBackground: Color {
        #if os(iOS)
        Color(.systemGroupedBackground)
        #else
        Color(nsColor: .windowBackgroundColor)
        #endif
    }

    static var platformGray3: Color {
        #if os(iOS)
        Color(.systemGray3)
        #else
        Color(nsColor: .tertiaryLabelColor)
        #endif
    }
}
