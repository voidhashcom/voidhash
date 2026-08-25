<?php

namespace Voidhash\Generated\Core\Model;

class UpdateExperimentBodyJsonEncodingVariantsItem
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
    protected $id;
    /**
     * @var bool
     */
    protected $isControl;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var list<UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItem>
     */
    protected $treatments;
    /**
     * @var mixed
     */
    protected $weightBps;
    /**
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }
    /**
     * @param string|null $id
     *
     * @return self
     */
    public function setId(?string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * @return bool
     */
    public function getIsControl(): bool
    {
        return $this->isControl;
    }
    /**
     * @param bool $isControl
     *
     * @return self
     */
    public function setIsControl(bool $isControl): self
    {
        $this->initialized['isControl'] = true;
        $this->isControl = $isControl;
        return $this;
    }
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
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
     * @return list<UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItem>
     */
    public function getTreatments(): array
    {
        return $this->treatments;
    }
    /**
     * @param list<UpdateExperimentBodyJsonEncodingVariantsItemTreatmentsItem> $treatments
     *
     * @return self
     */
    public function setTreatments(array $treatments): self
    {
        $this->initialized['treatments'] = true;
        $this->treatments = $treatments;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getWeightBps()
    {
        return $this->weightBps;
    }
    /**
     * @param mixed $weightBps
     *
     * @return self
     */
    public function setWeightBps($weightBps): self
    {
        $this->initialized['weightBps'] = true;
        $this->weightBps = $weightBps;
        return $this;
    }
}