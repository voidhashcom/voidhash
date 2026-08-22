import SwiftUI
import VoidhashCore

/// Identity, attributes, entitlement grants and the feature flag — the whole
/// `identify` / `setPersonAttributes` / `getFeatureFlags` / `reset` loop.
struct AccountScreen: View {
    @EnvironmentObject private var model: AppModel

    @State private var externalUserId = "user_123"
    @State private var email = "ada@example.com"
    @State private var name = "Ada Lovelace"

    var body: some View {
        Screen(title: "Account", subtitle: "Who Voidhash thinks you are.") {
            identityCard
            attributesCard
            grantsCard
            flagCard
        }
    }

    private var identityCard: some View {
        Card(title: model.isSignedIn ? "Signed in" : "Sign in") {
            DetailRow(label: "Distinct id", value: model.distinctId)
            if let person = model.person {
                DetailRow(label: "Person id", value: person.personId)
                DetailRow(label: "Email", value: person.email ?? "—")
                DetailRow(label: "Name", value: person.name ?? "—")
            }

            if model.isSignedIn {
                Button(role: .destructive) {
                    Task { await model.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .disabled(model.isWorking)
            } else {
                Divider()
                TextField("External user id", text: $externalUserId)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .keyboardType(.emailAddress)
                TextField("Name", text: $name)
                Button {
                    Task {
                        await model.signIn(
                            externalUserId: externalUserId, email: email, name: name)
                    }
                } label: {
                    Text("Sign in with identify()")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isWorking)
            }
        }
    }

    private var attributesCard: some View {
        Card(title: "Person attributes") {
            DetailRow(label: "plan", value: model.planName)
            DetailRow(label: "notes_created", value: "\(model.notesCreated)")
            Button {
                Task { await model.syncPersonAttributes() }
            } label: {
                Label("Write with setPersonAttributes()", systemImage: "square.and.pencil")
            }
            .disabled(model.isWorking)
        }
    }

    private var grantsCard: some View {
        Card(title: "Entitlement grants") {
            let grants = model.person?.entitlements.grants ?? []
            if grants.isEmpty {
                Text("None. A free account has no grants — that is not an error.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(grants, id: \.perkId) { grant in
                    grantRow(grant)
                }
            }
            Button {
                Task { await model.refreshPerson() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(model.isWorking)
        }
    }

    private func grantRow(_ grant: SdkEntitlementGrant) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(grant.perkId)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(grant.status)
                    .font(.caption)
                    .foregroundColor(grant.status == "active" ? .green : .secondary)
            }
            Text("via \(grant.source)" + (grant.expiresAt.map { " · expires \($0)" } ?? ""))
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var flagCard: some View {
        Card(title: "Feature flag") {
            DetailRow(label: Nimbus.featureFlagKey, value: flagValue)
            Button {
                Task { await model.refreshFeatureFlag() }
            } label: {
                Label("Re-evaluate", systemImage: "flag")
            }
            .disabled(model.isWorking)
        }
    }

    private var flagValue: String {
        guard let flag = model.featureFlag else {
            return "not defined"
        }
        guard let variantKey = flag.variantKey else {
            return flag.enabled ? "on" : "off"
        }
        return "\(flag.enabled ? "on" : "off") · \(variantKey)"
    }
}
