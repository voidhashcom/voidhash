<?php

namespace Voidhash\Generated\Core\Model;

class SetPaywallLocationShowingBodyJsonEncoding
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
    protected $featureFlagId;
    /**
     * @var string|null
     */
    protected $paywallId;
    /**
     * @var string
     */
    protected $type;
    /**
     * @return string|null
     */
    public function getFeatureFlagId(): ?string
    {
        return $this->featureFlagId;
    }
    /**
     * @param string|null $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(?string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPaywallId(): ?string
    {
        return $this->paywallId;
    }
    /**
     * @param string|null $paywallId
     *
     * @return self
     */
    public function setPaywallId(?string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
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
}