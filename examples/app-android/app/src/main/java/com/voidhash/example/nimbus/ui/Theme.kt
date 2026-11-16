package com.voidhash.example.nimbus.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF2F4BF7),
    onPrimary = Color.White,
    secondary = Color(0xFF4B5563),
    background = Color(0xFFFAFAFA),
    surface = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9DAEFF),
    onPrimary = Color(0xFF0B1220),
    secondary = Color(0xFFB6BDC9),
    background = Color(0xFF101114),
    surface = Color(0xFF17191E),
)

/** Material 3 theme for the example. Nothing Voidhash-specific lives here. */
@Composable
fun NimbusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
