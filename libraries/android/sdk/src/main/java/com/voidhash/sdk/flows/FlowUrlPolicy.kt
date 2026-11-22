package com.voidhash.sdk.flows

import android.content.Context
import android.content.pm.ApplicationInfo
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okio.ByteString.Companion.decodeBase64
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap

/** Lowercase dotted IPv4 loopback: four parts of 1 to 3 digits, the first 127. */
private val IPV4_LOOPBACK = Regex("""127(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}""")

/** The first 12 bytes of an IPv6 address in `64:ff9b::/96`, NAT64's, which holds an IPv4 one. */
private val NAT64_PREFIX = byteArrayOf(0, 0x64, 0xff.toByte(), 0x9b.toByte(), 0, 0, 0, 0, 0, 0, 0, 0)

/**
 * Which URLs may be downloaded for a flow: its package, the images it shows and the runtime
 * module it runs on. Each must be `https`, written plainly ([isPlainlyWritten]), carry no user name
 * or password, and name a host on the internet rather than the device itself or a network it is
 * on: not `localhost` or a name under it, not a `.local` name, which multicast DNS answers on the
 * local network, and not an IP address in a loopback, private, shared, link-local, multicast or
 * reserved range ([isLocalNetwork]). A flow names its images itself, and may compute them on the
 * device: it must not make the app read its own files or probe the networks the device is on.
 *
 * The app's own backend is trusted in every build: the host of the `baseUrl` it configured is
 * downloaded from over `https` whatever its address, and so is an image the flow's package pins
 * (`imageSha256`), which the backend recorded from its own library and which is verified against
 * its hash, along with the redirects such a download follows. Only a debuggable build makes an
 * exception for `http`, for a local development server: one on the device itself (`localhost`,
 * `127.0.0.0/8`, `::1`), or the host of a `baseUrl` the app configured with `http`, such as
 * `http://10.0.2.2:8788` from an emulator, which it also downloads from over `http`. A redirect may
 * lead to such a server only from another one. Any other URL is refused before anything connects
 * to it, and its download fails. The rule is the one `libraries/test-fixtures/flow-url-policy.json`
 * lists cases of, which the iOS SDK and the flow compiler share.
 *
 * URLs are read as the SDK's HTTP client reads them, and the URL to request is the one this
 * returns. The SDK checks its own downloads; a [FlowRenderer] that downloads something a flow
 * names, such as a runtime module or an image no host loads, requests only what [permitted]
 * returns and follows each redirect only to what [permittedRedirect] returns. An image a flow
 * carries in a `data:` URL is shown without a download, and only as [dataImage] reads it.
 */
object FlowUrlPolicy {
    /**
     * Largest image a `data:` URL may carry: as large as a downloaded image may be
     * ([MAX_FLOW_IMAGE_BYTES]). One a package carries counts against the package's own limit as
     * well; one a component makes on the device has no other bound.
     */
    const val MAX_DATA_IMAGE_BYTES = MAX_FLOW_IMAGE_BYTES

    @Volatile
    private var localServers = false
    private val localHosts: MutableSet<String> = ConcurrentHashMap.newKeySet()
    private val backendHosts: MutableSet<String> = ConcurrentHashMap.newKeySet()

    /** The URL to request for [url], or `null` when a flow may not download it; [pinned] for an image its package pins. */
    @JvmStatic
    @JvmOverloads
    fun permitted(url: String, pinned: Boolean = false): String? =
        decide(url, from = null, localServers, localHosts, backendHosts, pinned)

    /**
     * The URL to request for a redirect from [from] to [location], which may be relative, or
     * `null` when it is refused; [pinned] for the download of an image its package pins.
     */
    @JvmStatic
    @JvmOverloads
    fun permittedRedirect(from: String, location: String, pinned: Boolean = false): String? {
        val origin = from.toHttpUrlOrNull() ?: return null
        val target = origin.resolve(location) ?: return null
        return decide(target.toString(), origin, localServers, localHosts, backendHosts, pinned)
    }

    /**
     * Trusts the host of [baseUrl], the app's own backend, over `https` in every build. The SDK
     * does this when it is configured; hosts are never removed, so this holds for the process.
     */
    internal fun trustBackend(baseUrl: String?) {
        baseUrl?.toHttpUrlOrNull()?.let { backendHosts.add(it.host) }
    }

    /**
     * The image a `data:` URL (RFC 2397) carries, for a flow to show without a download: its
     * bytes, base64 or percent-encoded, when its media type is an image (`image/…`) and they are
     * at most [MAX_DATA_IMAGE_BYTES]. `null` for any other URL and for a malformed one.
     */
    @JvmStatic
    fun dataImage(url: String): ByteArray? {
        if (!url.startsWith("data:")) return null
        val comma = url.indexOf(',')
        if (comma < 0) return null
        val parameters = url.substring(5, comma).split(';')
        if (!parameters.first().lowercase().startsWith("image/")) return null
        val payload = url.substring(comma + 1)
        // No encoding spends more than four characters on a byte: a longer payload is refused
        // before it is decoded.
        if (payload.length > 4 * MAX_DATA_IMAGE_BYTES) return null
        val decoded = percentDecoded(payload) ?: return null
        val bytes = if (parameters.drop(1).any { it.equals("base64", ignoreCase = true) }) {
            String(decoded, Charsets.US_ASCII).decodeBase64()?.toByteArray()
        } else {
            decoded
        }
        return bytes?.takeIf { it.size <= MAX_DATA_IMAGE_BYTES }
    }

    /**
     * Lets flows download over `http` from a server on the device when [context] belongs to a
     * debuggable build; does nothing for any other build. The SDK does this when it is
     * configured; a renderer that presents flows without the SDK may call it.
     */
    @JvmStatic
    fun allowLocalServers(context: Context) {
        if ((context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) localServers = true
    }

    /**
     * For a debuggable build: lets flows download over `http` from a server on the device, and
     * from the host of [baseUrl] when it is an `http` URL. Settings are never undone, so this
     * holds for the process.
     */
    internal fun allowLocalServers(baseUrl: String?) {
        localServers = true
        val base = baseUrl?.toHttpUrlOrNull() ?: return
        if (base.scheme == "http") localHosts.add(base.host)
    }

    /**
     * The canonical [url] when a flow may download it: written plainly, without credentials, over
     * `https` from a host not on the device or its networks, from one of [backendHosts], or
     * anywhere when [pinned]; with [localServers], also from a loopback host or one of
     * [localHosts], over `http` too, and for a redirect only from such a host.
     */
    internal fun decide(
        url: String,
        from: HttpUrl?,
        localServers: Boolean,
        localHosts: Set<String>,
        backendHosts: Set<String> = emptySet(),
        pinned: Boolean = false,
    ): String? {
        if (!isPlainlyWritten(url)) return null
        val parsed = url.toHttpUrlOrNull() ?: return null
        if (parsed.username.isNotEmpty() || parsed.password.isNotEmpty() || !isWellFormed(parsed.host)) return null
        val isDevelopmentServer = { candidate: HttpUrl -> isLoopback(candidate.host) || candidate.host in localHosts }
        if (localServers && isDevelopmentServer(parsed)) {
            return if (from == null || isDevelopmentServer(from)) parsed.toString() else null
        }
        val permitted = parsed.scheme == "https" && (pinned || parsed.host in backendHosts || !isLocalNetwork(parsed.host))
        return if (permitted) parsed.toString() else null
    }

    /**
     * Whether [url] is written so that every URL parser reads the same host from it: its scheme
     * followed by `//`, an authority (up to the first `/`, `?` or `#`) that is not empty and holds
     * no `@`, and no backslash, ASCII whitespace or control character up to its end.
     */
    internal fun isPlainlyWritten(url: String): Boolean {
        val separator = url.indexOf("://")
        if (separator < 0) return false
        val authority = url.substring(separator + 3).takeWhile { it !in "/?#" }
        val head = url.substring(0, separator + 3 + authority.length)
        return authority.isNotEmpty() && '@' !in authority && head.none { it.code <= 0x20 || it.code == 0x7f || it == '\\' }
    }

    /** Whether [host] holds only what a host name or address may (`a`–`z`, digits, `.`, `-`, `_`, `:`), and no empty label but a trailing one. */
    private fun isWellFormed(host: String): Boolean {
        val name = host.removeSuffix(".")
        return name.isNotEmpty() &&
            name.all { it in 'a'..'z' || it in '0'..'9' || it in ".-_:" } &&
            (':' in name || name.split('.').none { it.isEmpty() })
    }

    /** Whether [host] is the device itself as a development server is reached, plainly named. */
    private fun isLoopback(host: String) = host == "localhost" || host == "::1" || IPV4_LOOPBACK.matches(host)

    /**
     * Whether [host] (as the HTTP client reads it: lowercase, without brackets) names the device
     * itself or a network it is on, or is not a host at all: `localhost` or a name under it, a
     * `.local` name, an IP address in `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`,
     * `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4` or
     * `240.0.0.0/4` (broadcast included), or in `::/128`, `::1/128`, `fc00::/7`, `fe80::/9`
     * (link-local and the old site-local), `ff00::/8` or `64:ff9b:1::/48`, or an IPv4 address of
     * those in IPv6 form (mapped, compatible or NAT64).
     *
     * A host whose last label is a number is an IPv4 address in any form `inet_aton` reads
     * (`2130706433` and `0x7f.1` are `127.0.0.1`), and one that is not a valid address that way
     * (`0x17f000001`, `256.0.0.1`) is refused: a resolver may read it as an address all the same,
     * keeping the bits that fit. An IPv6 literal that does not read, or that names an interface
     * (`%`), counts as local. Names that only resolve to such an address are not caught.
     */
    internal fun isLocalNetwork(host: String): Boolean {
        val name = host.removeSuffix(".")
        if (name == "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true
        if (':' in name || '%' in name) return '%' in name || ipv6(name)?.let(::isLocalIpv6) ?: true
        if (!isNumber(name.substringAfterLast('.'))) return false
        return ipv4(name)?.let(::isLocalIpv4) ?: true
    }

    /** Whether [label] is written as a number: decimal or octal digits, or `0x` and hexadecimal digits. */
    private fun isNumber(label: String): Boolean {
        val lower = label.lowercase()
        if (lower.startsWith("0x")) return lower.substring(2).all { Character.digit(it, 16) >= 0 }
        return lower.isNotEmpty() && lower.all { it in '0'..'9' }
    }

    /**
     * The bytes of [host] as an IPv4 address in any form `inet_aton` reads: one to four parts,
     * each decimal, octal (`0` first) or hexadecimal (`0x` first), the last filling the bytes
     * left; `null` when it is none.
     */
    internal fun ipv4(host: String): ByteArray? {
        val parts = host.split('.')
        if (parts.size !in 1..4) return null
        val values = parts.map { part ->
            val text = part.lowercase()
            val (digits, radix) = when {
                text.startsWith("0x") -> text.substring(2) to 16
                text.length > 1 && text.startsWith("0") -> text.substring(1) to 8
                else -> text to 10
            }
            if (text.isEmpty() || digits.length > 32 || digits.any { Character.digit(it, radix) < 0 }) return null
            if (digits.isEmpty()) 0L else digits.toLongOrNull(radix)?.takeIf { it <= 0xffffffffL } ?: return null
        }
        val last = values.last()
        val leading = values.dropLast(1)
        if (leading.any { it > 255 } || last >= 1L shl (8 * (4 - leading.size))) return null
        return ByteArray(4) { index ->
            if (index < leading.size) leading[index].toByte() else (last shr (8 * (3 - index))).toByte()
        }
    }

    /** The 16 bytes of IPv6 literal [host], its last 32 bits possibly a dotted IPv4 address; `null` when it is none. */
    internal fun ipv6(host: String): ByteArray? {
        val halves = host.split("::")
        if (halves.size > 2) return null
        val parts = halves.map { half -> if (half.isEmpty()) emptyList() else half.split(':') }
        val words = parts.mapIndexed { which, groups ->
            groups.flatMapIndexed { index, group ->
                ipv6Words(group, endsAddress = which == parts.lastIndex && index == groups.lastIndex) ?: return null
            }
        }
        val missing = 8 - words.sumOf { it.size }
        if (if (halves.size == 2) missing < 1 else missing != 0) return null
        val all = words[0] + List(if (halves.size == 2) missing else 0) { 0 } + words.drop(1).flatten()
        return ByteArray(16) { index -> (all[index / 2] shr (if (index % 2 == 0) 8 else 0)).toByte() }
    }

    /** The 16-bit words one group of an IPv6 literal stands for: one, or two for a dotted IPv4 address [endsAddress]. */
    private fun ipv6Words(group: String, endsAddress: Boolean): List<Int>? {
        if (endsAddress && '.' in group) {
            val parts = group.split('.')
            if (parts.size != 4 || parts.any { it.isEmpty() || it.length > 3 || !it.all(Char::isDigit) || it.toInt() > 255 }) return null
            val bytes = parts.map(String::toInt)
            return listOf(bytes[0] shl 8 or bytes[1], bytes[2] shl 8 or bytes[3])
        }
        if (group.isEmpty() || group.length > 4 || group.any { Character.digit(it, 16) < 0 }) return null
        return listOf(group.toInt(16))
    }

    private fun isLocalIpv4(address: ByteArray): Boolean {
        val first = address[0].toInt() and 0xff
        val second = address[1].toInt() and 0xff
        return first == 0 || first == 10 || first == 127 || first >= 224 ||
            (first == 100 && second and 0xc0 == 64) ||
            (first == 169 && second == 254) ||
            (first == 172 && second and 0xf0 == 16) ||
            (first == 192 && second == 168) ||
            (first == 198 && second and 0xfe == 18)
    }

    private fun isLocalIpv6(address: ByteArray): Boolean {
        val prefix = address.copyOfRange(0, 12)
        // `::/96` (with `::` and `::1`), `::ffff:0:0/96` and `64:ff9b::/96` hold an IPv4 address.
        val holdsIpv4 = (0 until 10).all { prefix[it] == 0.toByte() } &&
            ((prefix[10] == 0.toByte() && prefix[11] == 0.toByte()) || (prefix[10] == 0xff.toByte() && prefix[11] == 0xff.toByte()))
        if (holdsIpv4 || prefix.contentEquals(NAT64_PREFIX)) return isLocalIpv4(address.copyOfRange(12, 16))
        val first = address[0].toInt() and 0xff
        val second = address[1].toInt() and 0xff
        val localNat64 = address.copyOfRange(0, 6).contentEquals(byteArrayOf(0, 0x64, 0xff.toByte(), 0x9b.toByte(), 0, 1))
        return localNat64 || first == 0xff || first and 0xfe == 0xfc || (first == 0xfe && second and 0x80 == 0x80)
    }

    /** [text]'s bytes with `%XX` escapes decoded; `null` for a malformed escape. */
    private fun percentDecoded(text: String): ByteArray? {
        val out = ByteArrayOutputStream(text.length)
        val bytes = text.toByteArray(Charsets.UTF_8)
        var at = 0
        while (at < bytes.size) {
            val byte = bytes[at]
            if (byte == '%'.code.toByte()) {
                if (at + 2 >= bytes.size) return null
                val high = Character.digit(bytes[at + 1].toInt(), 16)
                val low = Character.digit(bytes[at + 2].toInt(), 16)
                if (high < 0 || low < 0) return null
                out.write(high shl 4 or low)
                at += 3
            } else {
                out.write(byte.toInt())
                at += 1
            }
        }
        return out.toByteArray()
    }
}
