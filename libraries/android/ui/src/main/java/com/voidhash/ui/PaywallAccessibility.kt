// The text field handling is adapted from the Flutter engine's Android embedder
// (AccessibilityBridge.java in shell/platform/android/io/flutter/view).
// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of the adapted parts is governed by the BSD-style license in THIRD_PARTY_NOTICES.md.

package com.voidhash.ui

import android.content.Context
import android.content.res.Resources
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ClickableSpan
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction
import android.view.accessibility.AccessibilityNodeProvider
import org.json.JSONException
import org.json.JSONObject

/** The range of an adjustable node's number, such as a slider's. */
internal data class ValueRange(val min: Float, val max: Float, val now: Float)

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
    /** A link inside a text: one pressable run of it, an element of its own. */
    val isLink: Boolean = false,
    val isHeader: Boolean,
    val isImage: Boolean,
    val isHidden: Boolean,
    val isEnabled: Boolean,
    val isSelected: Boolean?,
    val liveRegion: String,
    val isTextField: Boolean = false,
    val isMultiline: Boolean = false,
    /** A text field whose text is masked; its [value] is always empty. */
    val isObscured: Boolean = false,
    val isReadOnly: Boolean = false,
    /** Whether a text field has the keyboard. */
    val isFocused: Boolean = false,
    val range: ValueRange? = null,
) {
    fun contains(x: Float, y: Float) = x >= left && y >= top && x < left + width && y < top + height

    /** Whether a screen reader should stop on this node rather than only pass through it. */
    val isFocusable: Boolean
        get() = !isHidden && (label.isNotEmpty() || "activate" in actions || isTextField)

    /** A node whose value steps up and down, such as a slider. */
    val isAdjustable: Boolean
        get() = range != null || "increment" in actions || "decrement" in actions
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

    /** The text field that has the keyboard, if one does. */
    val inputFocused: SemanticsNode? get() = nodes.values.firstOrNull { it.isTextField && it.isFocused }

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
                val range = node.optJSONObject("range")
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
                    isLink = node.optBoolean("link"),
                    isHeader = node.optBoolean("header"),
                    isImage = node.optBoolean("image"),
                    isHidden = node.optBoolean("hidden"),
                    isEnabled = node.opt("enabled") != false,
                    isSelected = (node.opt("selected") as? Boolean),
                    liveRegion = node.optString("liveRegion", "none"),
                    isTextField = node.optBoolean("textField"),
                    isMultiline = node.optBoolean("multiline"),
                    isObscured = node.optBoolean("obscured"),
                    isReadOnly = node.optBoolean("readOnly"),
                    isFocused = node.optBoolean("focused"),
                    range = range?.let {
                        ValueRange(
                            it.getDouble("min").toFloat(),
                            it.getDouble("max").toFloat(),
                            it.getDouble("now").toFloat(),
                        )
                    },
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
 * What Android is told about one virtual view, apart from where it is and what it contains.
 * [actions] are `AccessibilityNodeInfo.ACTION_*` ids; [selection] and [inputType] are known only
 * for the text field that has the keyboard.
 */
internal data class NodeAccess(
    val className: String,
    val text: String?,
    val contentDescription: String?,
    val hintText: String?,
    val isEnabled: Boolean,
    val isClickable: Boolean,
    /** [text] is a link: it reaches Android as a clickable span over all of it. */
    val isLink: Boolean = false,
    val isEditable: Boolean = false,
    val isPassword: Boolean = false,
    val isMultiLine: Boolean = false,
    val isFocused: Boolean = false,
    val selection: Pair<Int, Int>? = null,
    val inputType: Int? = null,
    val movementGranularities: Int = 0,
    val range: ValueRange? = null,
    val actions: List<Int>,
)

/** An accessibility event about one virtual view, built up before it is sent. Indices of -1 are left unset. */
internal data class NodeEvent(
    val type: Int,
    val virtualViewId: Int,
    val text: String? = null,
    val beforeText: String? = null,
    val fromIndex: Int = -1,
    val toIndex: Int = -1,
    val addedCount: Int = -1,
    val removedCount: Int = -1,
    val itemCount: Int = -1,
    val isPassword: Boolean = false,
    val action: Int = 0,
    val movementGranularity: Int = 0,
)

/** What an action Android performs on a node carries in its arguments. */
internal data class ActionArguments(
    val text: CharSequence? = null,
    val selectionStart: Int? = null,
    val selectionEnd: Int? = null,
    val granularity: Int = 0,
    val extendSelection: Boolean = false,
) {
    companion object {
        fun from(bundle: Bundle?): ActionArguments {
            if (bundle == null) return ActionArguments()
            val hasSelection = bundle.containsKey(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT) &&
                bundle.containsKey(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT)
            return ActionArguments(
                text = bundle.getCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE),
                selectionStart = if (hasSelection) bundle.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT) else null,
                selectionEnd = if (hasSelection) bundle.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT) else null,
                granularity = bundle.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT),
                extendSelection = bundle.getBoolean(AccessibilityNodeInfo.ACTION_ARGUMENT_EXTEND_SELECTION_BOOLEAN),
            )
        }
    }
}

private const val TEXT_GRANULARITIES = AccessibilityNodeInfo.MOVEMENT_GRANULARITY_CHARACTER or
    AccessibilityNodeInfo.MOVEMENT_GRANULARITY_WORD or
    AccessibilityNodeInfo.MOVEMENT_GRANULARITY_LINE or
    AccessibilityNodeInfo.MOVEMENT_GRANULARITY_PARAGRAPH

/**
 * Exposes the natively drawn paywall to TalkBack, Switch Access, Voice Access and UI testing as
 * a tree of virtual views: labels, roles, bounds and actions come from the engine's accessibility
 * tree.
 *
 * A text field is an `EditText`. Pressing it gives it the keyboard as a tap does, through the
 * engine and then [textInput]. Its text can be replaced whether or not it has the keyboard; the
 * field that has it also offers its selection, moving through it by character, word and line,
 * and cut, copy and paste, which take the keyboard client's path and its rules (nothing is
 * copied from a masked field). Changes to that field's text and selection are reported as
 * Android's own editors report them.
 *
 * A link inside a text (a pressable run) is a text whose words are one clickable span, as a link
 * in a `TextView` or in Compose text reaches Android: TalkBack says "link" in the reader's own
 * language and lists it among the screen's links. A double tap clicks the node; picking it from
 * TalkBack's links menu clicks the span. Both press the run.
 *
 * @param perform carries out an engine action (`activate`, `focus`, `increment`, …) on a node.
 * @param setText replaces the text of a text field node.
 * @param emit sends an event; the default sends it from [host] while accessibility is on.
 * @param clickSpanAction the action Android performs on a node when a screen reader clicks a
 *   clickable span in its text, `0` where it has none.
 */
internal class PaywallAccessibility(
    private val host: View,
    private val textInput: PaywallTextInput,
    private val perform: (nodeId: Int, action: String) -> Boolean,
    private val setText: (nodeId: Int, text: String) -> Boolean,
    private val emit: (NodeEvent) -> Unit = { event -> sendFrom(host, event) },
    private val clickSpanAction: Int = systemClickSpanAction(),
) : AccessibilityNodeProvider() {
    private var tree = SemanticsTree.EMPTY
    private var focusedId: Int? = null
    private var hoveredId: Int? = null

    /** The text field last reported as having the keyboard. */
    private var inputFocusedId: Int? = null

    /** Adopts a new tree from the engine and tells assistive technology what changed. */
    fun update(json: String) {
        val previous = tree
        tree = SemanticsTree.parse(json)
        if (focusedId != null && focusedId !in tree.nodes) focusedId = null
        @Suppress("DEPRECATION") // announceForAccessibility is the only pre-API-36 way to speak.
        for (message in tree.announcements) host.announceForAccessibility(message)
        host.sendAccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED)

        val inputFocused = tree.inputFocused?.id
        if (inputFocused != null && inputFocused != inputFocusedId) {
            emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED, inputFocused))
        }
        inputFocusedId = inputFocused

        // The node a screen reader is on changed its value: a field whose text was set while it
        // did not have the keyboard (the keyboard client reports the one that has it), or a
        // slider that stepped, which Android's own seek bar announces as selected.
        val id = focusedId ?: return
        val before = previous.nodes[id] ?: return
        val after = tree.nodes.getValue(id)
        if (before.value == after.value) return
        when {
            after.isTextField && !(after.isFocused && textInput.isActive) ->
                textChangedEvent(id, before.value, after.value, password = after.isObscured)?.let(emit)
            !after.isTextField && after.isAdjustable -> emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_SELECTED, id, text = after.value))
        }
    }

    /**
     * The keyboard client's copy of the field that has the keyboard changed, by typing or by the
     * engine: the text and the selection are reported as an `EditText` reports them. A masked
     * field's events say how much changed, never what.
     */
    fun editingStateChanged(previous: TextEditingState, next: TextEditingState) {
        val node = tree.inputFocused ?: return
        val password = node.isObscured
        if (previous.text != next.text) textChangedEvent(node.id, previous.text, next.text, password)?.let(emit)
        if (previous.selectionBase != next.selectionBase || previous.selectionExtent != next.selectionExtent) {
            emit(
                NodeEvent(
                    AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED,
                    node.id,
                    text = next.text.takeUnless { password },
                    fromIndex = next.selectionBase,
                    toIndex = next.selectionExtent,
                    itemCount = next.text.length,
                    isPassword = password,
                ),
            )
        }
    }

    /** Touch exploration: moves the hover to the node under the finger (coordinates in px). */
    fun hover(xPx: Float, yPx: Float, exit: Boolean) {
        val density = host.resources.displayMetrics.density
        val target = if (exit) null else tree.focusableAt(xPx / density, yPx / density)?.id
        if (target == hoveredId) return
        hoveredId?.let { emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_HOVER_EXIT, it)) }
        hoveredId = target
        target?.let { emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_HOVER_ENTER, it)) }
    }

    /** What Android is told about [virtualViewId], or `null` when the tree has no such node. */
    fun describe(virtualViewId: Int): NodeAccess? {
        val node = tree.nodes[virtualViewId] ?: return null
        val actions = mutableListOf<Int>()
        if ("activate" in node.actions) actions += AccessibilityNodeInfo.ACTION_CLICK
        if ("scrollDown" in node.actions || "scrollRight" in node.actions || "increment" in node.actions) {
            actions += AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        }
        if ("scrollUp" in node.actions || "scrollLeft" in node.actions || "decrement" in node.actions) {
            actions += AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        }
        actions += if (focusedId == virtualViewId) {
            AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS
        } else {
            AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS
        }
        if (node.isLink) {
            return NodeAccess(
                className = "android.widget.TextView",
                text = node.label.ifEmpty { node.value }.takeIf { it.isNotEmpty() },
                // A content description would be read in place of the text and its link.
                contentDescription = null,
                hintText = node.hint.takeIf { it.isNotEmpty() },
                isEnabled = node.isEnabled,
                isClickable = "activate" in node.actions,
                isLink = true,
                actions = actions,
            )
        }
        if (!node.isTextField) {
            return NodeAccess(
                className = when {
                    node.isAdjustable -> "android.widget.SeekBar"
                    node.isButton || "activate" in node.actions -> "android.widget.Button"
                    node.isImage -> "android.widget.ImageView"
                    else -> "android.widget.TextView"
                },
                text = node.value.takeIf { it.isNotEmpty() },
                contentDescription = node.label.takeIf { it.isNotEmpty() },
                hintText = node.hint.takeIf { it.isNotEmpty() },
                isEnabled = node.isEnabled,
                isClickable = "activate" in node.actions,
                range = node.range,
                actions = actions,
            )
        }

        // A text field speaks its text and is named by its hint, as an EditText is.
        val editing = editingStateOf(node)
        val password = node.isObscured
        val editable = !node.isReadOnly && node.isEnabled
        if ("focus" in node.actions && !node.isFocused) actions += AccessibilityNodeInfo.ACTION_FOCUS
        if (node.isFocused && textInput.isActive) actions += AccessibilityNodeInfo.ACTION_CLEAR_FOCUS
        if ("setText" in node.actions) actions += AccessibilityNodeInfo.ACTION_SET_TEXT
        var granularities = 0
        if (editing != null) {
            actions += AccessibilityNodeInfo.ACTION_SET_SELECTION
            if (!password && editing.text.isNotEmpty()) {
                granularities = TEXT_GRANULARITIES
                actions += AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY
                actions += AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY
            }
            if (!password && editing.selectionStart != editing.selectionEnd) {
                actions += AccessibilityNodeInfo.ACTION_COPY
                if (editable) actions += AccessibilityNodeInfo.ACTION_CUT
            }
            if (editable) actions += AccessibilityNodeInfo.ACTION_PASTE
        }
        val text = if (password) null else editing?.text ?: node.value
        return NodeAccess(
            className = "android.widget.EditText",
            text = text?.takeIf { it.isNotEmpty() },
            contentDescription = null,
            hintText = listOf(node.label, node.hint).filter { it.isNotEmpty() }.joinToString(", ").takeIf { it.isNotEmpty() },
            isEnabled = node.isEnabled,
            isClickable = "activate" in node.actions,
            isEditable = editable,
            isPassword = password,
            isMultiLine = node.isMultiline,
            isFocused = node.isFocused,
            selection = editing?.takeUnless { password }?.let { it.selectionStart to it.selectionEnd },
            inputType = editing?.let { textInput.config?.inputType },
            movementGranularities = granularities,
            actions = actions,
        )
    }

    override fun createAccessibilityNodeInfo(virtualViewId: Int): AccessibilityNodeInfo? {
        if (virtualViewId == View.NO_ID) {
            val info = newNodeInfo(host, View.NO_ID)
            host.onInitializeAccessibilityNodeInfo(info)
            tree.rootId?.let { root -> focusableDescendants(root).forEach { info.addChild(host, it) } }
            return info
        }
        val node = tree.nodes[virtualViewId] ?: return null
        val access = describe(virtualViewId) ?: return null
        val info = newNodeInfo(host, virtualViewId)
        info.packageName = host.context.packageName
        info.className = access.className
        info.setParent(host, parentOf(virtualViewId) ?: View.NO_ID)
        focusableDescendants(virtualViewId).forEach { info.addChild(host, it) }
        info.contentDescription = access.contentDescription
        access.text?.let { text ->
            info.text = if (access.isLink) linkText(virtualViewId, text) else text
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            access.hintText?.let { info.hintText = it }
        } else if (node.isTextField) {
            // Without hint text, a field is named the way a view without text is.
            info.contentDescription = access.hintText
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isHeading = node.isHeader
        node.isSelected?.let { info.isSelected = it }
        info.isEnabled = access.isEnabled
        info.isVisibleToUser = !node.isHidden
        info.isFocusable = node.isFocusable
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.isScreenReaderFocusable = node.isFocusable
        info.isClickable = access.isClickable
        if (node.isTextField) {
            info.isEditable = access.isEditable
            info.isPassword = access.isPassword
            info.isMultiLine = access.isMultiLine
            info.isFocused = access.isFocused
            access.selection?.let { (start, end) -> info.setTextSelection(start, end) }
            access.inputType?.let { info.inputType = it }
            info.movementGranularities = access.movementGranularities
        }
        access.range?.let { range ->
            info.rangeInfo = newRangeInfo(range)
        }
        info.liveRegion = when (node.liveRegion) {
            "assertive" -> View.ACCESSIBILITY_LIVE_REGION_ASSERTIVE
            "polite" -> View.ACCESSIBILITY_LIVE_REGION_POLITE
            else -> View.ACCESSIBILITY_LIVE_REGION_NONE
        }
        // A slider steps with the scroll actions, as Android's seek bar does, without scrolling.
        info.isScrollable = !node.isAdjustable && (
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in access.actions ||
                AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD in access.actions
            )
        info.isAccessibilityFocused = focusedId == virtualViewId
        for (action in access.actions) info.addAction(standardAction(action))
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

    // A screen reader asks where the input focus is to follow typing into the field.
    override fun findFocus(focus: Int): AccessibilityNodeInfo? {
        val id = when (focus) {
            AccessibilityNodeInfo.FOCUS_INPUT -> tree.inputFocused?.id
            AccessibilityNodeInfo.FOCUS_ACCESSIBILITY -> focusedId
            else -> null
        } ?: return null
        return createAccessibilityNodeInfo(id)
    }

    override fun performAction(virtualViewId: Int, action: Int, arguments: Bundle?): Boolean {
        if (virtualViewId == View.NO_ID) return host.performAccessibilityAction(action, arguments)
        return perform(virtualViewId, action, ActionArguments.from(arguments))
    }

    /** Carries out [action] (an `AccessibilityNodeInfo.ACTION_*` id) on a node of the tree. */
    fun perform(virtualViewId: Int, action: Int, arguments: ActionArguments): Boolean {
        val node = tree.nodes[virtualViewId] ?: return false
        if (action != 0 && action == clickSpanAction) {
            return node.isLink && perform(virtualViewId, AccessibilityNodeInfo.ACTION_CLICK, arguments)
        }
        return when (action) {
            AccessibilityNodeInfo.ACTION_CLICK -> perform(virtualViewId, "activate").also { performed ->
                if (performed) emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_CLICKED, virtualViewId))
            }
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD ->
                firstOffered(node, "scrollDown", "scrollRight", "increment")?.let { perform(virtualViewId, it) } ?: false
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD ->
                firstOffered(node, "scrollUp", "scrollLeft", "decrement")?.let { perform(virtualViewId, it) } ?: false
            AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS -> {
                if (focusedId == virtualViewId) return false
                focusedId?.let { emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED, it)) }
                focusedId = virtualViewId
                perform(virtualViewId, "didGainFocus")
                emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED, virtualViewId))
                true
            }
            AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS -> {
                if (focusedId != virtualViewId) return false
                focusedId = null
                perform(virtualViewId, "didLoseFocus")
                emit(NodeEvent(AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED, virtualViewId))
                true
            }
            AccessibilityNodeInfo.ACTION_FOCUS -> "focus" in node.actions && perform(virtualViewId, "focus")
            AccessibilityNodeInfo.ACTION_CLEAR_FOCUS -> {
                if (!node.isTextField || !node.isFocused || !textInput.isActive) return false
                textInput.blur()
                true
            }
            // Android clears the text when the action carries none.
            AccessibilityNodeInfo.ACTION_SET_TEXT ->
                "setText" in node.actions && setText(virtualViewId, arguments.text?.toString().orEmpty())
            AccessibilityNodeInfo.ACTION_SET_SELECTION -> {
                val editing = editingStateOf(node) ?: return false
                val start = arguments.selectionStart
                val end = arguments.selectionEnd
                // Without a range the selection collapses where it ends.
                if (start != null && end != null) {
                    textInput.select(start, end)
                } else {
                    textInput.select(editing.selectionExtent, editing.selectionExtent)
                }
                true
            }
            AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY,
            AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY -> {
                val editing = editingStateOf(node)?.takeUnless { node.isObscured } ?: return false
                val forward = action == AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY
                val moved = editing.movedBy(arguments.granularity, forward, arguments.extendSelection)
                if (moved == editing) return false
                emit(
                    NodeEvent(
                        AccessibilityEvent.TYPE_VIEW_TEXT_TRAVERSED_AT_MOVEMENT_GRANULARITY,
                        virtualViewId,
                        text = editing.text,
                        fromIndex = minOf(editing.selectionExtent, moved.selectionExtent),
                        toIndex = maxOf(editing.selectionExtent, moved.selectionExtent),
                        itemCount = editing.text.length,
                        action = action,
                        movementGranularity = arguments.granularity,
                    ),
                )
                textInput.select(moved.selectionBase, moved.selectionExtent)
                true
            }
            AccessibilityNodeInfo.ACTION_COPY -> editingStateOf(node) != null && textInput.contextMenuAction(android.R.id.copy)
            AccessibilityNodeInfo.ACTION_CUT ->
                editingStateOf(node) != null && !node.isReadOnly && textInput.contextMenuAction(android.R.id.cut)
            AccessibilityNodeInfo.ACTION_PASTE ->
                editingStateOf(node) != null && !node.isReadOnly && textInput.contextMenuAction(android.R.id.paste)
            else -> false
        }
    }

    /**
     * The keyboard client's copy of [node]'s editing state, when [node] is the text field that has
     * the keyboard. The tree names the field, the client holds its text and selection.
     */
    private fun editingStateOf(node: SemanticsNode): TextEditingState? =
        if (node.isTextField && node.isFocused && textInput.isActive) textInput.state else null

    private fun firstOffered(node: SemanticsNode, vararg actions: String): String? = actions.firstOrNull { it in node.actions }

    /**
     * [text] as one clickable span. A screen reader in another process gets Android's stand-in
     * for the span, whose click comes back as [clickSpanAction]; the span's own click is for one
     * in this process.
     */
    private fun linkText(virtualViewId: Int, text: String): CharSequence = SpannableString(text).apply {
        val span = object : ClickableSpan() {
            override fun onClick(widget: View) {
                perform(virtualViewId, AccessibilityNodeInfo.ACTION_CLICK, ActionArguments())
            }
        }
        setSpan(span, 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
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

    /**
     * `TYPE_VIEW_TEXT_CHANGED` from [before] to [after]: the changed span between their common
     * start and end, or `null` when nothing changed.
     */
    private fun textChangedEvent(id: Int, before: String, after: String, password: Boolean): NodeEvent? {
        var first = 0
        while (first < before.length && first < after.length && before[first] == after[first]) first++
        if (first >= before.length && first >= after.length) return null
        var beforeLast = before.length - 1
        var afterLast = after.length - 1
        while (beforeLast >= first && afterLast >= first && before[beforeLast] == after[afterLast]) {
            beforeLast--
            afterLast--
        }
        return NodeEvent(
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED,
            id,
            text = after.takeUnless { password },
            beforeText = before.takeUnless { password },
            fromIndex = first,
            removedCount = beforeLast - first + 1,
            addedCount = afterLast - first + 1,
            itemCount = after.length,
            isPassword = password,
        )
    }

    private companion object {
        /**
         * The framework's action for clicking a clickable span of a node's text
         * (`R.id.accessibilityActionClickOnClickableSpan`, API 26): not in the public API, so it
         * is looked up by name; `0` where the framework has none.
         */
        @android.annotation.SuppressLint("DiscouragedApi")
        fun systemClickSpanAction(): Int =
            Resources.getSystem()?.getIdentifier("accessibilityActionClickOnClickableSpan", "id", "android") ?: 0

        /** Sends [event] from [host] while accessibility is on; Android refuses events otherwise. */
        fun sendFrom(host: View, event: NodeEvent) {
            val manager = host.context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            if (manager?.isEnabled != true) return
            val parent = host.parent ?: return
            val sent = newEvent(event.type)
            sent.packageName = host.context.packageName
            sent.setSource(host, event.virtualViewId)
            event.text?.let { sent.text.add(it) }
            event.beforeText?.let { sent.beforeText = it }
            if (event.fromIndex >= 0) sent.fromIndex = event.fromIndex
            if (event.toIndex >= 0) sent.toIndex = event.toIndex
            if (event.addedCount >= 0) sent.addedCount = event.addedCount
            if (event.removedCount >= 0) sent.removedCount = event.removedCount
            if (event.itemCount >= 0) sent.itemCount = event.itemCount
            sent.isPassword = event.isPassword
            if (event.action != 0) sent.action = event.action
            if (event.movementGranularity != 0) sent.movementGranularity = event.movementGranularity
            parent.requestSendAccessibilityEvent(host, sent)
        }
    }
}

/**
 * Where moving the caret by [granularity] (`AccessibilityNodeInfo.MOVEMENT_GRANULARITY_*`) takes
 * the selection, as an `EditText` moves it for a screen reader: its extent moves, and its base
 * follows unless the selection is extended. An unknown granularity moves nothing.
 */
internal fun TextEditingState.movedBy(granularity: Int, forward: Boolean, extend: Boolean): TextEditingState {
    val extent = selectionExtent
    val next = when (granularity) {
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_CHARACTER ->
            if (forward) minOf(extent + 1, text.length) else maxOf(extent - 1, 0)
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_WORD -> if (forward) {
            // The end of the word the caret is in, or of the next one: a letter followed by a
            // word boundary.
            Regex("\\p{L}(\\b)").find(text.substring(extent))?.groups?.get(1)?.range?.first?.let { extent + it } ?: text.length
        } else {
            Regex("(?s:.*)(\\b)\\p{L}").find(text.substring(0, extent))?.groups?.get(1)?.range?.first ?: extent
        }
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_LINE -> if (forward) {
            Regex("(?!^)(\\n)").find(text.substring(extent))?.groups?.get(1)?.range?.first?.let { extent + it } ?: text.length
        } else {
            Regex("(?s:.*)(\\n)").find(text.substring(0, extent))?.groups?.get(1)?.range?.first ?: 0
        }
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_PARAGRAPH,
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_PAGE -> if (forward) text.length else 0
        else -> extent
    }
    return copy(selectionBase = if (extend) selectionBase else next, selectionExtent = next)
}

private fun standardAction(id: Int): AccessibilityAction = when (id) {
    AccessibilityNodeInfo.ACTION_CLICK -> AccessibilityAction.ACTION_CLICK
    AccessibilityNodeInfo.ACTION_FOCUS -> AccessibilityAction.ACTION_FOCUS
    AccessibilityNodeInfo.ACTION_CLEAR_FOCUS -> AccessibilityAction.ACTION_CLEAR_FOCUS
    AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> AccessibilityAction.ACTION_SCROLL_FORWARD
    AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> AccessibilityAction.ACTION_SCROLL_BACKWARD
    AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS -> AccessibilityAction.ACTION_ACCESSIBILITY_FOCUS
    AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS -> AccessibilityAction.ACTION_CLEAR_ACCESSIBILITY_FOCUS
    AccessibilityNodeInfo.ACTION_SET_TEXT -> AccessibilityAction.ACTION_SET_TEXT
    AccessibilityNodeInfo.ACTION_SET_SELECTION -> AccessibilityAction.ACTION_SET_SELECTION
    AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY -> AccessibilityAction.ACTION_NEXT_AT_MOVEMENT_GRANULARITY
    AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY -> AccessibilityAction.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY
    AccessibilityNodeInfo.ACTION_COPY -> AccessibilityAction.ACTION_COPY
    AccessibilityNodeInfo.ACTION_CUT -> AccessibilityAction.ACTION_CUT
    AccessibilityNodeInfo.ACTION_PASTE -> AccessibilityAction.ACTION_PASTE
    else -> AccessibilityAction(id, null)
}

@Suppress("DEPRECATION") // The constructors replacing obtain() need API 30.
private fun newNodeInfo(host: View, virtualViewId: Int): AccessibilityNodeInfo = when {
    virtualViewId == View.NO_ID && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> AccessibilityNodeInfo(host)
    virtualViewId == View.NO_ID -> AccessibilityNodeInfo.obtain(host)
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> AccessibilityNodeInfo(host, virtualViewId)
    else -> AccessibilityNodeInfo.obtain(host, virtualViewId)
}

@Suppress("DEPRECATION") // The constructor replacing obtain() needs API 30.
private fun newRangeInfo(range: ValueRange): AccessibilityNodeInfo.RangeInfo =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        AccessibilityNodeInfo.RangeInfo(AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_FLOAT, range.min, range.max, range.now)
    } else {
        AccessibilityNodeInfo.RangeInfo.obtain(AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_FLOAT, range.min, range.max, range.now)
    }

@Suppress("DEPRECATION") // The constructor replacing obtain() needs API 30.
private fun newEvent(type: Int): AccessibilityEvent =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) AccessibilityEvent(type) else AccessibilityEvent.obtain(type)
