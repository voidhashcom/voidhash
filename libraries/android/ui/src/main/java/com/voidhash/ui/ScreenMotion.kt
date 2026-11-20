package com.voidhash.ui

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * How a `screen` view moves (views protocol, "Navigation"), described as data: where a screen
 * sits at a given progress, how the one beneath it reacts, and where a released drag goes.
 * Progress is the engine's: `0` off screen, `1` presented, a sheet's detent in between. Lengths
 * are logical pixels.
 */
internal data class ScreenMotion(
    val kind: Kind,
    val rightToLeft: Boolean,
    val open: Spring,
    val close: Spring,
    val detents: List<Detent>,
    val initialSnapIndex: Int,
    val gestureEnabled: Boolean,
    val backdropDismisses: Boolean,
    /**
     * A presentation whose backdrop takes touches (`backdropBehavior` `block` or `dismiss`): it
     * is modal, and the screen beneath is hidden from assistive technology.
     */
    val backdropBlocks: Boolean,
) {
    enum class Kind(val prop: String) {
        SLIDE("slide"),
        FADE("fade"),
        NONE("none"),
        MODAL("modal"),
        SHEET("sheet"),
        DIALOG("dialog"),
        ;

        /** A presentation's host, moving the stack inside it over a backdrop. */
        val isPresentation: Boolean get() = this == MODAL || this == SHEET || this == DIALOG

        /** Whether the screen beneath stays in view while this one rests over it. */
        val leavesBelowVisible: Boolean get() = this == SHEET || this == DIALOG

        /** A slide, modal or sheet: moved rather than faded, so Reduce Motion fades it instead. */
        val moves: Boolean get() = this == SLIDE || this == MODAL || this == SHEET
    }

    /** A spring of the runtime's `transitionSpec`. */
    data class Spring(val stiffness: Double, val damping: Double, val mass: Double)

    sealed class Detent {
        /** The height the presentation's stack laid out to. */
        object Auto : Detent()

        /** A fraction of the presentation's height. */
        data class Fraction(val value: Float) : Detent()
    }

    /**
     * The values the engine moves screens by (its flow navigation and transition controller),
     * which the views protocol states under "Navigation".
     */
    object Engine {
        /** The runtime's springs when a screen names none. */
        val open = Spring(stiffness = 1_000.0, damping = 500.0, mass = 3.0)
        val close = Spring(stiffness = 1_100.0, damping = 98.0, mass = 3.0)

        /** Backdrop opacity behind a modal and a sheet, at rest. */
        const val MODAL_DIM = 0.3f
        const val SHEET_DIM = 0.4f

        /** How far a covered slide screen drifts back, as a share of its width. */
        const val PARALLAX = 0.3f

        /** A swipe dismisses when its projected end passes this share of the way. */
        const val DISMISS_THRESHOLD = 0.5f

        /** Seconds of release velocity a swipe back and a sheet project forward. */
        const val SWIPE_VELOCITY_IMPACT = 0.3f
        const val SNAP_VELOCITY_IMPACT = 0.1f
    }

    /** `1` for leading-to-trailing motion, `-1` when mirrored. */
    val sign: Float get() = if (rightToLeft) -1f else 1f

    /**
     * Whether a drag may move the screen at all: a swipe down when enabled, and a sheet with
     * several detents between them even when it may not be dismissed.
     */
    val draggable: Boolean
        get() = when (kind) {
            Kind.SLIDE, Kind.FADE, Kind.NONE -> gestureEnabled
            Kind.MODAL, Kind.SHEET -> gestureEnabled || detents.size > 1
            Kind.DIALOG -> false
        }

    // region Geometry

    /**
     * What a screen moves within: its own size, and for a presentation the height its stack laid
     * out to, which an `"auto"` detent rests at.
     */
    data class Geometry(val width: Float, val height: Float, val contentHeight: Float) {
        /** The distance a drag covers between progress `0` and `1`. */
        fun extent(kind: Kind): Float = max(if (kind.isPresentation) height else width, 1f)
    }

    /** The detents as progress, ascending. */
    fun detentProgress(geometry: Geometry): List<Float> {
        if (!kind.isPresentation) return listOf(1f)
        return detents.map { detent ->
            when (detent) {
                is Detent.Fraction -> max(detent.value, 0.01f)
                Detent.Auto -> (geometry.contentHeight / max(geometry.height, 1f)).coerceIn(0.01f, 1f)
            }
        }.sorted()
    }

    /** Where the screen rests once it entered, or at detent [index]. */
    fun rest(geometry: Geometry, index: Int? = null): Float {
        if (kind != Kind.SHEET && kind != Kind.MODAL) return 1f
        val detents = detentProgress(geometry)
        return detents[(index ?: initialSnapIndex).coerceIn(0, detents.size - 1)]
    }

    // endregion

    // region Frames

    /**
     * What a screen shows at one progress: its translation and opacity (of the screen itself, or
     * of a presentation's stack), and its backdrop's opacity.
     */
    data class Frame(val offsetX: Float = 0f, val offsetY: Float = 0f, val alpha: Float = 1f, val dim: Float = 0f)

    /**
     * The screen at [progress]. With [crossFade], the screen stays where it rests at [crossFade]
     * and fades instead of moving (reduced motion).
     */
    fun frame(progress: Float, geometry: Geometry, crossFade: Float? = null): Frame {
        val presented = progress.coerceIn(0f, 1f)
        var frame = when (kind) {
            Kind.SLIDE -> Frame(offsetX = sign * geometry.width * (1 - progress))
            Kind.FADE, Kind.DIALOG -> Frame(alpha = presented)
            Kind.NONE -> Frame()
            Kind.MODAL, Kind.SHEET -> {
                // The backdrop is fully dimmed once the sheet reaches its lowest detent.
                val lowest = detentProgress(geometry).firstOrNull() ?: 1f
                val presence = (progress / max(lowest, 0.01f)).coerceIn(0f, 1f)
                Frame(
                    offsetY = geometry.height * (1 - progress),
                    dim = presence * if (kind == Kind.MODAL) Engine.MODAL_DIM else Engine.SHEET_DIM,
                )
            }
        }
        if (crossFade != null && kind.moves) {
            val anchor = this.frame(crossFade, geometry)
            frame = frame.copy(offsetX = anchor.offsetX, offsetY = anchor.offsetY, alpha = (progress / max(crossFade, 0.01f)).coerceIn(0f, 1f))
        }
        return frame
    }

    /**
     * How far a screen of this motion moves horizontally under a card at [progress] above it: a
     * slide screen drifts back as the card covers it; others stay.
     */
    fun coveredOffset(progress: Float, geometry: Geometry): Float {
        if (kind != Kind.SLIDE) return 0f
        return -sign * Engine.PARALLAX * geometry.width * progress.coerceIn(0f, 1f)
    }

    // endregion

    // region Gestures

    /**
     * Where a drag that moved the screen [translation] points towards dismissal from [baseline]
     * puts it: a pushed screen between gone and where it was grabbed; a sheet between its detents
     * (or gone, when it may be dismissed), stretching with resistance beyond them.
     */
    fun dragged(baseline: Float, translation: Float, geometry: Geometry): Float {
        val progress = baseline - translation / geometry.extent(kind)
        if (kind != Kind.MODAL && kind != Kind.SHEET) return progress.coerceIn(0f, baseline)
        val detents = detentProgress(geometry)
        val upper = detents.lastOrNull() ?: 1f
        val lower = if (gestureEnabled) 0f else detents.firstOrNull() ?: 1f
        return when {
            progress > upper -> upper + rubberBand(progress - upper)
            progress < lower -> if (gestureEnabled) lower else lower - rubberBand(lower - progress)
            else -> progress
        }
    }

    /**
     * Where a drag released at [progress] with [velocity] (progress per second, positive towards
     * presenting) settles: a progress to rest at, or `null` to dismiss. The engine's release
     * rules: a pushed screen projects the release velocity [Engine.SWIPE_VELOCITY_IMPACT] seconds
     * ahead and dismisses past [Engine.DISMISS_THRESHOLD]; a sheet projects
     * [Engine.SNAP_VELOCITY_IMPACT] seconds ahead and takes the nearest detent, or dismissal when
     * it may.
     */
    fun release(progress: Float, velocity: Float, geometry: Geometry): Float? {
        if (kind != Kind.MODAL && kind != Kind.SHEET) {
            val projected = (1 - progress) - velocity * Engine.SWIPE_VELOCITY_IMPACT
            return if (gestureEnabled && projected > Engine.DISMISS_THRESHOLD) null else 1f
        }
        val candidates = (if (gestureEnabled) listOf(0f) else emptyList()) + detentProgress(geometry)
        val projected = progress + velocity * Engine.SNAP_VELOCITY_IMPACT
        var chosen = candidates.last()
        for (index in 0 until candidates.size - 1) {
            if (projected < (candidates[index] + candidates[index + 1]) / 2) {
                chosen = candidates[index]
                break
            }
        }
        return if (chosen == 0f && gestureEnabled) null else chosen
    }

    // endregion

    companion object {
        /** The motion [props] describe, mirrored horizontally in a right-to-left layout. */
        fun of(props: Map<String, PropValue>, rightToLeft: Boolean = false): ScreenMotion {
            val presentation = props["presentation"]?.string
            val kind = Kind.values().firstOrNull { it.prop == props["motion"]?.string }
                ?: when (presentation) {
                    "transparentModal" -> Kind.DIALOG
                    "formSheet" -> Kind.SHEET
                    else -> Kind.SLIDE
                }
            fun spring(side: String, fallback: Spring): Spring {
                val spec = props["transitionSpec"]?.get(side) ?: return fallback
                return Spring(
                    stiffness = spec["stiffness"]?.number ?: fallback.stiffness,
                    damping = spec["damping"]?.number ?: fallback.damping,
                    mass = spec["mass"]?.number ?: fallback.mass,
                )
            }
            val detents = props["snapPoints"]?.array.orEmpty().mapNotNull { point ->
                if (point.string == "auto") return@mapNotNull Detent.Auto
                val fraction = point.number?.takeIf { it > 0 } ?: return@mapNotNull null
                Detent.Fraction(min(fraction, 1.0).toFloat())
            }.ifEmpty { listOf(if (kind == Kind.SHEET) Detent.Auto else Detent.Fraction(1f)) }
            val backdrop = props["backdropBehavior"]?.string
            return ScreenMotion(
                kind = kind,
                rightToLeft = rightToLeft,
                open = spring("open", Engine.open),
                close = spring("close", Engine.close),
                detents = detents,
                initialSnapIndex = (props["initialSnapIndex"]?.number ?: 0.0).toInt().coerceIn(0, detents.size - 1),
                gestureEnabled = props["gestureEnabled"]?.bool == true,
                backdropDismisses = kind != Kind.MODAL && backdrop == "dismiss",
                backdropBlocks = kind.isPresentation && (backdrop == "block" || backdrop == "dismiss"),
            )
        }

        /** UIKit's scroll view resistance past an edge, in progress, as the engine stretches. */
        fun rubberBand(excess: Float): Float = 1 - 1 / (excess * 0.55f + 1)
    }
}

/**
 * A damped spring moving progress from [from] to [to], starting at [velocity] (progress per
 * second): the exact solution of `m·x'' + c·x' + k·x = 0` for the displacement `x` from [to],
 * so it can be sampled at any time and is the same on every frame rate.
 */
internal class SpringMotion(val from: Float, val to: Float, velocity: Float, spring: ScreenMotion.Spring) {
    private val x0 = (from - to).toDouble()
    private val v0 = velocity.toDouble()
    private val omega = sqrt(spring.stiffness / spring.mass)
    private val zeta = spring.damping / (2 * sqrt(spring.stiffness * spring.mass))

    /** Progress [t] seconds after the start. */
    fun position(t: Double): Float = (to + displacement(max(t, 0.0)).first).toFloat()

    /** Progress per second [t] seconds after the start. */
    fun velocity(t: Double): Float = displacement(max(t, 0.0)).second.toFloat()

    /** Whether the spring has come to rest at [to] by [t] seconds: within a thousandth of the way, nearly still. */
    fun isSettled(t: Double): Boolean {
        val (x, v) = displacement(max(t, 0.0))
        return abs(x) < SETTLED_DISTANCE && abs(v) < SETTLED_SPEED
    }

    /** The displacement from [to] and its velocity at [t]. */
    private fun displacement(t: Double): Pair<Double, Double> {
        if (!omega.isFinite() || omega <= 0 || !zeta.isFinite()) return 0.0 to 0.0
        return when {
            abs(zeta - 1) < 1e-6 -> {
                val decay = exp(-omega * t)
                val b = v0 + omega * x0
                (x0 + b * t) * decay to (b - omega * (x0 + b * t)) * decay
            }
            zeta < 1 -> {
                val damped = omega * sqrt(1 - zeta * zeta)
                val decay = exp(-zeta * omega * t)
                val b = (v0 + zeta * omega * x0) / damped
                val c = cos(damped * t)
                val s = sin(damped * t)
                decay * (x0 * c + b * s) to decay * ((b * damped - zeta * omega * x0) * c - (x0 * damped + zeta * omega * b) * s)
            }
            else -> {
                val root = omega * sqrt(zeta * zeta - 1)
                val r1 = -zeta * omega + root
                val r2 = -zeta * omega - root
                val a = (v0 - r2 * x0) / (r1 - r2)
                val b = x0 - a
                val e1 = exp(r1 * t)
                val e2 = exp(r2 * t)
                a * e1 + b * e2 to a * r1 * e1 + b * r2 * e2
            }
        }
    }

    private companion object {
        const val SETTLED_DISTANCE = 0.001
        const val SETTLED_SPEED = 0.01
    }
}
