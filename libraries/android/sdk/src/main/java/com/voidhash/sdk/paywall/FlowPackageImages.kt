package com.voidhash.sdk.paywall

import java.nio.Buffer
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** `VHFP`, the first four bytes of a flow package, read as a little-endian integer. */
private const val PACKAGE_MAGIC = 0x50464856

/** How deep the values of a package's metadata may nest, as the runtime allows. */
private const val MAX_VALUE_DEPTH = 64

private const val VALUE_NULL = 0
private const val VALUE_FALSE = 1
private const val VALUE_TRUE = 2
private const val VALUE_NUMBER = 3
private const val VALUE_STRING = 4
private const val VALUE_ARRAY = 5
private const val VALUE_OBJECT = 6

/** The package is not one this reader understands; it lists no images then. */
private class UnreadablePackage : Exception()

/**
 * The image URLs a flow package lists for prefetching: `images` of its `META` section, every
 * image any of its screens can show.
 *
 * Reads only the package's section table, string table and metadata; the renderer's runtime is
 * what decodes and validates a package. Prefetching is a courtesy, so a package this reader
 * cannot make sense of lists no images instead of failing anything: whatever goes wrong while
 * reading it. No count a package states is believed beyond what the bytes left could hold.
 */
internal fun flowPackageImages(bytes: ByteArray): List<String> = try {
    val reader = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    if (reader.int != PACKAGE_MAGIC) throw UnreadablePackage()
    // The ABI version and the flags: the section layout read here is the same in every version.
    reader.skip(4)
    var strings: ByteBuffer? = null
    var meta: ByteBuffer? = null
    repeat(reader.count(SECTION_HEADER_BYTES)) {
        val tag = ByteArray(4).also(reader::get).toString(Charsets.US_ASCII)
        val body = reader.section()
        when (tag) {
            "STRS" -> strings = body
            "META" -> meta = body
        }
    }
    val table = readStrings(strings ?: throw UnreadablePackage())
    imagesOf(meta ?: throw UnreadablePackage(), table)
} catch (error: UnreadablePackage) {
    emptyList()
} catch (error: RuntimeException) {
    // A buffer read past its end, or anything else a malformed package trips.
    emptyList()
}

/** A section's tag and length. */
private const val SECTION_HEADER_BYTES = 8

/** A string of the string table at its shortest: its length. */
private const val STRING_ENTRY_BYTES = 4

/** A value at its shortest: its tag. */
private const val VALUE_BYTES = 1

/** An object entry at its shortest: its key and a value. */
private const val OBJECT_ENTRY_BYTES = 4 + VALUE_BYTES

/** A string value: its tag and its index. */
private const val STRING_VALUE_BYTES = 1 + 4

/**
 * A `u32` count of entries that take at least [entryBytes] each, which can never exceed what the
 * bytes left could hold: nothing is allocated for entries that cannot be there.
 */
private fun ByteBuffer.count(entryBytes: Int): Int {
    val count = int
    if (count < 0 || count > remaining() / entryBytes) throw UnreadablePackage()
    return count
}

/** The next `u32 byte_length, u8[byte_length]` as a buffer of its own. */
private fun ByteBuffer.section(): ByteBuffer {
    val length = count(entryBytes = 1)
    val body = slice().order(ByteOrder.LITTLE_ENDIAN)
    (body as Buffer).limit(length)
    skip(length)
    return body
}

/**
 * Moves past [bytes] bytes. Through [Buffer]: `ByteBuffer` declares `position` and `limit` of its
 * own only on newer Android versions, and a call compiled against those fails on older ones.
 */
private fun ByteBuffer.skip(bytes: Int) {
    if (bytes > remaining()) throw UnreadablePackage()
    (this as Buffer).position(position() + bytes)
}

private fun readStrings(section: ByteBuffer): List<String> = List(section.count(STRING_ENTRY_BYTES)) {
    val length = section.count(entryBytes = 1)
    ByteArray(length).also(section::get).toString(Charsets.UTF_8)
}

/** The strings of the `images` array of the metadata object in [meta]; empty without one. */
private fun imagesOf(meta: ByteBuffer, strings: List<String>): List<String> {
    if (meta.get().toInt() != VALUE_OBJECT) throw UnreadablePackage()
    repeat(meta.count(OBJECT_ENTRY_BYTES)) {
        val key = strings.getOrNull(meta.int) ?: throw UnreadablePackage()
        if (key != "images") {
            skipValue(meta, depth = 1)
            return@repeat
        }
        if (meta.get().toInt() != VALUE_ARRAY) throw UnreadablePackage()
        return List(meta.count(STRING_VALUE_BYTES)) {
            if (meta.get().toInt() != VALUE_STRING) throw UnreadablePackage()
            strings.getOrNull(meta.int) ?: throw UnreadablePackage()
        }
    }
    return emptyList()
}

private fun skipValue(reader: ByteBuffer, depth: Int) {
    if (depth > MAX_VALUE_DEPTH) throw UnreadablePackage()
    when (reader.get().toInt()) {
        VALUE_NULL, VALUE_FALSE, VALUE_TRUE -> Unit
        VALUE_NUMBER -> reader.skip(8)
        VALUE_STRING -> reader.skip(4)
        VALUE_ARRAY -> repeat(reader.count(VALUE_BYTES)) { skipValue(reader, depth + 1) }
        VALUE_OBJECT -> repeat(reader.count(OBJECT_ENTRY_BYTES)) {
            reader.skip(4)
            skipValue(reader, depth + 1)
        }
        else -> throw UnreadablePackage()
    }
}
