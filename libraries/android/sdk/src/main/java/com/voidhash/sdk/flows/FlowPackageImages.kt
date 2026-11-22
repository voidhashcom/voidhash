package com.voidhash.sdk.flows

import java.io.IOException
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
 * The images a flow package lists, read without the renderer: every URL a node can show, for
 * fetching them before the flow is shown, and the SHA-256 the build recorded for each image it
 * pinned, which whoever loads the flow's images verifies the bytes it shows against.
 *
 * @property urls every image URL a node of the package can show, as `images` of its `META`
 *   section lists them.
 * @property sha256 the lowercase hex SHA-256 its build recorded for each uploaded image the
 *   package shows, by URL (`META` `imageSha256`). An image URL missing here was typed by a
 *   designer or is worked out on the device, or the package was built before builds recorded
 *   hashes: it is shown unverified.
 */
class FlowPackageImages(val urls: List<String> = emptyList(), val sha256: Map<String, String> = emptyMap()) {
    override fun equals(other: Any?): Boolean = other is FlowPackageImages && other.urls == urls && other.sha256 == sha256

    override fun hashCode(): Int = 31 * urls.hashCode() + sha256.hashCode()

    override fun toString(): String = "FlowPackageImages(urls=$urls, sha256=$sha256)"

    companion object {
        /**
         * The images the flow package [bytes] lists.
         *
         * Reads only the package's section table, string table and metadata; the renderer's
         * runtime is what decodes and validates a package. A package this reader cannot make
         * sense of lists no images and pins none, whatever goes wrong while reading it: the
         * renderer reports a package it cannot show. No count a package states is believed
         * beyond what the bytes left could hold.
         */
        fun of(bytes: ByteArray): FlowPackageImages = try {
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
            FlowPackageImages()
        } catch (error: RuntimeException) {
            // A buffer read past its end, or anything else a malformed package trips.
            FlowPackageImages()
        }

        /**
         * Throws [FlowImageMismatchException] unless [image] hashes to [sha256], the hex SHA-256
         * its flow's build recorded for it; checks nothing for an image the build did not pin
         * (`null`), which cannot be verified. For a renderer that loads a flow's images itself.
         */
        fun verify(image: ByteArray, sha256: String?) {
            if (sha256 != null && FlowPackageStore.sha256Hex(image) != sha256.lowercase()) throw FlowImageMismatchException()
        }
    }
}

/**
 * The bytes of an image its flow's build pinned are not the ones the build recorded: swapped or
 * damaged at rest or on the way. The image is not shown and not kept.
 */
class FlowImageMismatchException : IOException("its bytes are not the ones the flow's build recorded")

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

/** The `images` and `imageSha256` of the metadata object in [meta]; none without them. */
private fun imagesOf(meta: ByteBuffer, strings: List<String>): FlowPackageImages {
    if (meta.get().toInt() != VALUE_OBJECT) throw UnreadablePackage()
    fun string(): String {
        if (meta.get().toInt() != VALUE_STRING) throw UnreadablePackage()
        return strings.getOrNull(meta.int) ?: throw UnreadablePackage()
    }
    var urls = emptyList<String>()
    val sha256 = HashMap<String, String>()
    repeat(meta.count(OBJECT_ENTRY_BYTES)) {
        when (strings.getOrNull(meta.int) ?: throw UnreadablePackage()) {
            "images" -> {
                if (meta.get().toInt() != VALUE_ARRAY) throw UnreadablePackage()
                urls = List(meta.count(STRING_VALUE_BYTES)) { string() }
            }
            "imageSha256" -> {
                if (meta.get().toInt() != VALUE_OBJECT) throw UnreadablePackage()
                repeat(meta.count(4 + STRING_VALUE_BYTES)) {
                    val url = strings.getOrNull(meta.int) ?: throw UnreadablePackage()
                    sha256[url] = string().lowercase()
                }
            }
            else -> skipValue(meta, depth = 1)
        }
    }
    return FlowPackageImages(urls, sha256)
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
