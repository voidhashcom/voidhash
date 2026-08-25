<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagOverrideJsonEncoding
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
    protected $featureFlagId;
    /**
     * @var bool|null
     */
    protected $forcedEnabled;
    /**
     * @var string|null
     */
    protected $forcedVariantKey;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var mixed
     */
    protected $identityType;
    /**
     * @var string
     */
    protected $identityValue;
    /**
     * @var string|null
     */
    protected $note;
    /**
     * @var string|null
     */
    protected $updatedAt;
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
    public function getFeatureFlagId(): string
    {
        return $this->featureFlagId;
    }
    /**
     * @param string $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * @return bool|null
     */
    public function getForcedEnabled(): ?bool
    {
        return $this->forcedEnabled;
    }
    /**
     * @param bool|null $forcedEnabled
     *
     * @return self
     */
    public function setForcedEnabled(?bool $forcedEnabled): self
    {
        $this->initialized['forcedEnabled'] = true;
        $this->forcedEnabled = $forcedEnabled;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getForcedVariantKey(): ?string
    {
        return $this->forcedVariantKey;
    }
    /**
     * @param string|null $forcedVariantKey
     *
     * @return self
     */
    public function setForcedVariantKey(?string $forcedVariantKey): self
    {
        $this->initialized['forcedVariantKey'] = true;
        $this->forcedVariantKey = $forcedVariantKey;
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
     * @return mixed
     */
    public function getIdentityType()
    {
        return $this->identityType;
    }
    /**
     * @param mixed $identityType
     *
     * @return self
     */
    public function setIdentityType($identityType): self
    {
        $this->initialized['identityType'] = true;
        $this->identityType = $identityType;
        return $this;
    }
    /**
     * @return string
     */
    public function getIdentityValue(): string
    {
        return $this->identityValue;
    }
    /**
     * @param string $identityValue
     *
     * @return self
     */
    public function setIdentityValue(string $identityValue): self
    {
        $this->initialized['identityValue'] = true;
        $this->identityValue = $identityValue;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * @param string|null $note
     *
     * @return self
     */
    public function setNote(?string $note): self
    {
        $this->initialized['note'] = true;
        $this->note = $note;
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
}