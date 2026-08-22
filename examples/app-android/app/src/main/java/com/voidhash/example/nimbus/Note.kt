package com.voidhash.example.nimbus

import java.util.UUID

/** One Nimbus note. Notes live in memory: this is an SDK example, not a database tutorial. */
data class Note(
    val id: String,
    val title: String,
    val createdAt: Long,
) {
    companion object {
        /** Creates a note with a fresh id and the current timestamp. */
        fun create(title: String): Note = Note(
            id = UUID.randomUUID().toString(),
            title = title,
            createdAt = System.currentTimeMillis(),
        )
    }
}
