<?php

namespace Voidhash\Generated\Core\Model;

class UpdateSandboxSettingsBodyJsonEncoding
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
     * Whether debug builds can buy through the sandbox; sandbox purchases already made stay.
     *
     * @var bool|null
     */
    protected $isPurchasingEnabled;
    /**
     * Whether debug builds can buy through the sandbox; sandbox purchases already made stay.
     *
     * @return bool|null
     */
    public function getIsPurchasingEnabled(): ?bool
    {
        return $this->isPurchasingEnabled;
    }
    /**
     * Whether debug builds can buy through the sandbox; sandbox purchases already made stay.
     *
     * @param bool|null $isPurchasingEnabled
     *
     * @return self
     */
    public function setIsPurchasingEnabled(?bool $isPurchasingEnabled): self
    {
        $this->initialized['isPurchasingEnabled'] = true;
        $this->isPurchasingEnabled = $isPurchasingEnabled;
        return $this;
    }
}