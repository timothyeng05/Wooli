import SwiftUI

/// Shows a component in light and dark mode, one above the other, for `#Preview`.
struct LightDark<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            ForEach([ColorScheme.light, .dark], id: \.self) { scheme in
                content
                    .padding(Space.l)
                    .frame(maxWidth: .infinity)
                    .background(Theme.background)
                    .environment(\.colorScheme, scheme)
            }
        }
    }
}
