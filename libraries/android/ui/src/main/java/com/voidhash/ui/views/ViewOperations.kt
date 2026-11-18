package com.voidhash.ui.views

import android.graphics.Color

/** A prop value in the flow commit protocol's encoding (views protocol, "Values"). */
internal sealed class PropValue {
    object Undefined : PropValue()

    object Null : PropValue()

    data class Bool(val value: Boolean) : PropValue()

    data class Number(val value: Double) : PropValue()

    data class Text(val value: String) : PropValue()

    data class Array(val items: List<PropValue>) : PropValue()

    data class Object(val entries: Map<String, PropValue>) : PropValue()

    /** A finite number, or `null`. */
    val number: Double? get() = (this as? Number)?.value?.takeIf { it.isFinite() }

    val string: String? get() = (this as? Text)?.value

    val bool: Boolean? get() = (this as? Bool)?.value

    val array: List<PropValue>? get() = (this as? Array)?.items

    val obj: Map<String, PropValue>? get() = (this as? Object)?.entries

    /** The entry [key] of an object. */
    operator fun get(key: String): PropValue? = obj?.get(key)

    /** The finite numbers of an array, `null` unless every entry is one. */
    val numbers: List<Double>?
        get() {
            val items = array ?: return null
            val numbers = items.mapNotNull { it.number }
            return if (numbers.size == items.size) numbers else null
        }

    /** A colour (`0xRRGGBBAA`, straight alpha) as an Android colour int. */
    val color: Int? get() = number?.let(::rgbaColor)
}

/** `0xRRGGBBAA` with straight alpha as an Android `0xAARRGGBB` colour int. */
internal fun rgbaColor(value: Double): Int {
    val rgba = value.coerceIn(0.0, 4294967295.0).toLong()
    return ((rgba and 0xFF) shl 24 or (rgba ushr 8)).toInt()
}

/** [color] with its alpha multiplied by [alpha]. */
internal fun withAlpha(color: Int, alpha: Float): Int {
    val scaled = (Color.alpha(color) * alpha.coerceIn(0f, 1f) + 0.5f).toInt()
    return (color and 0x00FFFFFF) or (scaled shl 24)
}

/** A view's frame in its parent, in logical pixels. */
internal data class ViewFrame(val x: Float, val y: Float, val width: Float, val height: Float) {
    /** The frame with non-finite values as 0 and no negative size. */
    fun sanitized(): ViewFrame {
        fun finite(value: Float) = if (value.isFinite()) value else 0f
        return ViewFrame(finite(x), finite(y), maxOf(0f, finite(width)), maxOf(0f, finite(height)))
    }

    companion object {
        val ZERO = ViewFrame(0f, 0f, 0f, 0f)
    }
}

/** One view operation of a batch (views protocol, "Operation batches"). */
internal sealed class ViewOperation {
    /** Release every view except the root; the whole tree follows. */
    object Reset : ViewOperation()

    data class Create(val id: Int, val kind: Int) : ViewOperation()

    /** Props to merge; [PropValue.Null] returns a key to its default. */
    data class Props(val id: Int, val props: Map<String, PropValue>) : ViewOperation()

    data class Frame(val id: Int, val frame: ViewFrame) : ViewOperation()

    /** The view's subviews, in paint order. */
    data class Children(val id: Int, val children: IntArray) : ViewOperation() {
        override fun equals(other: Any?) = other is Children && other.id == id && other.children.contentEquals(children)

        override fun hashCode() = 31 * id + children.contentHashCode()
    }

    data class Delete(val id: Int) : ViewOperation()

    /** A canvas's next draw list and the images it references by index. */
    data class Canvas(val id: Int, val images: List<String>, val drawList: ByteArray) : ViewOperation() {
        override fun equals(other: Any?) =
            other is Canvas && other.id == id && other.images == images && other.drawList.contentEquals(drawList)

        override fun hashCode() = 31 * (31 * id + images.hashCode()) + drawList.contentHashCode()
    }

    /** Give the `textInput` view the keyboard. */
    data class TextFocus(val id: Int) : ViewOperation()

    /** Take the keyboard from the `textInput` view, when it has it. */
    data class TextBlur(val id: Int) : ViewOperation()

    /**
     * Set a `textInput` view's text and selection (UTF-16 code units), applied only while the
     * field is at revision [base] or [base] is [ANY_REVISION] (views protocol, "Revisions"). Its
     * text is the end user's, so no description carries it.
     */
    class TextSet(
        val id: Int,
        val base: Long,
        val revision: Long,
        val selectionBase: Int,
        val selectionExtent: Int,
        val text: String,
    ) : ViewOperation() {
        override fun equals(other: Any?) = other is TextSet && other.id == id && other.base == base &&
            other.revision == revision && other.selectionBase == selectionBase &&
            other.selectionExtent == selectionExtent && other.text == text

        override fun hashCode() = 31 * (31 * id + revision.hashCode()) + text.hashCode()

        override fun toString() = "TextSet(id=$id, base=$base, revision=$revision)"

        companion object {
            /** `VHV_TEXT_ANY_REVISION`, `UINT64_MAX`, read as a signed `Long`. */
            const val ANY_REVISION = -1L
        }
    }
}

/** A batch the host cannot apply at all. */
internal class OperationBatchException(message: String) : Exception(message)

/** The decoded operations of a batch, and a reason for every operation skipped as malformed. */
internal class DecodedBatch(val operations: List<ViewOperation>, val skipped: List<String>)

/**
 * Decodes view operation batches, tolerant exactly as the protocol requires: an unknown operation
 * is skipped by its length, payload bytes after the known fields and unknown prop keys are left
 * alone, and a batch of another magic or version is rejected.
 */
internal object OperationBatch {
    /** `VHVO` read as a little-endian `u32`. */
    const val MAGIC = 0x4F564856
    const val VERSION = 1

    /** Magic, version, flags and operation count. */
    const val HEADER_BYTES = 12

    /** @throws OperationBatchException for another magic or version, or a truncated batch. */
    fun decode(bytes: ByteArray): DecodedBatch {
        val reader = ByteReader(bytes)
        val magic = reader.u32() ?: throw OperationBatchException("the view operation batch is truncated")
        if (magic.toInt() != MAGIC) throw OperationBatchException("the view operation batch has the wrong magic")
        val version = reader.u16()
        val flags = reader.u16()
        val count = reader.u32()
        if (version == null || flags == null || count == null) {
            throw OperationBatchException("the view operation batch is truncated")
        }
        if (version != VERSION) throw OperationBatchException("view operation batch version $version is not supported")
        val operations = ArrayList<ViewOperation>(minOf(count, 65_536L).toInt())
        val skipped = ArrayList<String>()
        for (index in 0 until count) {
            val code = reader.u8()
            val length = reader.u32()
            val payload = if (code != null && length != null) reader.take(length) else null
            if (code == null || payload == null) throw OperationBatchException("the view operation batch is truncated")
            when (val decoded = decodeOperation(code, ByteReader(bytes, payload.first, payload.last + 1))) {
                is ViewOperation -> operations.add(decoded)
                UNKNOWN -> {}
                else -> skipped.add("operation $code has a malformed payload")
            }
        }
        return DecodedBatch(operations, skipped)
    }

    /** An operation this version does not know. */
    private val UNKNOWN = Any()
    private val MALFORMED = Any()

    private fun decodeOperation(code: Int, reader: ByteReader): Any {
        when (code) {
            1 -> return ViewOperation.Reset
            2 -> {
                val id = reader.i32() ?: return MALFORMED
                val kind = reader.u8() ?: return MALFORMED
                return ViewOperation.Create(id, kind)
            }
            3 -> {
                val id = reader.i32() ?: return MALFORMED
                val props = reader.value()?.obj ?: return MALFORMED
                return ViewOperation.Props(id, props)
            }
            4 -> {
                val id = reader.i32() ?: return MALFORMED
                val x = reader.f32() ?: return MALFORMED
                val y = reader.f32() ?: return MALFORMED
                val width = reader.f32() ?: return MALFORMED
                val height = reader.f32() ?: return MALFORMED
                return ViewOperation.Frame(id, ViewFrame(x, y, width, height))
            }
            5 -> {
                val id = reader.i32() ?: return MALFORMED
                val count = reader.u32() ?: return MALFORMED
                if (count > reader.remaining / 4) return MALFORMED
                val children = IntArray(count.toInt())
                for (index in children.indices) children[index] = reader.i32() ?: return MALFORMED
                return ViewOperation.Children(id, children)
            }
            6 -> return ViewOperation.Delete(reader.i32() ?: return MALFORMED)
            7 -> {
                val id = reader.i32() ?: return MALFORMED
                val count = reader.u32() ?: return MALFORMED
                if (count > reader.remaining / 4) return MALFORMED
                val images = ArrayList<String>(count.toInt())
                repeat(count.toInt()) { images.add(reader.string() ?: return MALFORMED) }
                val length = reader.u32() ?: return MALFORMED
                val list = reader.take(length) ?: return MALFORMED
                return ViewOperation.Canvas(id, images, reader.bytes.copyOfRange(list.first, list.last + 1))
            }
            8 -> return ViewOperation.TextFocus(reader.i32() ?: return MALFORMED)
            9 -> return ViewOperation.TextBlur(reader.i32() ?: return MALFORMED)
            10 -> {
                val id = reader.i32() ?: return MALFORMED
                val base = reader.u64() ?: return MALFORMED
                val revision = reader.u64() ?: return MALFORMED
                val selectionBase = reader.u32() ?: return MALFORMED
                val selectionExtent = reader.u32() ?: return MALFORMED
                val text = reader.string() ?: return MALFORMED
                val clamp = { offset: Long -> minOf(offset, Int.MAX_VALUE.toLong()).toInt() }
                return ViewOperation.TextSet(id, base, revision, clamp(selectionBase), clamp(selectionExtent), text)
            }
            else -> return UNKNOWN
        }
    }
}

/** Reads little-endian values from `bytes[start, end)`; every read returns `null` past the end. */
internal class ByteReader(val bytes: ByteArray, start: Int = 0, private val end: Int = bytes.size) {
    private var at = start

    val remaining: Long get() = (end - at).toLong()

    /** The index range of the next [count] bytes, consumed; `null` when fewer remain. */
    fun take(count: Long): IntRange? {
        if (count < 0 || count > remaining) return null
        val range = at until at + count.toInt()
        at += count.toInt()
        return range
    }

    private fun integer(size: Int): Long? {
        val range = take(size.toLong()) ?: return null
        var value = 0L
        for ((shift, index) in range.withIndex()) value = value or ((bytes[index].toLong() and 0xFF) shl (shift * 8))
        return value
    }

    fun u8(): Int? = integer(1)?.toInt()

    fun u16(): Int? = integer(2)?.toInt()

    fun u32(): Long? = integer(4)

    fun i32(): Int? = integer(4)?.toInt()

    /** A `u64` as the `Long` of the same bits. */
    fun u64(): Long? = integer(8)

    fun f32(): Float? = integer(4)?.let { Float.fromBits(it.toInt()) }

    fun f64(): Double? = integer(8)?.let { Double.fromBits(it) }

    fun string(): String? {
        val length = u32() ?: return null
        val range = take(length) ?: return null
        return String(bytes, range.first, range.last - range.first + 1, Charsets.UTF_8)
    }

    /** A value in the commit protocol's encoding; `null` when malformed or of a tag props never use. */
    fun value(depth: Int = 0): PropValue? {
        if (depth >= 64) return null
        return when (u8() ?: return null) {
            0 -> PropValue.Undefined
            1 -> PropValue.Null
            2 -> PropValue.Bool(false)
            3 -> PropValue.Bool(true)
            4 -> f64()?.let(PropValue::Number)
            5 -> string()?.let(PropValue::Text)
            6 -> {
                val count = u32() ?: return null
                if (count > remaining) return null
                val items = ArrayList<PropValue>(count.toInt())
                repeat(count.toInt()) { items.add(value(depth + 1) ?: return null) }
                PropValue.Array(items)
            }
            7 -> {
                val count = u32() ?: return null
                if (count > remaining) return null
                val entries = LinkedHashMap<String, PropValue>(count.toInt())
                repeat(count.toInt()) {
                    val key = string() ?: return null
                    entries[key] = value(depth + 1) ?: return null
                }
                PropValue.Object(entries)
            }
            else -> null
        }
    }
}
