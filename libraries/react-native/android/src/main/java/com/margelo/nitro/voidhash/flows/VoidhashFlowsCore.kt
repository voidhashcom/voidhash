package com.margelo.nitro.voidhash.flows

import com.margelo.nitro.core.Promise
import com.voidhash.sdk.FlowActionHandler
import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.paywall.PaywallRenderer
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the React Native client needs around the native client's flows: the renderer the app
 * compiled in, the values a flow exchanges with JavaScript, and a flow's end as the JSON
 * `presentFlow` answers with (`VoidhashNativeClient.nitro.ts`). Presenting is the native
 * client's own.
 */
internal object VoidhashFlowsCore {
    /**
     * The `ui` module's renderer when the app compiles it in, found without naming it. With
     * [runtimeModules], it draws flows with the flow runtime module each flow names.
     */
    fun linkedRenderer(runtimeModules: Boolean = false): PaywallRenderer? =
        try {
            val renderer = Class.forName("com.voidhash.ui.VoidhashUiPaywallRenderer")
            if (runtimeModules) {
                val mode = Class.forName("com.voidhash.ui.VoidhashUiPaywallRenderer\$RuntimeMode")
                renderer.getMethod("setRuntimeMode", mode).invoke(null, mode.getField("MODULE").get(null))
            }
            renderer.getDeclaredConstructor().newInstance() as? PaywallRenderer
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

    fun failed(reason: FlowFailure, message: String) = FlowException(reason, message)

    /** The JSON the JavaScript client reads a presentation's end from. */
    fun encode(result: FlowResult): String {
        val json = JSONObject().put("outcome", result.outcome).put("output", JSONObject(result.output))
        result.productId?.let { json.put("productId", it) }
        return json.toString()
    }

    /** The JSON the JavaScript client reads a flow that could not be presented from. */
    fun encode(failure: FlowException): String =
        JSONObject()
            .put("failure", JSONObject().put("code", failure.code).put("message", failure.message))
            .toString()

    /**
     * A handler for each of the app actions [names] lists, which asks JavaScript through
     * [onAction]: the arguments go as a JSON object and the reply comes back as one. A call
     * JavaScript rejects fails the handler, which the coordinator answers the flow for.
     */
    fun actionHandlers(
        names: Array<String>,
        onAction: (name: String, argsJson: String) -> Promise<Promise<String>>,
    ): Map<String, FlowActionHandler> = names.associateWith { name ->
        FlowActionHandler { arguments ->
            flowValues(onAction(name, JSONObject(arguments).toString()).await().await())
        }
    }

    /**
     * The values a JSON object from the JavaScript client holds, by name: a flow's inputs, or
     * the arguments or the reply of an app action. A `null` is left out, and an array is read
     * as a list; what is not a string, number, boolean or list of strings is the coordinator's
     * to refuse.
     */
    fun flowValues(json: String): Map<String, Any> {
        val parsed = JSONObject(json)
        return parsed.keys().asSequence()
            .filterNot(parsed::isNull)
            .associateWith { name ->
                when (val value = parsed.get(name)) {
                    is JSONArray -> (0 until value.length()).map(value::get)
                    else -> value
                }
            }
    }
}
