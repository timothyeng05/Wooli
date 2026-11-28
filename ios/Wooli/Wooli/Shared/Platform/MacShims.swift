#if os(macOS)
import AppKit
import SwiftUI

// The Mac build shares every view with the iPhone app. These stand-ins let
// iPhone-only modifiers compile on macOS, where they do nothing (or the
// nearest Mac equivalent), so views don't need `#if os(iOS)` at each call.
//
// Audit (UI Parity Plan Phase 1):
// - Intentional no-ops: `keyboardType`, `textInputAutocapitalization`,
//   `navigationBarTitleDisplayMode`, `listSectionSpacing`, `EditButton`, `editMode`,
//   `DatePickerStyle.wheel`, `PickerStyle.navigationLink`, `SearchFieldPlacement.navigationBarDrawer`.
// - Placement aliases: `topBarTrailing -> .primaryAction`, `topBarLeading -> .navigation`,
//   `bottomBar -> .automatic`, `navigationBar -> .windowToolbar`.
// - Native desktop presentations: `fullScreenCover` falls back to `.sheet` only for
//   truly full-context modals; entry/detail editors (`AccountDetailView`, `RecurringEditor`)
//   use `listDetail` or `macInspector(item:)` (`.inspector(isPresented:)` on macOS).

enum MacKeyboardType { case decimalPad, numberPad, numbersAndPunctuation, phonePad, emailAddress, URL, asciiCapable }
enum MacAutocapitalization { case never, characters, words, sentences }
enum MacTitleDisplayMode { case inline, large, automatic }
enum MacSearchDrawerMode { case always, automatic }
enum MacEditMode { case active, inactive, transient }

extension View {
    func keyboardType(_ type: MacKeyboardType) -> some View { self }
    func textInputAutocapitalization(_ style: MacAutocapitalization?) -> some View { self }
    func navigationBarTitleDisplayMode(_ mode: MacTitleDisplayMode) -> some View { self }
    func listSectionSpacing(_ spacing: CGFloat) -> some View { self }

    /// A Mac window has no full screen cover; a sheet is the closest fit.
    func fullScreenCover<Content: View>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil,
                                        @ViewBuilder content: @escaping () -> Content) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            content().frame(minWidth: 640, idealWidth: 720, minHeight: 620, idealHeight: 760)
        }
    }
}

extension ToolbarItemPlacement {
    static var topBarTrailing: ToolbarItemPlacement { .primaryAction }
    static var topBarLeading: ToolbarItemPlacement { .navigation }
    static var bottomBar: ToolbarItemPlacement { .automatic }
}

extension ToolbarPlacement {
    static var navigationBar: ToolbarPlacement { .windowToolbar }
}

extension DatePickerStyle where Self == StepperFieldDatePickerStyle {
    static var wheel: StepperFieldDatePickerStyle { .stepperField }
}

extension PickerStyle where Self == MenuPickerStyle {
    static var navigationLink: MenuPickerStyle { .menu }
}

extension SearchFieldPlacement {
    static func navigationBarDrawer(displayMode: MacSearchDrawerMode) -> SearchFieldPlacement { .toolbar }
}

extension EnvironmentValues {
    /// Lists reorder on the Mac without an edit mode.
    @Entry var editMode: Binding<MacEditMode>? = nil
}

/// Reordering is always on in Mac lists, so there's nothing to toggle.
struct EditButton: View {
    var body: some View { EmptyView() }
}

/// Mac sheets size themselves to their content, and screens built for an
/// iPhone stretch, so a sheet like "Add a place" came up as a 470×150 strip.
/// Every sheet in the app wraps its screen in `NavigationStack { … }`, so on
/// the Mac this stand-in gives that a comfortable size to grow from. In the
/// main window the minimums are smaller than the space it's given anyway.
struct NavigationStack<Root: View>: View {
    private let root: Root

    init(@ViewBuilder root: () -> Root) { self.root = root() }

    var body: some View {
        SwiftUI.NavigationStack { root }
            .frame(minWidth: 400, idealWidth: 600, minHeight: 400, idealHeight: 660)
    }
}

extension NSColor {
    static var systemGroupedBackground: NSColor { .windowBackgroundColor }
    static var secondarySystemGroupedBackground: NSColor { .controlBackgroundColor }
    static var systemBackground: NSColor { .windowBackgroundColor }
    static var secondarySystemBackground: NSColor { .controlBackgroundColor }
    static var systemGray3: NSColor { .tertiaryLabelColor }
}
#endif
