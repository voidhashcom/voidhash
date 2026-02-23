package com.margelo.nitro.voidhash;

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingOneTimePurchaseOfferDetails(
    override val priceCurrencyCode: String,
    override val formattedPrice: String,
    override val priceAmountMicros: String
) : HybridGoogleBillingOneTimePurchaseOfferDetailsSpec() {
}