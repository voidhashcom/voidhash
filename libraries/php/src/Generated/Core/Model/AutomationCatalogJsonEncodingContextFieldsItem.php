<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingContextFieldsItem
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
     * The path a rule or template reads, such as `person.email`.
     *
     * @var string
     */
    protected $path;
    /**
     * The field's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * What the field holds.
     *
     * @var string
     */
    protected $description;
    /**
     * The path a rule or template reads, such as `person.email`.
     *
     * @return string
     */
    public function getPath(): string
    {
        return $this->path;
    }
    /**
     * The path a rule or template reads, such as `person.email`.
     *
     * @param string $path
     *
     * @return self
     */
    public function setPath(string $path): self
    {
        $this->initialized['path'] = true;
        $this->path = $path;
        return $this;
    }
    /**
     * The field's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The field's name, as Studio shows it.
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
     * What the field holds.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the field holds.
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
}