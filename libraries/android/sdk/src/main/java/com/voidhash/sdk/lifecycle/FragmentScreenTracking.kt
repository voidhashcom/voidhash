package com.voidhash.sdk.lifecycle

import android.app.Activity
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentManager
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.analytics.fragmentScreenView

/**
 * Tags a library gives a fragment on its own, which name nothing: ViewPager2's `f<item id>` and
 * the back-stack entry ids Navigation tags its destinations with.
 */
private val LIBRARY_ASSIGNED_TAG = Regex("f\\d+|\\p{XDigit}{8}(-\\p{XDigit}{4}){3}-\\p{XDigit}{12}")

/**
 * Fragment arrivals for `$screen`. Only this object and [FragmentDestinations] touch AndroidX
 * Fragment types, which are `compileOnly`; callers check that the class is present before
 * reaching it.
 */
internal object FragmentScreenTracking {
    /**
     * Registers recursive fragment callbacks on [activity]. Returns `false`
     * when the activity hosts no support fragment manager. [onScreenResumed] runs for each
     * resumed fragment that is reported as a screen, before it is.
     */
    fun register(
        activity: Activity,
        clientProvider: () -> VoidhashClient?,
        onScreenResumed: () -> Unit,
    ): Boolean {
        val fragmentActivity = activity as? FragmentActivity ?: return false
        fragmentActivity.supportFragmentManager.registerFragmentLifecycleCallbacks(
            object : FragmentManager.FragmentLifecycleCallbacks() {
                override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
                    if (!isScreen(f)) return
                    onScreenResumed()
                    clientProvider()?.trackScreen(fragmentScreenView(System.identityHashCode(f), screenName(f)))
                }
            },
            true,
        )
        return true
    }

    /**
     * Whether [fragment] is a screen of its own. A fragment without a view does work for a
     * library, a hidden one is not on screen, and a dialog sits over the screen underneath,
     * which is not resumed again when it closes. Framework containers (`NavHostFragment`) are
     * parts of a screen.
     */
    private fun isScreen(fragment: Fragment): Boolean =
        fragment.view != null &&
            !fragment.isHidden &&
            fragment !is DialogFragment &&
            !fragment.javaClass.name.startsWith("androidx.")

    /**
     * The name [fragment] is reported under. A release build renames every fragment class no
     * layout or navigation graph mentions, so names that survive minification come first: the
     * Navigation destination it shows, then a tag the app gave it, then the class name.
     */
    private fun screenName(fragment: Fragment): String =
        FragmentDestinations.name(fragment)
            ?: fragment.tag?.takeUnless { it.isBlank() || LIBRARY_ASSIGNED_TAG.matches(it) }
            ?: fragment.javaClass.simpleName
}
