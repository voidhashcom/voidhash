package com.margelo.nitro.voidhash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.voidhash.core.paywall.PaywallPresenterCore

@Keep
@DoNotStrip
class HybridPaywallPresenter : HybridPaywallPresenterSpec() {
    private val presenter = PaywallPresenterCore(
        contextProvider = { NitroModules.applicationContext },
        activityProvider = { NitroModules.applicationContext?.currentActivity },
    )

    override fun preload(locationSlug: String, htmlUrl: String): Promise<Boolean> {
        return Promise.async {
            return@async presenter.preload(locationSlug, htmlUrl)
        }
    }

    override fun show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((rawEvent: String) -> Unit)?,
        onDismiss: (() -> Unit)?,
    ): Promise<Boolean> {
        return Promise.async {
            return@async presenter.show(locationSlug, htmlUrl, onBridgeEvent, onDismiss)
        }
    }

    override fun dismiss(): Promise<Unit> {
        return Promise.async {
            return@async presenter.dismiss()
        }
    }

    override fun release(locationSlug: String) {
        presenter.release(locationSlug)
    }

    override fun postMessage(locationSlug: String, data: String) {
        presenter.postMessage(locationSlug, data)
    }
}
