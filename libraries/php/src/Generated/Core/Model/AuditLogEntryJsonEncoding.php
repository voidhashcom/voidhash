<?php

namespace Voidhash\Generated\Core\Model;

class AuditLogEntryJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The entry's id, `audit_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the change was made in.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The kind of entity that changed, such as `product`, `paywall`, `paywall_build`, `feature_flag`, `automation` or `api_key`.
     *
     * @var string
     */
    protected $entityType;
    /**
     * The id of the entity that changed.
     *
     * @var string
     */
    protected $entityId;
    /**
     * The entity the changed one belongs to, such as a build's paywall; null when it belongs to none.
     *
     * @var string|null
     */
    protected $parentEntityId;
    /**
     * What happened to the entity: `created`, `updated`, `deleted`, `archived`, `restored`, `enabled`, `disabled`, `published`, `started`, `paused`, `completed`, `withdrawn`, `override_set`, `override_removed`, `target_added` or `target_removed`.
     *
     * @var string
     */
    protected $action;
    /**
     * Who made the change: `user` for a person, also through the CLI or an agent; `api_key` for a secret key; `system` for Voidhash itself.
     *
     * @var string
     */
    protected $actorType;
    /**
     * The user who made the change; null for system and API key changes.
     *
     * @var string|null
     */
    protected $actorUserId;
    /**
     * The changed fields as recorded at the time; null when the change recorded none. Its shape depends on the entity.
     *
     * @var mixed|null
     */
    protected $changes;
    /**
     * Context of the change, such as `via`, the connected app a person used, or `keyId`, the API key that made it; null when there is none.
     *
     * @var mixed|null
     */
    protected $metadata;
    /**
     * When the change was made, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * The entry's id, `audit_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The entry's id, `audit_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project the change was made in.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the change was made in.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The kind of entity that changed, such as `product`, `paywall`, `paywall_build`, `feature_flag`, `automation` or `api_key`.
     *
     * @return string
     */
    public function getEntityType(): string
    {
        return $this->entityType;
    }
    /**
     * The kind of entity that changed, such as `product`, `paywall`, `paywall_build`, `feature_flag`, `automation` or `api_key`.
     *
     * @param string $entityType
     *
     * @return self
     */
    public function setEntityType(string $entityType): self
    {
        $this->initialized['entityType'] = true;
        $this->entityType = $entityType;
        return $this;
    }
    /**
     * The id of the entity that changed.
     *
     * @return string
     */
    public function getEntityId(): string
    {
        return $this->entityId;
    }
    /**
     * The id of the entity that changed.
     *
     * @param string $entityId
     *
     * @return self
     */
    public function setEntityId(string $entityId): self
    {
        $this->initialized['entityId'] = true;
        $this->entityId = $entityId;
        return $this;
    }
    /**
     * The entity the changed one belongs to, such as a build's paywall; null when it belongs to none.
     *
     * @return string|null
     */
    public function getParentEntityId(): ?string
    {
        return $this->parentEntityId;
    }
    /**
     * The entity the changed one belongs to, such as a build's paywall; null when it belongs to none.
     *
     * @param string|null $parentEntityId
     *
     * @return self
     */
    public function setParentEntityId(?string $parentEntityId): self
    {
        $this->initialized['parentEntityId'] = true;
        $this->parentEntityId = $parentEntityId;
        return $this;
    }
    /**
     * What happened to the entity: `created`, `updated`, `deleted`, `archived`, `restored`, `enabled`, `disabled`, `published`, `started`, `paused`, `completed`, `withdrawn`, `override_set`, `override_removed`, `target_added` or `target_removed`.
     *
     * @return string
     */
    public function getAction(): string
    {
        return $this->action;
    }
    /**
     * What happened to the entity: `created`, `updated`, `deleted`, `archived`, `restored`, `enabled`, `disabled`, `published`, `started`, `paused`, `completed`, `withdrawn`, `override_set`, `override_removed`, `target_added` or `target_removed`.
     *
     * @param string $action
     *
     * @return self
     */
    public function setAction(string $action): self
    {
        $this->initialized['action'] = true;
        $this->action = $action;
        return $this;
    }
    /**
     * Who made the change: `user` for a person, also through the CLI or an agent; `api_key` for a secret key; `system` for Voidhash itself.
     *
     * @return string
     */
    public function getActorType(): string
    {
        return $this->actorType;
    }
    /**
     * Who made the change: `user` for a person, also through the CLI or an agent; `api_key` for a secret key; `system` for Voidhash itself.
     *
     * @param string $actorType
     *
     * @return self
     */
    public function setActorType(string $actorType): self
    {
        $this->initialized['actorType'] = true;
        $this->actorType = $actorType;
        return $this;
    }
    /**
     * The user who made the change; null for system and API key changes.
     *
     * @return string|null
     */
    public function getActorUserId(): ?string
    {
        return $this->actorUserId;
    }
    /**
     * The user who made the change; null for system and API key changes.
     *
     * @param string|null $actorUserId
     *
     * @return self
     */
    public function setActorUserId(?string $actorUserId): self
    {
        $this->initialized['actorUserId'] = true;
        $this->actorUserId = $actorUserId;
        return $this;
    }
    /**
     * The changed fields as recorded at the time; null when the change recorded none. Its shape depends on the entity.
     *
     * @return mixed
     */
    public function getChanges()
    {
        return $this->changes;
    }
    /**
     * The changed fields as recorded at the time; null when the change recorded none. Its shape depends on the entity.
     *
     * @param mixed $changes
     *
     * @return self
     */
    public function setChanges($changes): self
    {
        $this->initialized['changes'] = true;
        $this->changes = $changes;
        return $this;
    }
    /**
     * Context of the change, such as `via`, the connected app a person used, or `keyId`, the API key that made it; null when there is none.
     *
     * @return mixed
     */
    public function getMetadata()
    {
        return $this->metadata;
    }
    /**
     * Context of the change, such as `via`, the connected app a person used, or `keyId`, the API key that made it; null when there is none.
     *
     * @param mixed $metadata
     *
     * @return self
     */
    public function setMetadata($metadata): self
    {
        $this->initialized['metadata'] = true;
        $this->metadata = $metadata;
        return $this;
    }
    /**
     * When the change was made, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the change was made, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}