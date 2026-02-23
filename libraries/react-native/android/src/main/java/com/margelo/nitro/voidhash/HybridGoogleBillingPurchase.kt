package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingPurchase(
    override val id: String,
    override val ids: Array<String>,
    override val orderId: String?,
    override val purchaseTime: Double,
    override val originalJson: String,
    override val purchaseToken: String,
    override val signature: String,
    override val isAutoRenewing: Boolean?,
    override val isAcknowledged: Boolean,
    override val purchaseState: Double,
    override val packageName: String,
    override val developerPayload: String,
    override val obfuscatedAccountId: String?,
    override val obfuscatedProfileId: String?,
) : HybridGoogleBillingPurchaseSpec() 