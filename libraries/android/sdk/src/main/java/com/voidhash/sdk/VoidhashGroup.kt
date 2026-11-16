package com.voidhash.sdk

/**
 * A group the end user belongs to, as [VoidhashClient.setGroups] takes it.
 *
 * @property id the group's id within its type, 1 to 256 characters: what
 *   [VoidhashClient.group] calls the key.
 * @property properties the group's own properties, such as its `name` and `plan`: strings,
 *   numbers or booleans. Other values are left out with a warning.
 */
data class VoidhashGroup @JvmOverloads constructor(
    val id: String,
    val properties: Map<String, Any?> = emptyMap(),
)
