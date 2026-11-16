<?php

namespace Voidhash\Generated\Core\Model;

class AutomationJsonEncoding
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
     * The automation's id, `auto_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the automation belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The automation's name.
     *
     * @var string
     */
    protected $name;
    /**
     * What the automation is for; null when it has no description.
     *
     * @var string|null
     */
    protected $description;
    /**
     * `draft` until first activated, `active` while people enter and move through it, `paused` while nobody enters and runs stay where they are, or `archived` once ended, with every live run cancelled.
     *
     * @var string
     */
    protected $status;
    /**
     * The environment whose events and purchases the automation reacts to: `production` or `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * An automation's flow: what starts it, the steps that follow and rules for the whole flow. A draft may be incomplete; its `issues` say what stops it being activated.
     *
     * @var AutomationDefinition
     */
    protected $definition;
    /**
     * Counts saves of the definition; pass it back to update as `expectedRevision` so as not to overwrite someone.
     *
     * @var int
     */
    protected $revision;
    /**
     * Whether the draft changed since it was last activated; activating again publishes the changes as a new version.
     *
     * @var bool
     */
    protected $hasUnpublishedChanges;
    /**
     * The version new runs follow, `auto_ver_...`; null until the automation is first activated.
     *
     * @var string|null
     */
    protected $activeVersionId;
    /**
     * The trigger type of the activated version, such as `event` or `schedule`; null until first activated.
     *
     * @var string|null
     */
    protected $triggerType;
    /**
     * When the automation was last activated, as an ISO 8601 timestamp; null until then.
     *
     * @var string|null
     */
    protected $activatedAt;
    /**
     * When a `schedule` trigger next enrolls its audience, as an ISO 8601 timestamp; null for other triggers, once a one-time schedule has fired, and once archived.
     *
     * @var string|null
     */
    protected $nextFireAt;
    /**
     * When the automation was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the automation was last changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @var list<AutomationIssue>
     */
    protected $issues;
    /**
     * The automation's id, `auto_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The automation's id, `auto_...`.
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
     * The project the automation belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the automation belongs to.
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
     * The automation's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The automation's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the automation is for; null when it has no description.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the automation is for; null when it has no description.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * `draft` until first activated, `active` while people enter and move through it, `paused` while nobody enters and runs stay where they are, or `archived` once ended, with every live run cancelled.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `draft` until first activated, `active` while people enter and move through it, `paused` while nobody enters and runs stay where they are, or `archived` once ended, with every live run cancelled.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * The environment whose events and purchases the automation reacts to: `production` or `test`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment whose events and purchases the automation reacts to: `production` or `test`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * An automation's flow: what starts it, the steps that follow and rules for the whole flow. A draft may be incomplete; its `issues` say what stops it being activated.
     *
     * @return AutomationDefinition
     */
    public function getDefinition(): AutomationDefinition
    {
        return $this->definition;
    }
    /**
     * An automation's flow: what starts it, the steps that follow and rules for the whole flow. A draft may be incomplete; its `issues` say what stops it being activated.
     *
     * @param AutomationDefinition $definition
     *
     * @return self
     */
    public function setDefinition(AutomationDefinition $definition): self
    {
        $this->initialized['definition'] = true;
        $this->definition = $definition;
        return $this;
    }
    /**
     * Counts saves of the definition; pass it back to update as `expectedRevision` so as not to overwrite someone.
     *
     * @return int
     */
    public function getRevision(): int
    {
        return $this->revision;
    }
    /**
     * Counts saves of the definition; pass it back to update as `expectedRevision` so as not to overwrite someone.
     *
     * @param int $revision
     *
     * @return self
     */
    public function setRevision(int $revision): self
    {
        $this->initialized['revision'] = true;
        $this->revision = $revision;
        return $this;
    }
    /**
     * Whether the draft changed since it was last activated; activating again publishes the changes as a new version.
     *
     * @return bool
     */
    public function getHasUnpublishedChanges(): bool
    {
        return $this->hasUnpublishedChanges;
    }
    /**
     * Whether the draft changed since it was last activated; activating again publishes the changes as a new version.
     *
     * @param bool $hasUnpublishedChanges
     *
     * @return self
     */
    public function setHasUnpublishedChanges(bool $hasUnpublishedChanges): self
    {
        $this->initialized['hasUnpublishedChanges'] = true;
        $this->hasUnpublishedChanges = $hasUnpublishedChanges;
        return $this;
    }
    /**
     * The version new runs follow, `auto_ver_...`; null until the automation is first activated.
     *
     * @return string|null
     */
    public function getActiveVersionId(): ?string
    {
        return $this->activeVersionId;
    }
    /**
     * The version new runs follow, `auto_ver_...`; null until the automation is first activated.
     *
     * @param string|null $activeVersionId
     *
     * @return self
     */
    public function setActiveVersionId(?string $activeVersionId): self
    {
        $this->initialized['activeVersionId'] = true;
        $this->activeVersionId = $activeVersionId;
        return $this;
    }
    /**
     * The trigger type of the activated version, such as `event` or `schedule`; null until first activated.
     *
     * @return string|null
     */
    public function getTriggerType(): ?string
    {
        return $this->triggerType;
    }
    /**
     * The trigger type of the activated version, such as `event` or `schedule`; null until first activated.
     *
     * @param string|null $triggerType
     *
     * @return self
     */
    public function setTriggerType(?string $triggerType): self
    {
        $this->initialized['triggerType'] = true;
        $this->triggerType = $triggerType;
        return $this;
    }
    /**
     * When the automation was last activated, as an ISO 8601 timestamp; null until then.
     *
     * @return string|null
     */
    public function getActivatedAt(): ?string
    {
        return $this->activatedAt;
    }
    /**
     * When the automation was last activated, as an ISO 8601 timestamp; null until then.
     *
     * @param string|null $activatedAt
     *
     * @return self
     */
    public function setActivatedAt(?string $activatedAt): self
    {
        $this->initialized['activatedAt'] = true;
        $this->activatedAt = $activatedAt;
        return $this;
    }
    /**
     * When a `schedule` trigger next enrolls its audience, as an ISO 8601 timestamp; null for other triggers, once a one-time schedule has fired, and once archived.
     *
     * @return string|null
     */
    public function getNextFireAt(): ?string
    {
        return $this->nextFireAt;
    }
    /**
     * When a `schedule` trigger next enrolls its audience, as an ISO 8601 timestamp; null for other triggers, once a one-time schedule has fired, and once archived.
     *
     * @param string|null $nextFireAt
     *
     * @return self
     */
    public function setNextFireAt(?string $nextFireAt): self
    {
        $this->initialized['nextFireAt'] = true;
        $this->nextFireAt = $nextFireAt;
        return $this;
    }
    /**
     * When the automation was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the automation was created, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the automation was last changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the automation was last changed, as an ISO 8601 timestamp.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @return list<AutomationIssue>
     */
    public function getIssues(): array
    {
        return $this->issues;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @param list<AutomationIssue> $issues
     *
     * @return self
     */
    public function setIssues(array $issues): self
    {
        $this->initialized['issues'] = true;
        $this->issues = $issues;
        return $this;
    }
}