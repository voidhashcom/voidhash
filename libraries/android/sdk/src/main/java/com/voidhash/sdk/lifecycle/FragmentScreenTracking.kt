package com.voidhash.sdk.lifecycle

import android.app.Activity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentManager
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.analytics.fragmentScreenView

/**
 * Fragment arrivals for `$screen`. This is the only file touching AndroidX
 * Fragment types, which are `compileOnly`; callers check that the class is
 * present before reaching it.
 */
internal object FragmentScreenTracking {
    /**
     * Registers recursive fragment callbacks on [activity]. Returns `false`
     * when the activity hosts no support fragment manager.
     */
    fun register(activity: Activity, clientProvider: () -> VoidhashClient?): Boolean {
        val fragmentActivity = activity as? FragmentActivity ?: return false
        fragmentActivity.supportFragmentManager.registerFragmentLifecycleCallbacks(
            object : FragmentManager.FragmentLifecycleCallbacks() {
                override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {
                    // Framework containers (NavHostFragment, dialogs' bases) are
                    // parts of a screen, not screens.
                    if (f.javaClass.name.startsWith("androidx.")) return
                    clientProvider()?.trackScreen(
                        fragmentScreenView(System.identityHashCode(f), f.javaClass.simpleName),
                    )
                }
            },
            true,
        )
        return true
    }
}
