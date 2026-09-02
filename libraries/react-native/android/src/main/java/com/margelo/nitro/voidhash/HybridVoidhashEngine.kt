package com.margelo.nitro.voidhash

import android.content.Context
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.voidhash.engine.VoidhashEngineCore

/**
 * Embeds the bare-native `VoidhashClient` as the React Native SDK's data-plane transport.
 *
 * Every operation takes the distinct id explicitly — identity stays JS-owned, so both sides
 * can never diverge. Headers and environment mode are built by the native client exactly like
 * a pure-native integration. The behaviour lives in [VoidhashEngineCore]; this class only
 * bridges it into Nitro.
 */
@Keep
@DoNotStrip
class HybridVoidhashEngine : HybridVoidhashEngineSpec() {
    private val core = VoidhashEngineCore()

    override fun configure(publishableKey: String, optionsJson: String) {
        val context: Context = requireNotNull(NitroModules.applicationContext) {
            "CONFIGURATION_MISSING: VoidhashEngine configured before the application started"
        }
        core.configure(context, publishableKey, optionsJson)
    }

    override fun setReadOnly(readOnly: Boolean) {
        core.setReadOnly(readOnly)
    }

    override fun fetchSchema(distinctId: String): Promise<String> {
        return Promise.async { core.fetchSchema(distinctId) }
    }

    override fun fetchPerson(distinctId: String, forceFetch: Boolean): Promise<String> {
        // The embedded surface is stateless; forceFetch is always honored.
        return Promise.async { core.fetchPerson(distinctId) }
    }

    override fun identify(distinctId: String, bodyJson: String): Promise<String> {
        return Promise.async { core.identify(distinctId, bodyJson) }
    }

    override fun setPersonAttributes(distinctId: String, attributesJson: String): Promise<String> {
        return Promise.async { core.setPersonAttributes(distinctId, attributesJson) }
    }

    override fun evaluateFlags(distinctId: String, flagKeysJson: String): Promise<String> {
        return Promise.async { core.evaluateFlags(distinctId, flagKeysJson) }
    }

    override fun resolvePaywall(distinctId: String, locationSlug: String): Promise<String> {
        return Promise.async { core.resolvePaywall(distinctId, locationSlug) }
    }

    override fun syncTransaction(distinctId: String, requestJson: String): Promise<Boolean> {
        return Promise.async { core.syncTransaction(distinctId, requestJson) }
    }

    override fun developmentPurchase(distinctId: String, requestJson: String): Promise<Boolean> {
        return Promise.async { core.developmentPurchase(distinctId, requestJson) }
    }

    override fun injectInternalSchema(schemaJson: String): Promise<Unit> {
        return Promise.async { core.injectInternalSchema(schemaJson) }
    }
}
