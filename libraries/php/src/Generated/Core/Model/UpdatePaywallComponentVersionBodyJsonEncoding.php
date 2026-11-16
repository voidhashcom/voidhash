<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePaywallComponentVersionBodyJsonEncoding
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
     * `true` deprecates the version; `false` lifts its deprecation.
     *
     * @var bool|null
     */
    protected $isDeprecated;
    /**
     * `true` deprecates the version; `false` lifts its deprecation.
     *
     * @return bool|null
     */
    public function getIsDeprecated(): ?bool
    {
        return $this->isDeprecated;
    }
    /**
     * `true` deprecates the version; `false` lifts its deprecation.
     *
     * @param bool|null $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(?bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
}