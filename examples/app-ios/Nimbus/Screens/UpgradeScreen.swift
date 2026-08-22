import SwiftUI
import Voidhash

/// The app-owned upgrade screen: products straight from `getProducts()`, a buy action,
/// restore, and the two store sheets.
///
/// This is what the Notes screen falls back to when no paywall is published for
/// `onboarding`, which is where every new project starts — so it is a first-class screen,
/// not an error state.
struct UpgradeScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Screen(title: "Upgrade", subtitle: "Unlimited notes and export.") {
            if model.isPro {
                Card {
                    Label("You're on Pro", systemImage: "checkmark.seal.fill")
                        .font(.headline)
                        .foregroundColor(.green)
                    Text("Manage or cancel from the App Store sheet below.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            if model.products.isEmpty {
                Card(title: "No products yet") {
                    Text(
                        "getProducts() returned nothing. Add products with the slugs "
                            + "pro-monthly, pro-annual and pro-lifetime in Studio, then reopen "
                            + "the app."
                    )
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                }
            } else {
                ForEach(model.products, id: \.id) { product in
                    productCard(product)
                }
            }

            Card(title: "Already paid?") {
                Button {
                    Task { await model.restorePurchases() }
                } label: {
                    Label("Restore purchases", systemImage: "arrow.clockwise")
                }
                Button {
                    Task { await model.redeemOfferCode() }
                } label: {
                    Label("Redeem an offer code", systemImage: "giftcard")
                }
                Button {
                    Task { await model.manageSubscriptions() }
                } label: {
                    Label("Manage subscriptions", systemImage: "gear")
                }
            }
            .disabled(model.isWorking)
        }
    }

    private func productCard(_ product: VoidhashProduct) -> some View {
        Card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.name)
                        .font(.headline)
                    Text(product.slug)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(product.displayPrice)
                        .font(.headline)
                    if let interval = product.interval {
                        Text("per \(interval)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            Button {
                Task { await model.purchase(product) }
            } label: {
                Text(model.isPro ? "Switch to this plan" : "Buy")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.isWorking)
        }
    }
}
