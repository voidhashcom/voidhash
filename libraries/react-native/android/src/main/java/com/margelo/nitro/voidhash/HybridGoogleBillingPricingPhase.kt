package com.margelo.nitro.voidhash;

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingPricingPhase(
    override val formattedPrice: String,
    override val priceCurrencyCode: String,
    override val billingPeriod: String,
    override val billingCycleCount: Double,
    override val priceAmountMicros: String,
    override val recurrenceMode: Double
) : HybridGoogleBillingPricingPhaseSpec() {
}