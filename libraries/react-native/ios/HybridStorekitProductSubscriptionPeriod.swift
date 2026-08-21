import Foundation
import NitroModules
import VoidhashCore

class HybridStorekitProductSubscriptionPeriod: HybridStorekitProductSubscriptionPeriodSpec {
    private let period: StoreKitSubscriptionPeriod

    init(period: StoreKitSubscriptionPeriod) {
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
        }
    }

    var value: Double {
        return period.value
    }
}
