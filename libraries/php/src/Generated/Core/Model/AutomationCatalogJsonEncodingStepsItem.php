<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingStepsItem
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
     * The step's type, a node's `type`.
     *
     * @var string
     */
    protected $type;
    /**
     * `action` for a step that does something, such as sending a push; `flow` for one that waits or chooses a path.
     *
     * @var string
     */
    protected $kind;
    /**
     * The step's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * What the step does.
     *
     * @var string
     */
    protected $description;
    /**
     * The settings of its `config`.
     *
     * @var list<AutomationField>
     */
    protected $fields;
    /**
     * The exits the step always has; a split's branches, a flag's variants and an A/B test's arms come from its settings instead.
     *
     * @var list<AutomationCatalogJsonEncodingStepsItemPortsItem>
     */
    protected $ports;
    /**
     * What later steps can read of it, as `steps.<step>.<key>`; open ones take a name after.
     *
     * @var list<AutomationCatalogJsonEncodingStepsItemOutputsItem>
     */
    protected $outputs;
    /**
     * The permission whoever activates an automation with this step must hold, such as `project:notifications:send`; null when it needs none.
     *
     * @var string|null
     */
    protected $permission;
    /**
     * The step's type, a node's `type`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The step's type, a node's `type`.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * `action` for a step that does something, such as sending a push; `flow` for one that waits or chooses a path.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * `action` for a step that does something, such as sending a push; `flow` for one that waits or chooses a path.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The step's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The step's name, as Studio shows it.
     *
     * @param string $label
     *
     * @return self
     */
    public function setLabel(string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
    /**
     * What the step does.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the step does.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The settings of its `config`.
     *
     * @return list<AutomationField>
     */
    public function getFields(): array
    {
        return $this->fields;
    }
    /**
     * The settings of its `config`.
     *
     * @param list<AutomationField> $fields
     *
     * @return self
     */
    public function setFields(array $fields): self
    {
        $this->initialized['fields'] = true;
        $this->fields = $fields;
        return $this;
    }
    /**
     * The exits the step always has; a split's branches, a flag's variants and an A/B test's arms come from its settings instead.
     *
     * @return list<AutomationCatalogJsonEncodingStepsItemPortsItem>
     */
    public function getPorts(): array
    {
        return $this->ports;
    }
    /**
     * The exits the step always has; a split's branches, a flag's variants and an A/B test's arms come from its settings instead.
     *
     * @param list<AutomationCatalogJsonEncodingStepsItemPortsItem> $ports
     *
     * @return self
     */
    public function setPorts(array $ports): self
    {
        $this->initialized['ports'] = true;
        $this->ports = $ports;
        return $this;
    }
    /**
     * What later steps can read of it, as `steps.<step>.<key>`; open ones take a name after.
     *
     * @return list<AutomationCatalogJsonEncodingStepsItemOutputsItem>
     */
    public function getOutputs(): array
    {
        return $this->outputs;
    }
    /**
     * What later steps can read of it, as `steps.<step>.<key>`; open ones take a name after.
     *
     * @param list<AutomationCatalogJsonEncodingStepsItemOutputsItem> $outputs
     *
     * @return self
     */
    public function setOutputs(array $outputs): self
    {
        $this->initialized['outputs'] = true;
        $this->outputs = $outputs;
        return $this;
    }
    /**
     * The permission whoever activates an automation with this step must hold, such as `project:notifications:send`; null when it needs none.
     *
     * @return string|null
     */
    public function getPermission(): ?string
    {
        return $this->permission;
    }
    /**
     * The permission whoever activates an automation with this step must hold, such as `project:notifications:send`; null when it needs none.
     *
     * @param string|null $permission
     *
     * @return self
     */
    public function setPermission(?string $permission): self
    {
        $this->initialized['permission'] = true;
        $this->permission = $permission;
        return $this;
    }
}