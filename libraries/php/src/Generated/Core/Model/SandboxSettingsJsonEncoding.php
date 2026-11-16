<?php

namespace Voidhash\Generated\Core\Model;

class SandboxSettingsJsonEncoding
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
     * Whether debug builds can buy through the sandbox.
     *
     * @var bool
     */
    protected $isPurchasingEnabled;
    /**
     * Whether debug builds can buy through the sandbox.
     *
     * @return bool
     */
    public function getIsPurchasingEnabled(): bool
    {
        return $this->isPurchasingEnabled;
    }
    /**
     * Whether debug builds can buy through the sandbox.
     *
     * @param bool $isPurchasingEnabled
     *
     * @return self
     */
    public function setIsPurchasingEnabled(bool $isPurchasingEnabled): self
    {
        $this->initialized['isPurchasingEnabled'] = true;
        $this->isPurchasingEnabled = $isPurchasingEnabled;
        return $this;
    }
}