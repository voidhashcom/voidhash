<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentVariantJsonEncoding
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
    protected $archivedAt;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $experimentId;
    /**
     * @var string
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
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @var mixed
     */
    protected $weightBps;
    /**
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getExperimentId(): string
    {
        return $this->experimentId;
    }
    /**
     * @param string $experimentId
     *
     * @return self
     */
    public function setExperimentId(string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
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