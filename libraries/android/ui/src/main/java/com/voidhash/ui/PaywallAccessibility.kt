package com.voidhash.ui

import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeProvider
import org.json.JSONException
import org.json.JSONObject

/** One node of the paywall's accessibility tree, in dp relative to the view. */
internal data class SemanticsNode(
    val id: Int,
    val label: String,
    val value: String,
    val hint: String,
    val left: Float,
    val top: Float,
    val width: Float,
    val height: Float,
    val children: List<Int>,
    val actions: Set<String>,
    val isButton: Boolean,
    val isHeader: Boolean,
    val isImage: Boolean,
    val isHidden: Boolean,
    val isEnabled: Boolean,
    val isSelected: Boolean?,
    val liveRegion: String,
) {
    fun contains(x: Float, y: Float) = x >= left && y >= top && x < left + width && y < top + height

    /** Whether a screen reader should stop on this node rather than only pass through it. */
    val isFocusable: Boolean
        get() = !isHidden && (label.isNotEmpty() || "activate" in actions)
}

/** The paywall's accessibility tree: the root first, and announcements to speak. */
internal data class SemanticsTree(val nodes: Map<Int, SemanticsNode>, val rootId: Int?, val announcements: List<String>) {
    val parents: Map<Int, Int> = buildMap {
        for (node in nodes.values) for (child in node.children) put(child, node.id)
    }

    /** The smallest focusable node under a point, as touch exploration expects. */
    fun focusableAt(x: Float, y: Float): SemanticsNode? = nodes.values
        .filter { it.isFocusable && it.contains(x, y) }
        .minByOrNull { it.width * it.height }

    companion object {
        val EMPTY = SemanticsTree(emptyMap(), null, emptyList())

        /** Parses the engine's JSON; a malformed tree reads as empty. */
        fun parse(json: String): SemanticsTree = try {
            val root = JSONObject(json)
            val array = root.getJSONArray("nodes")
            val nodes = LinkedHashMap<Int, SemanticsNode>()
            for (index in 0 until array.length()) {
                val node = array.getJSONObject(index)
                val rect = node.getJSONArray("rect")
                val children = node.getJSONArray("children")
                val actions = node.getJSONArray("actions")
                val id = node.getInt("id")
                nodes[id] = SemanticsNode(
                    id = id,
                    label = node.optString("label"),
                    value = node.optString("value"),
                    hint = node.optString("hint"),
                    left = rect.getDouble(0).toFloat(),
                    top = rect.getDouble(1).toFloat(),
                    width = rect.getDouble(2).toFloat(),
                    height = rect.getDouble(3).toFloat(),
                    children = List(children.length()) { children.getInt(it) },
                    actions = List(actions.length()) { actions.getString(it) }.toSet(),
                    isButton = node.optBoolean("button"),
                    isHeader = node.optBoolean("header"),
                    isImage = node.optBoolean("image"),
                    isHidden = node.optBoolean("hidden"),
                    isEnabled = node.opt("enabled") != false,
                    isSelected = (node.opt("selected") as? Boolean),
                    liveRegion = node.optString("liveRegion", "none"),
                )
            }
            val spoken = root.optJSONArray("announcements")
            val announcements = List(spoken?.length() ?: 0) { spoken!!.getJSONObject(it).optString("message") }
            SemanticsTree(nodes, nodes.keys.firstOrNull(), announcements.filter { it.isNotEmpty() })
        } catch (error: JSONException) {
            EMPTY
        }
    }
}

/**
 * Exposes the natively drawn paywall to TalkBack, Switch Access and UI testing as a tree of
 * virtual views: labels, roles, bounds and actions come from the engine's accessibility tree.
 */
internal class PaywallAccessibility(
    private val host: View,
    private val perform: (nodeId: Int, action: String) -> Boolean,
) : AccessibilityNodeProvider() {
    private var tree = SemanticsTree.EMPTY
    private var focusedId: Int? = null
    private var hoveredId: Int? = null

    /** Adopts a new tree from the engine and tells assistive technology it changed. */
    fun update(json: String) {
        tree = SemanticsTree.parse(json)
        if (focusedId != null && focusedId !in tree.nodes) focusedId = null
        @Suppress("DEPRECATION") // announceForAccessibility is the only pre-API-36 way to speak.
        for (message in tree.announcements) host.announceForAccessibility(message)
        host.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED)
    }

    /** Touch exploration: moves the hover to the node under the finger (coordinates in px). */
    fun hover(xPx: Float, yPx: Float, exit: Boolean) {
        val density = host.resources.displayMetrics.density
        val target = if (exit) null else tree.focusableAt(xPx / density, yPx / density)?.id
        if (target == hoveredId) return
        hoveredId?.let { send(it, AccessibilityEvent.TYPE_VIEW_HOVER_EXIT) }
        hoveredId = target
        target?.let { send(it, AccessibilityEvent.TYPE_VIEW_HOVER_ENTER) }
    }

    override fun createAccessibilityNodeInfo(virtualViewId: Int): AccessibilityNodeInfo? {
        if (virtualViewId == View.NO_ID) {
            val info = newNodeInfo(host, View.NO_ID)
            host.onInitializeAccessibilityNodeInfo(info)
            tree.rootId?.let { root -> focusableDescendants(root).forEach { info.addChild(host, it) } }
            return info
        }
        val node = tree.nodes[virtualViewId] ?: return null
        val info = newNodeInfo(host, virtualViewId)
        info.packageName = host.context.packageName
        info.className = when {
            node.isButton || "activate" in node.actions -> "android.widget.Button"
            node.isImage -> "android.widget.ImageView"
            else -> "android.widget.TextView"
        }
        info.setParent(host, parentOf(virtualViewId) ?: View.NO_ID)
        focusableDescendants(virtualViewId).forEach { info.addChild(host, it) }
        info.contentDescription = node.label.takeIf { it.isNotEmpty() }
        if (node.value.isNotEmpty()) info.text = node.value
        if (node.hint.isNotEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.hintText = node.hint
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isHeading = node.isHeader
        node.isSelected?.let { info.isSelected = it }
        info.isEnabled = node.isEnabled
        info.isVisibleToUser = !node.isHidden
        info.isFocusable = node.isFocusable
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isScreenReaderFocusable = node.isFocusable
        info.liveRegion = when (node.liveRegion) {
            "assertive" -> View.ACCESSIBILITY_LIVE_REGION_ASSERTIVE
            "polite" -> View.ACCESSIBILITY_LIVE_REGION_POLITE
            else -> View.ACCESSIBILITY_LIVE_REGION_NONE
        }
        if ("activate" in node.actions) {
            info.isClickable = true
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK)
        }
        if ("scrollDown" in node.actions || "scrollRight" in node.actions) {
            info.isScrollable = true
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
        }
        if ("scrollUp" in node.actions || "scrollLeft" in node.actions) {
            info.isScrollable = true
            info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
        }
        val focused = focusedId == virtualViewId
        info.isAccessibilityFocused = focused
        info.addAction(
            if (focused) {
                AccessibilityNodeInfo.AccessibilityAction.ACTION_CLEAR_ACCESSIBILITY_FOCUS
            } else {
                AccessibilityNodeInfo.AccessibilityAction.ACTION_ACCESSIBILITY_FOCUS
            },
        )
        val density = host.resources.displayMetrics.density
        val bounds = Rect(
            (node.left * density).toInt(),
            (node.top * density).toInt(),
            ((node.left + node.width) * density).toInt(),
            ((node.top + node.height) * density).toInt(),
        )
        @Suppress("DEPRECATION") // Still read by older services; screen bounds are set below.
        info.setBoundsInParent(bounds)
        val location = IntArray(2)
        host.getLocationOnScreen(location)
        bounds.offset(location[0], location[1])
        info.setBoundsInScreen(bounds)
        return info
    }

    override fun performAction(virtualViewId: Int, action: Int, arguments: Bundle?): Boolean {
        if (virtualViewId == View.NO_ID) return host.performAccessibilityAction(action, arguments)
        tree.nodes[virtualViewId] ?: return false
        return when (action) {
            AccessibilityNodeInfo.ACTION_CLICK -> perform(virtualViewId, "activate").also { performed ->
                if (performed) send(virtualViewId, AccessibilityEvent.TYPE_VIEW_CLICKED)
            }
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> perform(virtualViewId, "scrollDown")
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> perform(virtualViewId, "scrollUp")
            AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS -> {
                if (focusedId == virtualViewId) return false
                focusedId?.let { send(it, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED) }
                focusedId = virtualViewId
                perform(virtualViewId, "didGainFocus")
                send(virtualViewId, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED)
                true
            }
            AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS -> {
                if (focusedId != virtualViewId) return false
                focusedId = null
                perform(virtualViewId, "didLoseFocus")
                send(virtualViewId, AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED)
                true
            }
            else -> false
        }
    }

    private fun parentOf(id: Int): Int? {
        var parent = tree.parents[id]
        while (parent != null) {
            val node = tree.nodes[parent] ?: return null
            if (node.isFocusable) return parent
            parent = tree.parents[parent]
        }
        return null
    }

    /**
     * The nearest focusable nodes below [id]. Plain layout containers are skipped so a screen
     * reader steps through labels and buttons, not the boxes around them.
     */
    private fun focusableDescendants(id: Int): List<Int> {
        val node = tree.nodes[id] ?: return emptyList()
        return node.children.flatMap { child ->
            val childNode = tree.nodes[child] ?: return@flatMap emptyList()
            if (childNode.isHidden) emptyList()
            else if (childNode.isFocusable) listOf(child)
            else focusableDescendants(child)
        }
    }

    private fun send(virtualViewId: Int, type: Int) {
        val parent = host.parent ?: return
        val event = newEvent(type)
        event.packageName = host.context.packageName
        event.setSource(host, virtualViewId)
        tree.nodes[virtualViewId]?.label?.let { event.contentDescription = it }
        parent.requestSendAccessibilityEvent(host, event)
    }
}

@Suppress("DEPRECATION") // The constructors replacing obtain() need API 30.
private fun newNodeInfo(host: View, virtualViewId: Int): AccessibilityNodeInfo = when {
    virtualViewId == View.NO_ID && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> AccessibilityNodeInfo(host)
    virtualViewId == View.NO_ID -> AccessibilityNodeInfo.obtain(host)
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> AccessibilityNodeInfo(host, virtualViewId)
    else -> AccessibilityNodeInfo.obtain(host, virtualViewId)
}

@Suppress("DEPRECATION") // The constructor replacing obtain() needs API 30.
private fun newEvent(type: Int): AccessibilityEvent =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) AccessibilityEvent(type) else AccessibilityEvent.obtain(type)
