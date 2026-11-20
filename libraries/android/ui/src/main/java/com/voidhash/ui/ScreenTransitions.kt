@file:OptIn(ExperimentalNativeComponents::class)

package com.voidhash.ui

import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Moves `screen` views in and out (views protocol, "Navigation"), inside the view that hosts the
 * tree. The host hands it every screen that enters, starts closing or is deleted, and lets it
 * update after every batch; it reports `transitionEnd` when a closing transition calls back, and
 * `dismissed` through [onDismissed].
 *
 * Every screen has a progress ([ScreenMotion]): `0` off screen, `1` presented, a sheet's detent
 * in between. [apply] writes what the progress shown now means into the views (the screen or its
 * presentation's stack, the backdrop, the screen beneath, shared element flights). An animation
 * moves it with a [SpringMotion] towards a target on the display's frames; a drag or the
 * predictive back gesture sets it directly. An interruption goes on from the progress and
 * velocity shown, so animations and gestures hand over to each other at any time.
 */
internal class TransitionCoordinator(private val container: ViewGroup) {
    /** Called when the end user dismissed a screen by a drag or a tap on its backdrop. */
    var onDismissed: ((NodeView) -> Unit)? = null

    /** Whether to cross-fade instead of moving: Remove animations is on. Read when a transition starts. */
    var reduceMotion: () -> Boolean = { reducedMotion(container.context) }

    /** Whether a screen was pushed or presented, so back has something to close. */
    var canGoBack = false
        private set

    private val states = HashMap<Int, ScreenState>()
    private val gestures = HashMap<Int, ScreenGestures>()

    /** Where shared elements fly, above the tree; added to [container] on first use. */
    private val flightLayer by lazy { FlightLayer(container) }

    /** The screen the predictive back gesture moves. */
    private var backGesture: ScreenState? = null

    /** The screen that came to the front, which assistive technology moves to after the batch. */
    private var focusTarget: NodeView? = null

    private var framePosted = false
    private val frameCallback = Choreographer.FrameCallback { frameTimeNanos ->
        framePosted = false
        step(frameTimeNanos / 1_000_000_000.0)
    }

    /** A spring running a screen's progress towards [motion]'s target; it starts on the first frame it is stepped. */
    private class Animation(val motion: SpringMotion, val completion: () -> Unit) {
        var start: Double? = null
    }

    /** One screen's transition state. */
    private class ScreenState(val screen: NodeView, progress: Float) {
        /** The progress the views show once any running animation ends. */
        var progress = progress

        /** The progress the views show now. */
        var shown = progress

        /** Progress per second shown now. */
        var velocity = 0f

        /** The detent a sheet rests at or is heading to. */
        var detent: Int? = null

        /** Where a reduced-motion cross-fade holds the screen. */
        var crossFade: Float? = null
        var animation: Animation? = null

        /** A drag or the predictive back gesture holds the screen, grabbed at this progress. */
        var dragBaseline: Float? = null

        /** The predictive back gesture completed on the screen: it waits where it was let go for the flow's answer. */
        var heldForBack: Float? = null

        /** The pending `transitionEnd` of a closing screen. */
        var leaving: (() -> Unit)? = null

        /** The screen is gone: dismissed by the end user, or closing. */
        var gone = false
        val flights = ArrayList<SharedElementFlight>()
    }

    /**
     * How [screen] moves: mirrored horizontally when the flow lays it out right to left, whatever
     * the device's direction (views protocol, "Layout direction").
     */
    fun screenMotion(screen: NodeView): ScreenMotion = ScreenMotion.of(screen.props, screen.props["layoutDirection"]?.string == "rtl")

    // region Screens entering and leaving

    /** [screen] was created after the package's first frame: bring it in. */
    fun enter(screen: NodeView) {
        val motion = screenMotion(screen)
        // A stack's first screen moves with its presentation.
        if (!motion.kind.isPresentation && isStackRoot(screen)) return
        focusTarget = focusTargetOf(screen)
        if (motion.kind == ScreenMotion.Kind.NONE) return
        val state = state(screen)
        val geometry = geometry(screen)
        val rest = motion.rest(geometry)
        state.detent = if (motion.kind.isPresentation) motion.initialSnapIndex else null
        state.progress = 0f
        state.shown = 0f
        state.velocity = 0f
        if (reduceMotion()) state.crossFade = rest else startFlights(state)
        apply(state)
        animate(state, rest, motion.open, 0f) {
            state.crossFade = null
            // The content may have changed size while the screen entered.
            state.progress = screenMotion(state.screen).rest(geometry(state.screen), state.detent)
            state.shown = state.progress
            endFlights(state)
            apply(state)
        }
    }

    /** [screen] is closing: take it out, then call [completion], exactly once. The core deletes it afterwards. */
    fun leave(screen: NodeView, completion: () -> Unit) {
        val motion = screenMotion(screen)
        val state = state(screen)
        state.leaving?.let { pending ->
            // Closing twice still ends once.
            state.leaving = null
            pending()
        }
        state.gone = true
        state.heldForBack = null
        below(screen)?.let { focusTarget = focusTargetOf(it) }
        abandonDrag(screen)
        if (motion.kind == ScreenMotion.Kind.NONE || (isStackRoot(screen) && !motion.kind.isPresentation)) {
            stopAnimation(state)
            completion()
            return
        }
        state.leaving = completion
        if (reduceMotion()) state.crossFade = state.crossFade ?: state.shown else startFlights(state)
        animate(state, 0f, motion.close, null) {
            endFlights(state)
            val leaving = state.leaving
            state.leaving = null
            leaving?.invoke()
        }
    }

    /** [screen] was deleted: whatever it was doing ends now. */
    fun remove(screen: NodeView) {
        gestures.remove(screen.nodeId)?.uninstall()
        val state = states[screen.nodeId]?.takeIf { it.screen === screen } ?: return
        states.remove(screen.nodeId)
        state.animation = null
        endFlights(state)
        val leaving = state.leaving
        state.leaving = null
        leaving?.invoke()
    }

    /** The tree was reset: every screen went without a transition. */
    fun reset() {
        for (state in states.values) endFlights(state)
        for (gesture in gestures.values) gesture.uninstall()
        states.clear()
        gestures.clear()
        canGoBack = false
        focusTarget = null
        backGesture = null
    }

    /** A batch was applied; [screens] are every `screen` view of the tree. */
    fun update(screens: Collection<NodeView>) {
        val stacks = LinkedHashSet<NodeView>()
        for (screen in screens) {
            screen.parentNode?.let(stacks::add)
            installGestures(screen)
        }
        var backable = false
        for (stack in stacks) {
            val stacked = stack.childNodes.filter { it.kind == NodeKind.SCREEN }
            for ((index, screen) in stacked.withIndex()) {
                val state = state(screen)
                // At rest, a sheet follows its detent as its content or the viewport changes size.
                if (state.animation == null && state.dragBaseline == null && state.heldForBack == null && !state.gone) {
                    state.progress = screenMotion(screen).rest(geometry(screen), state.detent)
                    state.shown = state.progress
                }
                apply(state)
                val above = stacked.subList(index + 1, stacked.size).filter { !isGone(it) }
                // A sheet or dialog leaves the screen beneath readable, unless its backdrop
                // blocks touches to it.
                val hidden = above.any {
                    val motion = screenMotion(it)
                    !motion.kind.leavesBelowVisible || motion.backdropBlocks
                }
                val covered = above.isNotEmpty() || isGone(screen)
                screen.setNavigation { copy(covered = covered, hiddenFromAccessibility = hidden) }
            }
            backable = backable || stacked.any { !isGone(it) && (screenMotion(it).kind.isPresentation || !isStackRoot(it)) }
        }
        canGoBack = backable
    }

    /**
     * Moves assistive technology to the screen that came to the front in the last batch: to the
     * first element in it. Called once the tree's accessibility is up to date.
     */
    fun moveAccessibilityFocus() {
        val target = focusTarget ?: return
        focusTarget = null
        val pending = ArrayDeque(listOf<NodeView>(target))
        while (pending.isNotEmpty()) {
            val node = pending.removeFirst()
            if (node.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS) continue
            if (node.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_YES) {
                node.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
                return
            }
            pending.addAll(0, node.childNodes)
        }
    }

    // endregion

    // region Drags

    /** A drag on [screen] starts. Returns whether it may move it. */
    fun beginDrag(screen: NodeView): Boolean {
        val motion = screenMotion(screen)
        val state = live(screen) ?: return false
        if (!motion.draggable || state.dragBaseline != null) return false
        stopAnimation(state)
        state.crossFade = null
        state.dragBaseline = state.shown
        if (!reduceMotion()) startFlights(state)
        apply(state)
        return true
    }

    /**
     * Whether a presentation rests, or is dragged, below its highest detent: a drag up in its
     * content expands it before the content scrolls.
     */
    fun canExpand(screen: NodeView): Boolean {
        val motion = screenMotion(screen)
        if (!motion.kind.isPresentation) return false
        val state = live(screen) ?: return false
        val highest = motion.detentProgress(geometry(screen)).maxOrNull() ?: return false
        return state.shown < highest - 0.001f
    }

    /** The finger moved [translation] logical pixels towards dismissal since the drag began. */
    fun drag(screen: NodeView, translation: Float) {
        val state = dragging(screen) ?: return
        val baseline = state.dragBaseline ?: return
        state.progress = screenMotion(screen).dragged(baseline, translation, geometry(screen))
        state.shown = state.progress
        apply(state)
    }

    /**
     * The finger lifted, moving [velocity] logical pixels per second towards dismissal: the screen
     * settles at a detent, back where it was, or goes and is reported dismissed.
     */
    fun endDrag(screen: NodeView, velocity: Float) {
        val state = dragging(screen) ?: return
        state.dragBaseline = null
        val motion = screenMotion(screen)
        val geometry = geometry(screen)
        val speed = -velocity / geometry.extent(motion.kind)
        val target = motion.release(state.shown, speed, geometry) ?: return dismiss(state, speed)
        if (motion.kind.isPresentation) state.detent = motion.detentProgress(geometry).indexOf(target).takeIf { it >= 0 }
        val spring = if (target >= state.shown) motion.open else motion.close
        animate(state, target, spring, speed) { endFlights(state) }
    }

    /** The system took the touch away: the screen goes back where it was grabbed. */
    fun cancelDrag(screen: NodeView) {
        val state = dragging(screen) ?: return
        val baseline = state.dragBaseline ?: return
        state.dragBaseline = null
        animate(state, baseline, screenMotion(screen).open, 0f) { endFlights(state) }
    }

    /** A tap on a presentation's backdrop: a sheet or dialog that allows it leaves. */
    fun backdropTapped(screen: NodeView) {
        if (!allowsBackdropDismiss(screen)) return
        val state = states[screen.nodeId] ?: return
        stopAnimation(state)
        state.dragBaseline = null
        if (!reduceMotion()) startFlights(state)
        dismiss(state, 0f)
    }

    fun allowsBackdropDismiss(screen: NodeView): Boolean {
        val motion = screenMotion(screen)
        return motion.kind.isPresentation && motion.backdropDismisses && live(screen) != null
    }

    private fun dismiss(state: ScreenState, velocity: Float) {
        animate(state, 0f, screenMotion(state.screen).close, velocity) {
            state.gone = true
            endFlights(state)
            onDismissed?.invoke(state.screen)
        }
    }

    /** The state of [screen] while it is shown and not on its way out. */
    private fun live(screen: NodeView): ScreenState? {
        if (screen.props["closing"]?.bool == true) return null
        val state = states[screen.nodeId]?.takeIf { it.screen === screen } ?: return null
        return state.takeIf { !it.gone && it.leaving == null }
    }

    private fun dragging(screen: NodeView): ScreenState? =
        states[screen.nodeId]?.takeIf { it.screen === screen && it.dragBaseline != null }

    /** Ends a drag the screen no longer takes, without settling it. */
    private fun abandonDrag(screen: NodeView) {
        states[screen.nodeId]?.dragBaseline = null
        gestures[screen.nodeId]?.cancel()
    }

    private fun installGestures(screen: NodeView) {
        if (gestures[screen.nodeId]?.screen === screen) return
        // Back is the platform's; only presentations are dragged and tapped away.
        if (!screenMotion(screen).kind.isPresentation) return
        gestures[screen.nodeId] = ScreenGestures(screen, this)
    }

    // endregion

    // region Predictive back

    /**
     * The predictive back gesture started: the screen a `back` closes, when it may be swiped
     * away, follows the gesture from where it is. Returns whether one does.
     */
    fun startBack(): Boolean {
        val screen = backTarget() ?: return false
        val state = live(screen) ?: return false
        if (!screenMotion(screen).gestureEnabled || state.dragBaseline != null) return false
        stopAnimation(state)
        state.heldForBack = null
        state.dragBaseline = state.shown
        backGesture = state
        if (reduceMotion()) state.crossFade = state.shown else startFlights(state)
        apply(state)
        return true
    }

    /** The gesture is [fraction] of the way (`0` to `1`): the screen is that much of the way out. */
    fun progressBack(fraction: Float) {
        val state = backState() ?: return
        val baseline = state.dragBaseline ?: return
        state.progress = baseline * (1 - fraction.coerceIn(0f, 1f))
        state.shown = state.progress
        apply(state)
    }

    /** The gesture was cancelled: the screen goes back where it was. */
    fun cancelBack() {
        val state = backState() ?: return
        val baseline = state.dragBaseline ?: return
        state.dragBaseline = null
        backGesture = null
        animate(state, baseline, screenMotion(state.screen).open, 0f) {
            state.crossFade = null
            endFlights(state)
            apply(state)
        }
    }

    /**
     * The gesture completed, and the host posts `back`: the screen waits where it was let go
     * until the flow answers. Closing it takes it out from there ([leave]); [backAnswered]
     * returns it otherwise.
     */
    fun commitBack() {
        val state = backState() ?: return
        state.heldForBack = state.dragBaseline
        state.dragBaseline = null
        backGesture = null
    }

    /**
     * The flow handled the `back` posted for a completed gesture (the batch after it is applied):
     * a screen it did not close (the flow kept it, or opened another screen first) goes back
     * where it was.
     */
    fun backAnswered() {
        for (state in states.values.toList()) {
            val rest = state.heldForBack ?: continue
            state.heldForBack = null
            if (state.gone || state.leaving != null) continue
            animate(state, rest, screenMotion(state.screen).open, 0f) {
                state.crossFade = null
                endFlights(state)
                apply(state)
            }
        }
    }

    /** The state the predictive back gesture moves, while it does. */
    private fun backState(): ScreenState? =
        backGesture?.takeIf { states[it.screen.nodeId] === it && it.dragBaseline != null }

    /**
     * The screen a `back` closes: the frontmost screen, unless it is its stack's first, then the
     * presentation holding that stack.
     */
    private fun backTarget(): NodeView? {
        var stack = stackIn(container) ?: return null
        var candidate: NodeView? = null
        while (true) {
            val front = stack.childNodes.lastOrNull { it.kind == NodeKind.SCREEN && !isGone(it) } ?: return candidate
            val motion = screenMotion(front)
            if (motion.kind.isPresentation) {
                candidate = front
                stack = lead(front).takeIf { it !== front } ?: return candidate
                continue
            }
            return if (isStackRoot(front)) candidate else front
        }
    }

    /** The outermost `stack` view in [view]'s subtree. */
    private fun stackIn(view: View): NodeView? {
        val pending = ArrayDeque(listOf(view))
        while (pending.isNotEmpty()) {
            val current = pending.removeFirst()
            if (current is NodeView && current.kind == NodeKind.STACK) return current
            if (current is NodeView) pending.addAll(current.childNodes) else if (current is ViewGroup) {
                for (index in 0 until current.childCount) pending.add(current.getChildAt(index))
            }
        }
        return null
    }

    // endregion

    // region Animation

    /**
     * Runs [state]'s progress towards [target] on [spring], starting at [velocity] (progress per
     * second; `null` keeps the velocity shown), then calls [completion].
     */
    private fun animate(state: ScreenState, target: Float, spring: ScreenMotion.Spring, velocity: Float?, completion: () -> Unit) {
        val start = velocity ?: state.velocity
        state.progress = target
        state.animation = Animation(SpringMotion(state.shown, target, start, spring), completion)
        postFrame()
    }

    /** Stops the running animation where it is shown. */
    private fun stopAnimation(state: ScreenState) {
        state.animation = null
        state.velocity = 0f
        state.progress = state.shown
    }

    /** Moves every running animation to [now], seconds on the display's frame clock. */
    fun step(now: Double) {
        for (state in states.values.toList()) {
            val animation = state.animation ?: continue
            val start = animation.start ?: now.also { animation.start = it }
            val elapsed = now - start
            if (animation.motion.isSettled(elapsed)) {
                finish(state, animation)
            } else {
                state.shown = animation.motion.position(elapsed)
                state.velocity = animation.motion.velocity(elapsed)
                apply(state)
            }
        }
        if (states.values.any { it.animation != null }) postFrame()
    }

    private fun finish(state: ScreenState, animation: Animation) {
        state.animation = null
        state.shown = animation.motion.to
        state.velocity = 0f
        apply(state)
        animation.completion()
    }

    private fun postFrame() {
        if (framePosted) return
        framePosted = true
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    // endregion

    // region Tests

    /** Finishes every running animation at once, as if its time had passed. */
    fun finishAnimations() {
        while (true) {
            val state = states.values.firstOrNull { it.animation != null } ?: return
            finish(state, state.animation ?: return)
        }
    }

    /** The progress a screen shows once its animations end. */
    fun progress(screen: NodeView): Float? = states[screen.nodeId]?.progress

    /** The progress a screen shows now. */
    fun shownProgress(screen: NodeView): Float? = states[screen.nodeId]?.shown

    /** The shared elements flying for [screen] now. */
    fun flights(screen: NodeView): List<SharedElementFlight> = states[screen.nodeId]?.flights.orEmpty()

    /** Whether [screen] is moving: animated, or held by a drag or the back gesture. */
    fun isMoving(screen: NodeView): Boolean {
        val state = states[screen.nodeId] ?: return false
        return state.animation != null || state.dragBaseline != null
    }

    // endregion

    // region Applying progress

    /**
     * Writes the progress [state] shows into the views: the screen (or its presentation's stack),
     * the backdrop, the screen beneath a card and the flights.
     */
    private fun apply(state: ScreenState) {
        val screen = state.screen
        val motion = screenMotion(screen)
        val geometry = geometry(screen)
        val frame = motion.frame(state.shown, geometry, state.crossFade)
        lead(screen).setNavigation { copy(offsetX = frame.offsetX, offsetY = frame.offsetY, alpha = frame.alpha) }
        if (motion.kind.isPresentation) {
            screen.setNavigation { copy(dim = frame.dim) }
        } else {
            val below = below(screen)
            if (below != null && below.parentNode === screen.parentNode) {
                // The screen beneath drifts in the direction of the screen that moves over it.
                val offset = if (reduceMotion() || state.crossFade != null) {
                    0f
                } else {
                    ScreenMotion.of(below.props, motion.rightToLeft).coveredOffset(state.shown, geometry(below))
                }
                below.setNavigation { copy(offsetX = offset) }
            }
        }
        if (state.flights.isNotEmpty()) {
            val rest = motion.rest(geometry, state.detent)
            val presence = (state.shown / maxOf(rest, 0.01f)).coerceIn(0f, 1f)
            for (flight in state.flights) flight.apply(presence)
        }
    }

    // endregion

    // region Shared elements

    /** Starts the flights of the elements [state]'s screen shares with the one beneath. */
    private fun startFlights(state: ScreenState) {
        if (state.flights.isNotEmpty()) return
        val source = below(state.screen) ?: return
        val targets = sharedElements(state.screen)
        val sources = sharedElements(source)
        val pairs = targets.mapNotNull { (id, target) -> sources[id]?.let { it to target } }
            .filter { (from, to) -> from.width > 0 && from.height > 0 && to.width > 0 && to.height > 0 }
            // A flight shows a still picture in place of both elements, which a native
            // component's live view (a video, a map, a view of another SDK) cannot be: it may
            // not draw into a picture at all, or hold what must not be copied. Such elements
            // stay live and move with their screens.
            .filter { (from, to) -> !showsComponent(from) && !showsComponent(to) }
        if (pairs.isEmpty()) return
        // Both ends are measured where their screens rest.
        val motion = screenMotion(state.screen)
        val geometry = geometry(state.screen)
        val rest = motion.frame(motion.rest(geometry, state.detent), geometry)
        val moving = lead(state.screen)
        val current = moving.navigation to source.navigation
        moving.setNavigation { copy(offsetX = rest.offsetX, offsetY = rest.offsetY) }
        source.setNavigation { copy(offsetX = 0f, offsetY = 0f) }
        val layer = flightLayer.attach()
        for ((from, to) in pairs) state.flights.add(SharedElementFlight(from, to, layer))
        moving.setNavigation { copy(offsetX = current.first.offsetX, offsetY = current.first.offsetY) }
        source.setNavigation { copy(offsetX = current.second.offsetX, offsetY = current.second.offsetY) }
        apply(state)
    }

    private fun endFlights(state: ScreenState) {
        for (flight in state.flights) flight.end()
        state.flights.clear()
    }

    /** Whether [node] or a view inside it shows a native component. */
    private fun showsComponent(node: NodeView): Boolean =
        (node as? ExternalNodeView)?.component != null || node.childNodes.any(::showsComponent)

    /** The views of a screen's subtree that carry a `sharedElement`, by id; the first in paint order wins. */
    private fun sharedElements(screen: NodeView): Map<String, NodeView> {
        val found = LinkedHashMap<String, NodeView>()
        val pending = ArrayDeque(screen.childNodes)
        while (pending.isNotEmpty()) {
            val node = pending.removeFirst()
            node.props["sharedElement"]?.string?.let { if (it !in found) found[it] = node }
            pending.addAll(0, node.childNodes)
        }
        return found
    }

    // endregion

    // region The tree

    private fun state(screen: NodeView): ScreenState {
        states[screen.nodeId]?.takeIf { it.screen === screen }?.let { return it }
        val motion = screenMotion(screen)
        val state = ScreenState(screen, motion.rest(geometry(screen)))
        if (motion.kind.isPresentation) state.detent = motion.initialSnapIndex
        states[screen.nodeId] = state
        return state
    }

    private fun isGone(screen: NodeView): Boolean {
        if (screen.props["closing"]?.bool == true) return true
        return states[screen.nodeId]?.takeIf { it.screen === screen }?.gone == true
    }

    /** Whether [screen] is its stack's first screen. */
    private fun isStackRoot(screen: NodeView): Boolean =
        screen.parentNode?.childNodes?.firstOrNull { it.kind == NodeKind.SCREEN } === screen

    /** The screen beneath [screen] in its stack that stays. */
    private fun below(screen: NodeView): NodeView? {
        val siblings = screen.parentNode?.childNodes ?: return null
        val index = siblings.indexOfFirst { it === screen }
        if (index < 0) return null
        return siblings.subList(0, index).lastOrNull { it.kind == NodeKind.SCREEN && !isGone(it) }
    }

    /** What moves for a screen: a presentation moves its stack over the backdrop, a card moves itself. */
    fun lead(screen: NodeView): NodeView {
        if (!screenMotion(screen).kind.isPresentation) return screen
        return screen.childNodes.firstOrNull { it.kind == NodeKind.STACK } ?: screen
    }

    private fun geometry(screen: NodeView): ScreenMotion.Geometry {
        val frame = screen.nodeFrame
        return ScreenMotion.Geometry(frame.width, frame.height, lead(screen).nodeFrame.height)
    }

    /** Where assistive technology goes when [screen] comes to the front: the screen, or a presentation's front screen. */
    private fun focusTargetOf(screen: NodeView): NodeView {
        if (!screenMotion(screen).kind.isPresentation) return screen
        val stack = screen.childNodes.firstOrNull { it.kind == NodeKind.STACK } ?: return screen
        return stack.childNodes.lastOrNull { it.kind == NodeKind.SCREEN && !isGone(it) } ?: screen
    }

    // endregion

    /** A view over the tree, as large as [container], that holds shared element flights. */
    private class FlightLayer(private val container: ViewGroup) : ViewGroup(container.context) {
        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }

        /** The layer, on top of [container] and over its bounds. */
        fun attach(): FlightLayer {
            if (parent !== container) {
                (parent as? ViewGroup)?.removeView(this)
                container.addView(this)
            } else if (container.getChildAt(container.childCount - 1) !== this) {
                bringToFront()
            }
            layout(0, 0, container.width, container.height)
            return this
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {}

        // Flights never take touches.
        override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean = false
    }
}
