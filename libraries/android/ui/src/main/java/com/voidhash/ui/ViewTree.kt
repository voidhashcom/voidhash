package com.voidhash.ui

import android.content.Context
import android.view.View

/**
 * The host's view tree, changed only by view operations (views protocol, "Operation batches").
 * The root, id 0, is the host's container and is never created or deleted.
 */
internal class ViewTree(private val context: Context, private val host: NodeHost?) {
    /** What one batch did that the host acts on after applying it. */
    class Changes {
        /** `screen` views created after the package's first batch: they enter. */
        val enteredScreens = ArrayList<NodeView>()

        /** `screen` views whose `closing` became true: they leave. */
        val closingScreens = ArrayList<NodeView>()

        /** `screen` views deleted by the batch (not by a reset). */
        val deletedScreens = ArrayList<NodeView>()

        /** Operations that broke the protocol's rules, skipped. */
        val issues = ArrayList<String>()

        /** The batch reset the tree. */
        var reset = false
    }

    val root = NodeView(context, 0, NodeKind.VIEW, host)
    private val nodes = HashMap<Int, NodeView>()

    /** The live views by id, without the root. */
    val views: Map<Int, NodeView> get() = nodes

    /** Every `screen` view, in no particular order. */
    val screens: List<NodeView> get() = nodes.values.filter { it.kind == NodeKind.SCREEN }

    /** The package's first batch is applied; screens created later enter. */
    private var showsPackage = false

    /** The field of the latest `TEXT_FOCUS` while it waits for its window's focus. */
    private var focusRequest: TextInputNodeView? = null

    /** The view of [id], the root for 0. */
    fun node(id: Int): NodeView? = if (id == 0) root else nodes[id]

    /** Applies a batch in order, then the changed props and frames. */
    fun apply(operations: List<ViewOperation>): Changes {
        val changes = Changes()
        val dirty = LinkedHashMap<Int, NodeView>()
        // A field that had the keyboard may leave the tree (detached, deleted, reset): the
        // keyboard goes with it, unless a `TEXT_FOCUS` of the batch moved it on.
        val hadKeyboard = root.hasFocus()
        for (operation in operations) {
            when (operation) {
                ViewOperation.Reset -> {
                    focusRequest = null
                    TextInputNodeView.withoutRefocus { for (node in nodes.values) node.detachFromParent() }
                    for (node in nodes.values) (node as? ExternalNodeView)?.disposeComponent()
                    nodes.clear()
                    dirty.clear()
                    root.setChildren(emptyList())
                    showsPackage = false
                    changes.reset = true
                }
                is ViewOperation.Create -> {
                    if (operation.id == 0) {
                        changes.issues.add("the root was created")
                        continue
                    }
                    nodes[operation.id]?.let { existing ->
                        changes.issues.add("view ${operation.id} was created twice")
                        existing.detachFromParent()
                    }
                    val node = make(operation.id, NodeKind.of(operation.kind))
                    nodes[operation.id] = node
                    dirty[operation.id] = node
                    if (node.kind == NodeKind.SCREEN && showsPackage) changes.enteredScreens.add(node)
                }
                is ViewOperation.Props -> {
                    val node = node(operation.id) ?: run {
                        changes.issues.add("props for unknown view ${operation.id}")
                        null
                    } ?: continue
                    val wasClosing = node.props["closing"]?.bool == true
                    node.merge(operation.props)
                    if (node.kind == NodeKind.SCREEN && !wasClosing && node.props["closing"]?.bool == true) {
                        changes.closingScreens.add(node)
                    }
                    dirty[operation.id] = node
                }
                is ViewOperation.Frame -> {
                    val node = node(operation.id) ?: run {
                        changes.issues.add("frame for unknown view ${operation.id}")
                        null
                    } ?: continue
                    node.place(operation.frame)
                    dirty[operation.id] = node
                }
                is ViewOperation.Children -> {
                    val parent = node(operation.id) ?: run {
                        changes.issues.add("children for unknown view ${operation.id}")
                        null
                    } ?: continue
                    val children = ArrayList<NodeView>(operation.children.size)
                    for (childId in operation.children) {
                        val child = if (childId == 0) null else nodes[childId]
                        if (child == null) {
                            changes.issues.add("unknown subview $childId of ${operation.id}")
                        } else {
                            children.add(child)
                        }
                    }
                    TextInputNodeView.withoutRefocus { parent.setChildren(children) }
                }
                is ViewOperation.Delete -> {
                    val node = if (operation.id == 0) null else nodes.remove(operation.id)
                    if (node == null) {
                        changes.issues.add("deleted unknown view ${operation.id}")
                        continue
                    }
                    if (node === focusRequest) focusRequest = null
                    TextInputNodeView.withoutRefocus { node.detachFromParent() }
                    (node as? ExternalNodeView)?.disposeComponent()
                    dirty.remove(operation.id)
                    if (node.kind == NodeKind.SCREEN) changes.deletedScreens.add(node)
                }
                is ViewOperation.Canvas -> {
                    val canvas = nodes[operation.id] as? ExternalNodeView
                    if (canvas == null) {
                        changes.issues.add("canvas for view ${operation.id}, which is not a canvas")
                    } else {
                        canvas.show(operation.drawList, operation.images)
                    }
                }
                is ViewOperation.TextFocus -> {
                    val field = nodes[operation.id] as? TextInputNodeView
                    if (field == null) {
                        changes.issues.add("text focus for view ${operation.id}, which is not a text input")
                        continue
                    }
                    // Its props, the keyboard set-up among them, before it takes the keyboard.
                    dirty.remove(operation.id)?.refresh()
                    if (focusRequest !== field) focusRequest?.cancelFocusRequest()
                    focusRequest = field
                    field.focus()
                }
                is ViewOperation.TextBlur -> {
                    val field = nodes[operation.id] as? TextInputNodeView
                    if (field == null) {
                        changes.issues.add("text blur for view ${operation.id}, which is not a text input")
                        continue
                    }
                    if (focusRequest === field) focusRequest = null
                    field.blur()
                }
                is ViewOperation.TextSet -> {
                    val field = nodes[operation.id] as? TextInputNodeView
                    if (field == null) {
                        // Never the text: it is the end user's.
                        changes.issues.add("text set for view ${operation.id}, which is not a text input")
                        continue
                    }
                    // Styled as its props say before the text arrives.
                    dirty.remove(operation.id)?.refresh()
                    field.apply(operation)
                }
            }
        }
        if (hadKeyboard && !root.hasFocus() && focusRequest?.wantsFocus != true) {
            TextInputNodeView.hideKeyboard(root)
        }
        for (node in dirty.values) node.refresh()
        showsPackage = true
        updateAccessibility()
        return changes
    }

    /** Disposes of every native component shown: the tree's host goes for good. */
    fun disposeComponents() {
        for (node in nodes.values) (node as? ExternalNodeView)?.disposeComponent()
    }

    /** Shows a loaded image in every view that names it. */
    fun imageLoaded(url: String) {
        for (node in nodes.values) node.imageLoaded(url)
    }

    /** Places the root over the host's bounds, given in logical pixels. */
    fun layoutRoot(width: Float, height: Float) {
        root.place(ViewFrame(0f, 0f, width, height))
        root.refresh()
    }

    /**
     * Applies React Native's accessibility rules to the tree: an element is one node to assistive
     * technology and reads its label or its descendants' text, which are then hidden, unless it
     * keeps a developer's component (`accessibilityKeepsComponents`): then the component's views
     * stay nodes after it, and the flow's views under it are read by it; `accessibilityElementsHidden`, hidden and closing views hide their subtree; a view
     * with `accessibilityViewIsModal` hides its siblings; a screen covered by another hides its
     * subtree; a live region reads its text again when it changes. Applied after every batch,
     * and again once screen transitions updated what they cover.
     */
    fun updateAccessibility() {
        update(root, insideElement = false)
    }

    private fun update(node: NodeView, insideElement: Boolean) {
        val props = node.props
        val liveRegion = when (props["accessibilityLiveRegion"]?.string) {
            "polite" -> View.ACCESSIBILITY_LIVE_REGION_POLITE
            "assertive" -> View.ACCESSIBILITY_LIVE_REGION_ASSERTIVE
            else -> View.ACCESSIBILITY_LIVE_REGION_NONE
        }
        if (node.accessibilityLiveRegion != liveRegion) node.accessibilityLiveRegion = liveRegion
        val hidden = node.visibility != View.VISIBLE || props["accessibilityElementsHidden"]?.bool == true ||
            props["closing"]?.bool == true || node.navigation.hiddenFromAccessibility
        if (hidden) {
            node.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            return
        }
        if (node is TextInputNodeView) {
            // The native field is the element, with its own text, label and state.
            node.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            node.contentDescription = null
            return
        }
        val element = !insideElement && node.accessibleElement
        // A text view's links are nodes of their own, and the rest of its text reads in parts
        // around them (see [TextNodeView.LinkProvider]).
        val links = !insideElement && node is TextNodeView && node.pressableRuns.isNotEmpty()
        node.importantForAccessibility = if (element || links) View.IMPORTANT_FOR_ACCESSIBILITY_YES else View.IMPORTANT_FOR_ACCESSIBILITY_NO
        val description = when {
            links -> null
            element || liveRegion != View.ACCESSIBILITY_LIVE_REGION_NONE -> node.spokenText
            else -> props["accessibilityLabel"]?.string
        }
        // Setting it on a live region is what announces the change.
        if (node.contentDescription?.toString() != description) node.contentDescription = description
        val modal = node.childNodes.lastOrNull { it.props["accessibilityViewIsModal"]?.bool == true && it.visibility == View.VISIBLE }
        val hidesSubviews = element && !node.keepsComponents
        for (child in node.childNodes) {
            if (hidesSubviews || modal != null && child !== modal) {
                child.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            } else {
                update(child, insideElement || element)
            }
        }
    }

    private fun make(id: Int, kind: NodeKind): NodeView = when (kind) {
        NodeKind.TEXT -> TextNodeView(context, id, kind, host)
        NodeKind.TEXT_INPUT -> TextInputNodeView(context, id, kind, host)
        NodeKind.IMAGE -> ImageNodeView(context, id, kind, host)
        NodeKind.PATH -> PathNodeView(context, id, kind, host)
        NodeKind.SCROLL_VIEW -> ScrollNodeView(context, id, kind, host)
        NodeKind.EXTERNAL -> ExternalNodeView(context, id, kind, host)
        else -> NodeView(context, id, kind, host)
    }
}
