<?php

namespace Voidhash\Generated\Core\Model;

class UpdateExperimentBodyJsonEncoding
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
     * @var string|null
     */
    protected $description;
    /**
     * @var string|null
     */
    protected $hypothesis;
    /**
     * @var string|null
     */
    protected $name;
    /**
     * @var string|null
     */
    protected $primaryMetricEventName;
    /**
     * @var list<string>|null
     */
    protected $secondaryMetricEventNames;
    /**
     * @var list<UpdateExperimentBodyJsonEncodingVariantsItem>|null
     */
    protected $variants;
    /**
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
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
     * @return string|null
     */
    public function getHypothesis(): ?string
    {
        return $this->hypothesis;
    }
    /**
     * @param string|null $hypothesis
     *
     * @return self
     */
    public function setHypothesis(?string $hypothesis): self
    {
        $this->initialized['hypothesis'] = true;
        $this->hypothesis = $hypothesis;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
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
     * @return string|null
     */
    public function getPrimaryMetricEventName(): ?string
    {
        return $this->primaryMetricEventName;
    }
    /**
     * @param string|null $primaryMetricEventName
     *
     * @return self
     */
    public function setPrimaryMetricEventName(?string $primaryMetricEventName): self
    {
        $this->initialized['primaryMetricEventName'] = true;
        $this->primaryMetricEventName = $primaryMetricEventName;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getSecondaryMetricEventNames(): ?array
    {
        return $this->secondaryMetricEventNames;
    }
    /**
     * @param list<string>|null $secondaryMetricEventNames
     *
     * @return self
     */
    public function setSecondaryMetricEventNames(?array $secondaryMetricEventNames): self
    {
        $this->initialized['secondaryMetricEventNames'] = true;
        $this->secondaryMetricEventNames = $secondaryMetricEventNames;
        return $this;
    }
    /**
     * @return list<UpdateExperimentBodyJsonEncodingVariantsItem>|null
     */
    public function getVariants(): ?array
    {
        return $this->variants;
    }
    /**
     * @param list<UpdateExperimentBodyJsonEncodingVariantsItem>|null $variants
     *
     * @return self
     */
    public function setVariants(?array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
}