package com.margelo.nitro.voidhash;

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingProductDetail(
    override val id: String,
    override val title: String,
    override val description: String,
    override val type: String,
    override val displayName: String,
    override val platform: String,
    override val currency: String,
    override val displayPrice: String,
    override val subscriptionOfferDetails: Variant_NullType_Array_HybridGoogleBillingSubscriptionOfferDetailsSpec_?,
    override val oneTimePurchaseOfferDetails: Variant_NullType_HybridGoogleBillingOneTimePurchaseOfferDetailsSpec?
) : HybridGoogleBillingProductDetailSpec() {
}