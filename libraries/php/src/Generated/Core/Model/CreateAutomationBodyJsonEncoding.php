<?php

namespace Voidhash\Generated\Core\Model;

class CreateAutomationBodyJsonEncoding
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
     * The automation's name, 1 to 255 characters.
     *
     * @var string
     */
    protected $name;
    /**
     * What the automation is for, up to 1,000 characters.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The environment whose events and purchases the automation reacts to: `production` (the default) or `test`.
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
     * The automation's name, 1 to 255 characters.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The automation's name, 1 to 255 characters.
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
     * What the automation is for, up to 1,000 characters.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the automation is for, up to 1,000 characters.
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
     * The environment whose events and purchases the automation reacts to: `production` (the default) or `test`.
     *
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * The environment whose events and purchases the automation reacts to: `production` (the default) or `test`.
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
}