package com.margelo.nitro.voidhash;

import com.margelo.nitro.voidhash.HybridGoogleBillingPricingPhasesSpec
import com.margelo.nitro.voidhash.HybridGoogleBillingSubscriptionOfferDetailsSpec
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingSubscriptionOfferDetails(
    override val basePlanId: String,
    override val offerId: String?,
    override val offerToken: String,
    override val offerTags: Array<String>,
    override val pricingPhases: HybridGoogleBillingPricingPhasesSpec
) : HybridGoogleBillingSubscriptionOfferDetailsSpec() {
}