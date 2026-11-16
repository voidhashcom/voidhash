import StoreKit
import SwiftUI
import Voidhash

/// The app-owned upgrade screen: products straight from `getProducts()`, a StoreKit buy
/// action reported to Voidhash, restore, and the App Store subscription sheet.
///
/// This is what the Notes screen falls back to when no paywall is available for
/// `onboarding`, which is where every new project starts — so it is a first-class screen,
/// not an error state.
struct UpgradeScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var showsManageSubscriptions = false

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
                    showsManageSubscriptions = true
                } label: {
                    Label("Manage subscriptions", systemImage: "gear")
                }
            }
            .disabled(model.isWorking)
        }
        .manageSubscriptionsSheet(isPresented: $showsManageSubscriptions)
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
                    Text(product.price.formatted)
                        .font(.headline)
                    if let subscription = product.subscription {
                        Text(
                            subscription.period.count == 1
                                ? "per \(subscription.period.unit.rawValue)"
                                : "every \(subscription.period.description)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if subscription.period.unit != .month || subscription.period.count != 1 {
                            Text("\(subscription.pricePerMonth.formatted) a month")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        if let trial = subscription.introOffer?.freeTrial {
                            Text("\(trial.description) free")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
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
