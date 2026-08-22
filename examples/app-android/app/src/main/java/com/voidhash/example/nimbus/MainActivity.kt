package com.voidhash.example.nimbus

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.lifecycleScope
import com.voidhash.example.nimbus.ui.NimbusApp
import com.voidhash.example.nimbus.ui.NimbusTheme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** The single activity. Play Billing and the paywall presenter both launch from it. */
class MainActivity : ComponentActivity() {

    private val viewModel: NimbusViewModel by viewModels { NimbusViewModel.Factory }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NimbusTheme {
                NimbusApp(viewModel)
            }
        }
    }

    override fun onStop() {
        super.onStop()
        // Analytics are batched (20 events or five seconds), so leaving the app
        // is the natural point to drain the queue. `shutdown()` would also end
        // the Play Billing connection, which is wrong to do on every
        // backgrounding — see the README.
        val client = (application as NimbusApplication).voidhash ?: return
        lifecycleScope.launch {
            try {
                client.flush()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                Log.w("Nimbus", "Flushing analytics failed: ${error.message}")
            }
        }
    }
}
