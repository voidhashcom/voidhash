package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingBuyItemByTypeParams(
    override val type: GoogleBillingProductType,
    override val skuArr: Array<String>,
    override val purchaseToken: String?,
    override val replacementMode: Double?,
    override val obfuscatedAccountId: String?,
    override val obfuscatedProfileId: String?,
    override val offerTokenArr: Array<String>?,
    override val isOfferPersonalized: Boolean?

) : HybridGoogleBillingBuyItemByTypeParamsSpec()