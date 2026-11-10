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
                } else {
                    empty()
                }
            }
            .frame(minWidth: 420, maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.card)
        }
        #else
        sheet(item: item, content: detail)
        #endif
    }
}

/// The right side of a Mac list when nothing is open.
struct SideDetailPlaceholder: View {
    let text: String
    var systemImage = "sidebar.left"

    var body: some View {
        ContentUnavailableView(text, systemImage: systemImage)
            .foregroundStyle(Theme.textSecondary)
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
