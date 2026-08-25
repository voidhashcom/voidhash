<?php

namespace Voidhash\Generated\Core\Model;

class UpsertFeatureFlagTargetBodyJsonEncoding
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
     * @var float
     */
    protected $identityType;
    /**
     * @var string
     */
    protected $identityValue;
    /**
     * @var float
     */
    protected $listType;
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
     * @return float
     */
    public function getListType(): float
    {
        return $this->listType;
    }
    /**
     * @param float $listType
     *
     * @return self
     */
    public function setListType(float $listType): self
    {
        $this->initialized['listType'] = true;
        $this->listType = $listType;
        return $this;
    }
}