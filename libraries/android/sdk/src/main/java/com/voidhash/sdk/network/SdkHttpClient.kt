package com.voidhash.sdk.network

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Builds the one OkHttp client the SDK shares across the API and ingest paths.
 *
 * A bare `OkHttpClient()` has no call timeout at all, so a half-open connection can hold a
 * request open indefinitely. The explicit budget is 5 s to connect, 10 s per read or write,
 * and 30 s for the whole call including retries and redirects.
 *
 * Sharing one instance also shares its connection pool and dispatcher, which is what OkHttp
 * is designed for; a per-component client leaks threads and sockets.
 */
fun buildSdkHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(5, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .writeTimeout(10, TimeUnit.SECONDS)
    .callTimeout(30, TimeUnit.SECONDS)
    .build()
