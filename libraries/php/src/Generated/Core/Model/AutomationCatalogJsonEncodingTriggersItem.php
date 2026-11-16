<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingTriggersItem
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
     * The trigger's type, a definition's `trigger.type`.
     *
     * @var string
     */
    protected $type;
    /**
     * The trigger's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * When the trigger starts a run.
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
     * The trigger's type, a definition's `trigger.type`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The trigger's type, a definition's `trigger.type`.
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
     * The trigger's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The trigger's name, as Studio shows it.
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
     * When the trigger starts a run.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * When the trigger starts a run.
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
}