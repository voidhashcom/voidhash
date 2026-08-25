<?php

namespace Voidhash\Generated\Core\Model;

class DevelopmentSettings
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
     * @var bool
     */
    protected $developmentPurchasesEnabled;
    /**
     * @return bool
     */
    public function getDevelopmentPurchasesEnabled(): bool
    {
        return $this->developmentPurchasesEnabled;
    }
    /**
     * @param bool $developmentPurchasesEnabled
     *
     * @return self
     */
    public function setDevelopmentPurchasesEnabled(bool $developmentPurchasesEnabled): self
    {
        $this->initialized['developmentPurchasesEnabled'] = true;
        $this->developmentPurchasesEnabled = $developmentPurchasesEnabled;
        return $this;
    }
}