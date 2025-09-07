import Foundation
import NitroModules
import StoreKit

class HybridStorekitProductSubscriptionPeriod: HybridStorekitProductSubscriptionPeriodSpec {
    private let period: Product.SubscriptionPeriod

    init(period: Product.SubscriptionPeriod) {
        self.period = period
    }

    // MARK: - HybridStorekitProductSubscriptionPeriodSpec Properties

    var unit: StorekitProductSubscriptionPeriodUnit {
        switch period.unit {
        case .day:
            return .day
        case .week:
            return .week
        case .month:
            return .month
        case .year:
            return .year
        @unknown default:
            return .day
        }
    }

    var value: Double {
        return Double(period.value)
    }
}
