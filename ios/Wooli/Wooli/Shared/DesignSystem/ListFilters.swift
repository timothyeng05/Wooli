import SwiftUI

// List controls in Eats' style, for Movies and Recipes: underlined tabs,
// filter pills that turn solid once a value is picked, and a sort menu.

/// Underlined text tabs ("Seen · Want to see 3").
struct UnderlineTabs<Value: Hashable>: View {
    let tabs: [(value: Value, title: String)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 28) {
            ForEach(tabs, id: \.value) { tab in
                Button { selection = tab.value } label: {
                    VStack(spacing: 8) {
                        Text(tab.title)
                            .font(.headline).foregroundStyle(selection == tab.value ? Theme.text : Theme.textTertiary)
                        Rectangle().fill(selection == tab.value ? Theme.text : .clear).frame(height: 3)
                    }
                    .fixedSize()
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == tab.value ? .isSelected : [])
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { Divider() }
    }
}

/// One filter: an outlined pill with a menu of options; solid once one is picked.
struct FilterPill: View {
    let title: String
    @Binding var value: String?
    let options: [String]

    var body: some View {
        Menu {
            Button("Any \(title.lowercased())") { value = nil }
            ForEach(options, id: \.self) { option in
                Button(option) { value = option }
            }
        } label: {
            HStack(spacing: 6) {
                Text(value ?? title).lineLimit(1)
                Image(systemName: "chevron.down").font(.caption.weight(.bold))
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(value == nil ? Theme.text : .white)
            .padding(.horizontal, 14).frame(height: 36)
            .background(Capsule().fill(value == nil ? Color.clear : PlaceActionBar.ink))
            .overlay(Capsule().strokeBorder(value == nil ? Theme.textTertiary : PlaceActionBar.ink, lineWidth: 1.2))
        }
    }
}

/// A row of pills that scrolls sideways, with a clear button once any is set.
struct FilterPillRow<Pills: View>: View {
    let isFiltering: Bool
    let onClear: () -> Void
    @ViewBuilder var pills: Pills

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                if isFiltering {
                    Button("Clear filters", systemImage: "xmark", action: onClear)
                        .labelStyle(.iconOnly)
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                        .frame(width: 36, height: 36)
                        .overlay(Circle().strokeBorder(Theme.textTertiary, lineWidth: 1.2))
                }
                pills
            }
            .padding(.vertical, 1)
        }
        .scrollClipDisabled()
    }
}

/// "↕ Rank" — picks how the list is ordered.
struct SortMenu<Value: Hashable & Identifiable & RawRepresentable>: View where Value.RawValue == String {
    let options: [Value]
    @Binding var selection: Value

    var body: some View {
        Menu {
            Picker("Sort", selection: $selection) {
                ForEach(options) { Text($0.rawValue).tag($0) }
            }
        } label: {
            Label(selection.rawValue, systemImage: "arrow.up.arrow.down")
                .font(.subheadline.weight(.semibold)).foregroundStyle(PlaceActionBar.ink)
        }
    }
}

extension String {
    /// "Drama, Romance" → ["Drama", "Romance"]
    var commaParts: [String] {
        split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}
