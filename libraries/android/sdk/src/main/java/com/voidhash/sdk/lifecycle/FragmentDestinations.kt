package com.voidhash.sdk.lifecycle

import androidx.fragment.app.Fragment
import androidx.navigation.findNavController

private const val NAVIGATION_CLASS = "androidx.navigation.Navigation"

/**
 * Navigation destinations of fragment screens. `androidx.navigation` is `compileOnly`, so its
 * types are only reached once the class is known to be present.
 */
internal object FragmentDestinations {
    private val navigationAvailable: Boolean by lazy {
        runCatching { Class.forName(NAVIGATION_CLASS) }.isSuccess
    }

    /**
     * The route, else the label, of the Navigation destination [fragment] shows; `null` when it
     * shows none — the app does not use Navigation, or the fragment is not a destination's own
     * but a child or a page inside one — and when the app's Navigation cannot say.
     */
    fun name(fragment: Fragment): String? {
        if (!navigationAvailable) return null
        val view = fragment.view ?: return null
        // All of it is guarded: a view outside any NavHost has no controller, and the entry id
        // and the route only exist from Navigation 2.4, while an app on an older release has
        // every class this reaches. Each would otherwise throw out of a fragment lifecycle
        // callback on the main thread.
        return try {
            val entry = view.findNavController().currentBackStackEntry ?: return null
            // Navigation tags the fragment of each destination with the id of its back-stack entry.
            if (entry.id != fragment.tag) return null
            val destination = entry.destination
            (destination.route ?: destination.label?.toString())?.takeIf { it.isNotBlank() }
        } catch (_: LinkageError) {
            null
        } catch (_: RuntimeException) {
            null
        }
    }
}
