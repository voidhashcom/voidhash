<?php

namespace Voidhash\Generated\Core\Model;

class AutomationDefinition
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
     * The definition format, currently `1`.
     *
     * @var int
     */
    protected $version;
    /**
     * What starts a run of the automation, and the first step.
     *
     * @var AutomationTrigger
     */
    protected $trigger;
    /**
     * The automation's steps, at most 100.
     *
     * @var list<AutomationNode>
     */
    protected $nodes;
    /**
     * Rules that apply to the whole automation rather than one step.
     *
     * @var AutomationSettings
     */
    protected $settings;
    /**
     * The variables the automation declares, at most 50.
     *
     * @var list<AutomationVariable>|null
     */
    protected $variables;
    /**
     * The definition format, currently `1`.
     *
     * @return int
     */
    public function getVersion(): int
    {
        return $this->version;
    }
    /**
     * The definition format, currently `1`.
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
     * What starts a run of the automation, and the first step.
     *
     * @return AutomationTrigger
     */
    public function getTrigger(): AutomationTrigger
    {
        return $this->trigger;
    }
    /**
     * What starts a run of the automation, and the first step.
     *
     * @param AutomationTrigger $trigger
     *
     * @return self
     */
    public function setTrigger(AutomationTrigger $trigger): self
    {
        $this->initialized['trigger'] = true;
        $this->trigger = $trigger;
        return $this;
    }
    /**
     * The automation's steps, at most 100.
     *
     * @return list<AutomationNode>
     */
    public function getNodes(): array
    {
        return $this->nodes;
    }
    /**
     * The automation's steps, at most 100.
     *
     * @param list<AutomationNode> $nodes
     *
     * @return self
     */
    public function setNodes(array $nodes): self
    {
        $this->initialized['nodes'] = true;
        $this->nodes = $nodes;
        return $this;
    }
    /**
     * Rules that apply to the whole automation rather than one step.
     *
     * @return AutomationSettings
     */
    public function getSettings(): AutomationSettings
    {
        return $this->settings;
    }
    /**
     * Rules that apply to the whole automation rather than one step.
     *
     * @param AutomationSettings $settings
     *
     * @return self
     */
    public function setSettings(AutomationSettings $settings): self
    {
        $this->initialized['settings'] = true;
        $this->settings = $settings;
        return $this;
    }
    /**
     * The variables the automation declares, at most 50.
     *
     * @return list<AutomationVariable>|null
     */
    public function getVariables(): ?array
    {
        return $this->variables;
    }
    /**
     * The variables the automation declares, at most 50.
     *
     * @param list<AutomationVariable>|null $variables
     *
     * @return self
     */
    public function setVariables(?array $variables): self
    {
        $this->initialized['variables'] = true;
        $this->variables = $variables;
        return $this;
    }
}