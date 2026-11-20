package com.voidhash.ui

import android.graphics.Typeface
import android.os.Build
import java.io.File
import java.security.MessageDigest

/**
 * What text layout needs from a font file besides the typeface: its weight and style, whether it
 * has a weight axis, its vertical metrics, and which characters it maps. Read from the file's
 * tables, since Android exposes none of it for a font loaded from a file.
 */
internal class FontFile private constructor(
    /** CSS weight the `OS/2` table declares, 400 when it declares none. */
    val weight: Int,
    val italic: Boolean,
    /** The font has a `wght` variation axis. */
    val variableWeight: Boolean,
    /** Ascent above the baseline, per em (views protocol, "Text": typographic when `USE_TYPO_METRICS`, else `hhea`). */
    val ascent: Float,
    /** Descent below the baseline, per em, positive. */
    val descent: Float,
    private val cmap: CharacterMap?,
) {
    /** Whether the font maps [codePoint] to a glyph; true when its character map is unreadable. */
    fun hasGlyph(codePoint: Int): Boolean = cmap?.contains(codePoint) ?: true

    companion object {
        private const val OS2 = 0x4F532F32
        private const val HHEA = 0x68686561
        private const val HEAD = 0x68656164
        private const val FVAR = 0x66766172
        private const val CMAP = 0x636D6170
        private const val WGHT = 0x77676874

        /** Reads a TrueType or OpenType file (the first font of a collection); `null` when it is none. */
        fun read(data: ByteArray): FontFile? {
            val font = Tables.of(data) ?: return null
            val head = font.table(HEAD) ?: return null
            val unitsPerEm = font.u16(head, 18).toFloat().takeIf { it > 0 } ?: return null
            val os2 = font.table(OS2)
            val hhea = font.table(HHEA)
            val weight = os2?.takeIf { font.length(OS2) >= 6 }?.let { font.u16(it, 4) }?.takeIf { it in 1..1000 } ?: 400
            val selection = os2?.takeIf { font.length(OS2) >= 64 }?.let { font.u16(it, 62) } ?: 0
            val macStyle = font.u16(head, 44)
            val italic = selection and 1 != 0 || macStyle and 2 != 0
            var ascent: Float
            var descent: Float
            if (os2 != null && font.length(OS2) >= 72 && selection and 0x80 != 0 && font.i16(os2, 68) != 0) {
                ascent = font.i16(os2, 68).toFloat()
                descent = -font.i16(os2, 70).toFloat()
            } else if (hhea != null) {
                ascent = font.i16(hhea, 4).toFloat()
                descent = -font.i16(hhea, 6).toFloat()
            } else {
                ascent = unitsPerEm * 0.8f
                descent = unitsPerEm * 0.2f
            }
            val fvar = font.table(FVAR)
            var variable = false
            if (fvar != null) {
                val axesOffset = font.u16(fvar, 4)
                val axisCount = font.u16(fvar, 8)
                val axisSize = font.u16(fvar, 10)
                for (axis in 0 until axisCount) {
                    if (font.u32(fvar + axesOffset + axis * axisSize) == WGHT) variable = true
                }
            }
            return FontFile(
                weight,
                italic,
                variable,
                ascent / unitsPerEm,
                descent / unitsPerEm,
                font.table(CMAP)?.let { CharacterMap.read(font, it) },
            )
        }
    }

    /** Big-endian reads of an sfnt file's table directory, bounds-checked to 0. */
    private class Tables(private val data: ByteArray, private val directory: Int) {
        fun u8(at: Int): Int = if (at in data.indices) data[at].toInt() and 0xFF else 0

        fun u16(at: Int): Int = u8(at) shl 8 or u8(at + 1)

        fun u16(table: Int, offset: Int): Int = u16(table + offset)

        fun i16(table: Int, offset: Int): Int = u16(table, offset).toShort().toInt()

        fun u32(at: Int): Int = u16(at) shl 16 or u16(at + 2)

        private fun record(tag: Int): Int? {
            val count = u16(directory + 4)
            for (index in 0 until count) {
                val record = directory + 12 + index * 16
                if (u32(record) == tag) return record
            }
            return null
        }

        /** Where the table [tag] starts, or `null`. */
        fun table(tag: Int): Int? = record(tag)?.let { u32(it + 8) }?.takeIf { it in data.indices }

        fun length(tag: Int): Int = record(tag)?.let { u32(it + 12) } ?: 0

        companion object {
            fun of(data: ByteArray): Tables? {
                if (data.size < 12) return null
                val probe = Tables(data, 0)
                val directory = if (probe.u32(0) == 0x74746366) probe.u32(12) else 0 // 'ttcf'
                return when (probe.u32(directory)) {
                    0x00010000, 0x4F54544F, 0x74727565 -> Tables(data, directory) // TrueType, 'OTTO', 'true'
                    else -> null
                }
            }
        }
    }

    /** The code points of a `cmap` table's Unicode subtable (formats 4 and 12), as ranges. */
    private class CharacterMap(private val starts: IntArray, private val ends: IntArray) {
        fun contains(codePoint: Int): Boolean {
            var low = 0
            var high = starts.size - 1
            while (low <= high) {
                val middle = (low + high) ushr 1
                when {
                    codePoint < starts[middle] -> high = middle - 1
                    codePoint > ends[middle] -> low = middle + 1
                    else -> return true
                }
            }
            return false
        }

        companion object {
            fun read(font: Tables, cmap: Int): CharacterMap? {
                val count = font.u16(cmap + 2)
                var best: Int? = null
                var bestFormat = 0
                for (index in 0 until count) {
                    val record = cmap + 4 + index * 8
                    val platform = font.u16(record)
                    val encoding = font.u16(record + 2)
                    val subtable = cmap + font.u32(record + 4)
                    val format = font.u16(subtable)
                    val unicode = platform == 0 || platform == 3 && (encoding == 1 || encoding == 10)
                    if (unicode && (format == 12 || format == 4 && bestFormat != 12)) {
                        best = subtable
                        bestFormat = format
                    }
                }
                val subtable = best ?: return null
                val starts = ArrayList<Int>()
                val ends = ArrayList<Int>()
                if (bestFormat == 12) {
                    val groups = font.u32(subtable + 12)
                    for (group in 0 until groups.coerceIn(0, 65_536)) {
                        val at = subtable + 16 + group * 12
                        starts.add(font.u32(at))
                        ends.add(font.u32(at + 4))
                    }
                } else {
                    val segments = font.u16(subtable + 6) / 2
                    val endCodes = subtable + 14
                    val startCodes = endCodes + segments * 2 + 2
                    for (segment in 0 until segments) {
                        val end = font.u16(endCodes + segment * 2)
                        val start = font.u16(startCodes + segment * 2)
                        // Format 4 maps unmapped code points to glyph 0 inside segments too; the
                        // segments are what the font claims to cover.
                        if (start <= end && start != 0xFFFF) {
                            starts.add(start)
                            ends.add(end)
                        }
                    }
                }
                val order = starts.indices.sortedBy { starts[it] }
                return CharacterMap(IntArray(order.size) { starts[order[it]] }, IntArray(order.size) { ends[order[it]] })
            }
        }
    }
}

/** A font resolved for a paragraph: the typeface to set, whether to slant it, and its file. */
internal class ResolvedFont(val typeface: Typeface, val syntheticItalic: Boolean, val file: FontFile?)

/**
 * The fonts one paywall view sets text in, by family, resolved by weight and style here (views
 * protocol, "Fonts"). Nothing is registered with the system: the files are written to
 * [directory] once, by content, and loaded from there.
 */
internal class FontRegistry(private val directory: File) {
    /** A registered file; [weight] is its declared weight unless registration named another. */
    private class Face(val file: File, val info: FontFile, val weight: Int)

    private val families = HashMap<String, MutableList<Face>>()

    /** Whether [family] has a font registered. */
    operator fun contains(family: String): Boolean = families.containsKey(family)

    /**
     * Registers a TrueType or OpenType file under [family]; [weight] overrides the weight the file
     * declares. Returns whether the file holds a font the platform loads.
     */
    fun register(family: String, data: ByteArray, weight: Int? = null): Boolean {
        val name = MessageDigest.getInstance("SHA-1").digest(data).joinToString("") { "%02x".format(it) }
        return register(family, File(directory, "$name.font"), data, weight)
    }

    /**
     * Registers [data] under [family], loaded from [file], which names that content and is
     * written first when it is missing.
     */
    fun register(family: String, file: File, data: ByteArray, weight: Int? = null): Boolean {
        val info = synchronized(fileInfo) { fileInfo[file.path] } ?: FontFile.read(data) ?: return false
        synchronized(fileInfo) { fileInfo[file.path] = info }
        try {
            if (!file.isFile) {
                directory.mkdirs()
                val partial = File(directory, "${file.name}.${System.nanoTime()}.partial")
                partial.writeBytes(data)
                if (!partial.renameTo(file)) partial.delete()
            }
            val face = Face(file, info, weight ?: info.weight)
            typeface(face, face.weight) ?: return false
            families.getOrPut(family) { ArrayList() }.add(face)
            return true
        } catch (error: Exception) {
            return false
        }
    }

    /**
     * The font for text naming [family] (empty or unregistered: the default family) at [weight].
     * A weight with no face resolves by CSS font matching; italic without an italic face is
     * slanted.
     */
    fun resolve(family: String, weight: Int, italic: Boolean): ResolvedFont {
        val faces = families[family] ?: families[DEFAULT_FAMILY]
        if (faces.isNullOrEmpty()) {
            // No default font registered: the system's, so text still shows.
            return ResolvedFont(Typeface.create(Typeface.DEFAULT, if (italic) Typeface.ITALIC else Typeface.NORMAL), false, null)
        }
        val styled = faces.filter { it.info.italic == italic }
        val face = match(weight, styled.ifEmpty { faces })
        val typeface = typeface(face, weight) ?: Typeface.DEFAULT
        return ResolvedFont(typeface, italic && !face.info.italic, face.info)
    }

    private fun typeface(face: Face, weight: Int): Typeface? {
        // Typefaces of a variable font by weight; a static one has one, under 0.
        val key = if (face.info.variableWeight && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) weight.coerceIn(1, 1000) else 0
        val cacheKey = "${face.file.path}#$key"
        synchronized(typefaces) { typefaces[cacheKey] }?.let { return it }
        val typeface = try {
            if (key != 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Typeface.Builder(face.file).setFontVariationSettings("'wght' $key").build()
            } else {
                Typeface.createFromFile(face.file)
            }
        } catch (error: RuntimeException) {
            null
        } ?: return null
        synchronized(typefaces) { typefaces[cacheKey] = typeface }
        return typeface
    }

    private fun match(weight: Int, faces: List<Face>): Face {
        faces.firstOrNull { it.weight == weight || it.info.variableWeight }?.let { return it }
        // CSS Fonts 4, "font-weight" matching.
        val lighter = faces.filter { it.weight < weight }.sortedByDescending { it.weight }
        val heavier = faces.filter { it.weight > weight }.sortedBy { it.weight }
        val order = when {
            weight in 400..500 -> heavier.filter { it.weight <= 500 } + lighter + heavier.filter { it.weight > 500 }
            weight < 400 -> lighter + heavier
            else -> heavier + lighter
        }
        return order.firstOrNull() ?: faces[0]
    }

    companion object {
        /** The family text without a `fontFamily` uses. */
        const val DEFAULT_FAMILY = "Inter"

        // Files are named by their content, so what is read from one holds for the process.
        private val fileInfo = HashMap<String, FontFile>()
        private val typefaces = HashMap<String, Typeface>()
    }
}
