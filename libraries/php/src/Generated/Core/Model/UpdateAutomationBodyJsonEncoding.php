<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAutomationBodyJsonEncoding
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
     * The new name, 1 to 255 characters.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new description, up to 1,000 characters; null removes it.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The new environment: `production` or `test`.
     *
     * @var string|null
     */
    protected $environment;
    /**
     * An automation's flow: what starts it, the steps that follow and rules for the whole flow. A draft may be incomplete; its `issues` say what stops it being activated.
     *
     * @var AutomationDefinition
     */
    protected $definition;
    /**
     * The `revision` you read. The update fails with `conflict` (`automation_revision_conflict`) if someone saved since, instead of overwriting them.
     *
     * @var int|null
     */
    protected $expectedRevision;
    /**
     * The new name, 1 to 255 characters.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name, 1 to 255 characters.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The new description, up to 1,000 characters; null removes it.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new description, up to 1,000 characters; null removes it.
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
     * The new environment: `production` or `test`.
     *
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * The new environment: `production` or `test`.
     *
     * @param string|null $environment
     *
     * @return self
     */
    public function setEnvironment(?string $environment): self
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
     * The `revision` you read. The update fails with `conflict` (`automation_revision_conflict`) if someone saved since, instead of overwriting them.
     *
     * @return int|null
     */
    public function getExpectedRevision(): ?int
    {
        return $this->expectedRevision;
    }
    /**
     * The `revision` you read. The update fails with `conflict` (`automation_revision_conflict`) if someone saved since, instead of overwriting them.
     *
     * @param int|null $expectedRevision
     *
     * @return self
     */
    public function setExpectedRevision(?int $expectedRevision): self
    {
        $this->initialized['expectedRevision'] = true;
        $this->expectedRevision = $expectedRevision;
        return $this;
    }
}