import SwiftUI
import SwiftData

struct PeopleSettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Person.name) private var people: [Person]
    @State private var newPersonName = ""

    var body: some View {
        Form {
            Section("Household Members") {
                ForEach(people) { person in
                    NavigationLink {
                        PersonEditView(person: person)
                    } label: {
                        HStack {
                            Text(person.icon)
                            Text(person.name)
                        }
                    }
                }
                .onDelete { indices in
                    for index in indices {
                        context.delete(people[index])
                    }
                }
            }

            Section("Add Person") {
                HStack {
                    TextField("Name", text: $newPersonName)
                    Button("Add") {
                        let trimmed = newPersonName.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        let person = Person(name: trimmed)
                        context.insert(person)
                        newPersonName = ""
                    }
                    .disabled(newPersonName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .navigationTitle("Household")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct PersonEditView: View {
    let person: Person
    @State private var name: String
    @State private var icon: String
    @State private var colorHex: String

    init(person: Person) {
        self.person = person
        self._name = State(initialValue: person.name)
        self._icon = State(initialValue: person.icon)
        self._colorHex = State(initialValue: person.colorHex)
    }

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name)
                HStack {
                    Text("Icon")
                    Spacer()
                    TextField("Emoji", text: $icon)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 50)
                }
            }
        }
        .navigationTitle("Edit Person")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            person.name = name.trimmingCharacters(in: .whitespaces)
            person.icon = icon.isEmpty ? "👤" : String(icon.prefix(1))
            // colorHex could also be updated here
        }
    }
}
