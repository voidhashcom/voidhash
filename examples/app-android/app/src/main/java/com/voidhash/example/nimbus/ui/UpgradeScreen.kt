package com.voidhash.example.nimbus.ui

import android.app.Activity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.voidhash.example.nimbus.NimbusUiState
import com.voidhash.example.nimbus.findActivity
import com.voidhash.sdk.billing.VoidhashProduct

/**
 * The app-owned upgrade screen.
 *
 * Every project starts with no published paywall, so this is what users see
 * first — it is the normal state, not a fallback for an error. Products come
 * from `getProducts()`, buying goes through `purchase(activity, product)`, and
 * Restore calls `restorePurchases()`.
 */
@Composable
fun UpgradeScreen(
    state: NimbusUiState,
    onPurchase: (Activity?, VoidhashProduct) -> Unit,
    onRestore: () -> Unit,
    onReload: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val activity = LocalContext.current.findActivity()

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            SectionCard(
                title = if (state.isPro) "You are on Pro" else "Nimbus Pro",
                subtitle = if (state.isPro) {
                    "The pro perk is active. Nothing to buy."
                } else {
                    "Unlimited notes and export."
                },
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onRestore, enabled = !state.isRestoring) {
                        Text(if (state.isRestoring) "Restoring…" else "Restore purchases")
                    }
                    TextButton(onClick = onReload, enabled = !state.isLoadingProducts) {
                        Text("Reload products")
                    }
                }
            }
        }

        if (state.productsError != null) {
            item {
                SectionCard(title = "Products could not be loaded") {
                    ErrorText(state.productsError)
                    TextButton(onClick = onReload) { Text("Try again") }
                }
            }
        }

        if (state.products.isEmpty() && state.productsError == null) {
            item {
                SectionCard(
                    title = if (state.isLoadingProducts) "Loading products…" else "No products yet",
                    subtitle = if (state.isLoadingProducts) {
                        null
                    } else {
                        "Add pro-monthly, pro-annual or pro-lifetime in Studio, then reload. " +
                            "In development mode the SDK synthesizes them from the dashboard " +
                            "product, so no Play Console setup is needed."
                    },
                ) {
                    if (state.isLoadingProducts) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    }
                }
            }
        }

        items(state.products, key = { it.id }) { product ->
            ProductCard(
                product = product,
                isPending = state.pendingProductId == product.id,
                isEnabled = state.pendingProductId == null && !state.isPro,
                onPurchase = { onPurchase(activity, product) },
            )
        }
    }
}

@Composable
private fun ProductCard(
    product: VoidhashProduct,
    isPending: Boolean,
    isEnabled: Boolean,
    onPurchase: () -> Unit,
) {
    SectionCard(
        title = product.displayName.ifBlank { product.name },
        subtitle = product.slug.ifBlank { product.id },
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(product.displayPrice, style = MaterialTheme.typography.titleLarge)
                val period = product.billingPeriod
                if (period != null) {
                    Text(
                        period,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Button(onClick = onPurchase, enabled = isEnabled && !isPending) {
                if (isPending) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp))
                } else {
                    Text("Buy")
                }
            }
        }
    }
}
