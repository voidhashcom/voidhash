import Foundation
import NitroModules
import VoidhashCore

class HybridStorekitTransaction: HybridStorekitTransactionSpec {

    private let transaction: StoreKitTransactionInfo

    init(transaction: StoreKitTransactionInfo) {
        self.transaction = transaction
    }

    // MARK: - HybridStorekitTransactionSpec Properties

    var id: String {
        return transaction.id
    }

    var ids: [String] {
        return transaction.ids
    }

    var transactionId: String {
        return transaction.transactionId
    }

    var transactionDate: Double {
        return transaction.transactionDate
    }

    var transactionReceipt: String {
        return transaction.transactionReceipt
    }

    var quantityIos: Double {
        return transaction.quantityIos
    }

    var originalTransactionDateIos: Double {
        return transaction.originalTransactionDateIos
    }

    var originalTransactionIdentifierIos: String {
        return transaction.originalTransactionIdentifierIos
    }

    var appAccountToken: Variant_NullType_String? {
        guard let token = transaction.appAccountToken else {
            return nil
        }
        return .second(token)
    }

    var appBundleIdIos: String {
        return transaction.appBundleIdIos
    }

    var productTypeIos: String {
        return transaction.productTypeIos
    }

    var subscriptionGroupIdIos: Variant_NullType_String? {
        guard let subscriptionGroupID = transaction.subscriptionGroupIdIos else {
            return nil
        }
        return .second(subscriptionGroupID)
    }

    var webOrderLineItemIdIos: Variant_NullType_Double? {
        guard let webOrderLineItemId = transaction.webOrderLineItemIdIos else {
            return nil
        }
        return .second(webOrderLineItemId)
    }

    var expirationDateIos: Variant_NullType_Double? {
        guard let expirationDate = transaction.expirationDateIos else {
            return nil
        }
        return .second(expirationDate)
    }

    var isUpgradedIos: Bool? {
        return transaction.isUpgradedIos
    }

    var ownershipTypeIos: String {
        return transaction.ownershipTypeIos
    }

    var revocationDateIos: Variant_NullType_Double? {
        guard let revocationDate = transaction.revocationDateIos else {
            return nil
        }
        return .second(revocationDate)
    }

    var revocationReasonIos: Variant_NullType_String? {
        guard let revocationReason = transaction.revocationReasonIos else {
            return nil
        }
        return .second(revocationReason)
    }

    var transactionReasonIos: Variant_NullType_String? {
        guard let transactionReason = transaction.transactionReasonIos else {
            return nil
        }
        return .second(transactionReason)
    }

    var jwsRepresentationIos: Variant_NullType_String? {
        guard let jwsRepresentation = transaction.jwsRepresentationIos else {
            return nil
        }
        return .second(jwsRepresentation)
    }

    var environmentIos: String? {
        return transaction.environmentIos
    }

    var storefrontCountryCodeIos: String? {
        return transaction.storefrontCountryCodeIos
    }

    var reasonIos: String? {
        return transaction.reasonIos
    }

    var offerIos: Variant_NullType_StorekitProductPurchaseOffer? {
        guard let offer = transaction.offerIos else {
            return nil
        }
        return .second(
            StorekitProductPurchaseOffer(
                id: offer.id,
                type: offer.type,
                paymentMode: offer.paymentMode
            )
        )
    }

    var priceIos: Double? {
        return transaction.priceIos
    }

    var currencyIos: String? {
        return transaction.currencyIos
    }

    var type: PurchasedItemType {
        switch transaction.type {
        case .subscription:
            return .subscription
        case .inapp:
            return .inapp
        }
    }

    var sku: String {
        return transaction.sku
    }
}
