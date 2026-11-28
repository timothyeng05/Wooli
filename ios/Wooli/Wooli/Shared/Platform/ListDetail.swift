import SwiftUI

extension EnvironmentValues {
    /// True when a detail view sits beside its list on the Mac rather than in its own sheet.
    @Entry var isSideDetail = false
    /// Closes a detail shown beside its list (clears the list's selection). Does nothing in a sheet.
    @Entry var closeSideDetail: () -> Void = {}
}

extension View {
    /// Opens `item` in a sheet on iPhone. On the Mac it shows beside this list
    /// instead, like Mail or Notes, with `empty` when nothing is open.
    func listDetail<Item: Identifiable, Detail: View, Empty: View>(
        _ item: Binding<Item?>,
        @ViewBuilder detail: @escaping (Item) -> Detail,
        @ViewBuilder empty: @escaping () -> Empty
    ) -> some View {
        #if os(macOS)
        HSplitView {
            self.frame(minWidth: 340, idealWidth: 420, maxWidth: 560, maxHeight: .infinity)
            Group {
                if let value = item.wrappedValue {
                    detail(value)
                        .id(value.id)
                        .environment(\.isSideDetail, true)
                        .environment(\.closeSideDetail) { item.wrappedValue = nil }
                        .onKeyPress(.escape) {
                            item.wrappedValue = nil
                            return .handled
                        }
                } else {
                    empty()
                }
            }
            .frame(minWidth: 420, maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(light: 0xFBF9F5, dark: 0x161D1A))
        }
        #else
        sheet(item: item, content: detail)
        #endif
    }

    /// Presents `item` in a native macOS `.inspector(isPresented:)` trailing pane
    /// (with Escape to dismiss), falling back to a sheet on iPhone/iPad.
    func macInspector<Item: Identifiable, Inspector: View>(
        _ item: Binding<Item?>,
        @ViewBuilder content: @escaping (Item) -> Inspector
    ) -> some View {
        #if os(macOS)
        inspector(isPresented: Binding(
            get: { item.wrappedValue != nil },
            set: { if !$0 { item.wrappedValue = nil } }
        )) {
            if let value = item.wrappedValue {
                content(value)
                    .id(value.id)
                    .environment(\.isSideDetail, true)
                    .environment(\.closeSideDetail) { item.wrappedValue = nil }
                    .onKeyPress(.escape) {
                        item.wrappedValue = nil
                        return .handled
                    }
                    .inspectorColumnWidth(min: 300, ideal: 360, max: 440)
            }
        }
        #else
        sheet(item: item, content: content)
        #endif
    }
}

/// The right side of a Mac list when nothing is open.
struct SideDetailPlaceholder: View {
    let text: String
    var systemImage = "sidebar.left"

    var body: some View {
        ContentUnavailableView(text, systemImage: systemImage)
            .foregroundStyle(Color(light: 0x5A6B62, dark: 0x9BA9A1))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(light: 0xFBF9F5, dark: 0x161D1A))
    }
}

/// A detail view's frame: its own navigation bar with Done in a sheet;
/// beside a Mac list, nothing extra (and `onDone` runs when it's left).
struct DetailFrame<Content: View>: View {
    var onDone: () -> Void
    @ViewBuilder var content: Content
    @Environment(\.isSideDetail) private var isSide

    var body: some View {
        if isSide {
            content.readableContentWidth().onDisappear(perform: onDone)
        } else {
            NavigationStack {
                content.toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done", action: onDone) }
                }
            }
        }
    }
}
