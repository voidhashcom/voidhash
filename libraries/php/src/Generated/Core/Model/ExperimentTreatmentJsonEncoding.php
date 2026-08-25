<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentTreatmentJsonEncoding
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
     * @var mixed
     */
    protected $config;
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
     * @var string
     */
    protected $treatmentType;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @var string
     */
    protected $variantId;
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
     * @return mixed
     */
    public function getConfig()
    {
        return $this->config;
    }
    /**
     * @param mixed $config
     *
     * @return self
     */
    public function setConfig($config): self
    {
        $this->initialized['config'] = true;
        $this->config = $config;
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
     * @return string
     */
    public function getTreatmentType(): string
    {
        return $this->treatmentType;
    }
    /**
     * @param string $treatmentType
     *
     * @return self
     */
    public function setTreatmentType(string $treatmentType): self
    {
        $this->initialized['treatmentType'] = true;
        $this->treatmentType = $treatmentType;
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
     * @return string
     */
    public function getVariantId(): string
    {
        return $this->variantId;
    }
    /**
     * @param string $variantId
     *
     * @return self
     */
    public function setVariantId(string $variantId): self
    {
        $this->initialized['variantId'] = true;
        $this->variantId = $variantId;
        return $this;
    }
}