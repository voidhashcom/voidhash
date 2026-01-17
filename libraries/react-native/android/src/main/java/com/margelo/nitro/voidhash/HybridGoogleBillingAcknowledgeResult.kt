package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridGoogleBillingAcknowledgeResult(
    override val responseCode: Double,
    override val debugMessage: String?,
    override val code: String,
    override val message: String
) : HybridGoogleBillingAcknowledgeResultSpec() 