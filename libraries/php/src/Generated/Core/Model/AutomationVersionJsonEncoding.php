<?php

namespace Voidhash\Generated\Core\Model;

class AutomationVersionJsonEncoding
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
     * The version's id, `auto_ver_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The automation it is a version of.
     *
     * @var string
     */
    protected $automationId;
    /**
     * The version's number, counting up from 1 with each activation that published a change.
     *
     * @var int
     */
    protected $version;
    /**
     * An automation's flow: what starts it, the steps that follow and rules for the whole flow. A draft may be incomplete; its `issues` say what stops it being activated.
     *
     * @var AutomationDefinition
     */
    protected $definition;
    /**
     * When the version was activated, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The version's id, `auto_ver_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The version's id, `auto_ver_...`.
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
     * The automation it is a version of.
     *
     * @return string
     */
    public function getAutomationId(): string
    {
        return $this->automationId;
    }
    /**
     * The automation it is a version of.
     *
     * @param string $automationId
     *
     * @return self
     */
    public function setAutomationId(string $automationId): self
    {
        $this->initialized['automationId'] = true;
        $this->automationId = $automationId;
        return $this;
    }
    /**
     * The version's number, counting up from 1 with each activation that published a change.
     *
     * @return int
     */
    public function getVersion(): int
    {
        return $this->version;
    }
    /**
     * The version's number, counting up from 1 with each activation that published a change.
     *
     * @param int $version
     *
     * @return self
     */
    public function setVersion(int $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
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
     * When the version was activated, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the version was activated, as an ISO 8601 timestamp.
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
}