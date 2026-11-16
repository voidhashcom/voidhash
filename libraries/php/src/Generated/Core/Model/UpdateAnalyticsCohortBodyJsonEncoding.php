<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAnalyticsCohortBodyJsonEncoding
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
     * The new description; null removes it.
     *
     * @var string|null
     */
    protected $description;
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @var AnalyticsCohortDefinition
     */
    protected $definition;
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
     * The new description; null removes it.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new description; null removes it.
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
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @return AnalyticsCohortDefinition
     */
    public function getDefinition(): AnalyticsCohortDefinition
    {
        return $this->definition;
    }
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @param AnalyticsCohortDefinition $definition
     *
     * @return self
     */
    public function setDefinition(AnalyticsCohortDefinition $definition): self
    {
        $this->initialized['definition'] = true;
        $this->definition = $definition;
        return $this;
    }
}