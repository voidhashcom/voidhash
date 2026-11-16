package com.margelo.nitro.voidhash.flows

import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.paywall.PaywallRenderer
import org.json.JSONObject

/**
 * What the React Native client needs around the native client's flows: the renderer the app
 * compiled in, and a flow's end as the JSON `presentFlow` answers with
 * (`VoidhashNativeClient.nitro.ts`). Presenting is the native client's own.
 */
internal object VoidhashFlowsCore {
    /** The `ui` module's renderer when the app compiles it in, found without naming it. */
    fun linkedRenderer(): PaywallRenderer? =
        try {
            Class.forName("com.voidhash.ui.VoidhashUiPaywallRenderer")
                .getDeclaredConstructor()
                .newInstance() as? PaywallRenderer
        } catch (error: ClassNotFoundException) {
            null
        } catch (error: ReflectiveOperationException) {
            null
        }

    /** [value], a string, number, boolean or `null`, as JSON. */
    fun jsonScalar(value: Any?): String = when (value) {
        null, JSONObject.NULL -> "null"
        is Boolean -> value.toString()
        is Number -> value.toDouble().takeIf { it.isFinite() }?.let { value.toString() } ?: "null"
        else -> JSONObject.quote(value.toString())
    }

    fun failed(reason: FlowFailure, message: String): FlowResult =
        FlowResult.Failed(FlowException(reason, message))

    /** The JSON the JavaScript client reads a presentation's end from. */
    fun encode(result: FlowResult): String {
        val json = when (result) {
            is FlowResult.Finished -> JSONObject()
                .put("status", "finished")
                .put("result", result.result)
                .put("variables", JSONObject(result.variables))
            is FlowResult.Purchased -> JSONObject().put("status", "purchased").put("productSlug", result.productSlug)
            FlowResult.Restored -> JSONObject().put("status", "restored")
            FlowResult.Closed -> JSONObject().put("status", "closed")
            is FlowResult.Failed -> JSONObject()
                .put("status", "failed")
                .put("code", result.error.code)
                .put("message", result.error.message)
        }
        return json.toString()
    }
}
