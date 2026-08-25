<?php

namespace Voidhash\Generated\Core\Model;

class UpsertFeatureFlagOverrideBodyJsonEncoding
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
     * @var float
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
     * @return float
     */
    public function getIdentityType(): float
    {
        return $this->identityType;
    }
    /**
     * @param float $identityType
     *
     * @return self
     */
    public function setIdentityType(float $identityType): self
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
}