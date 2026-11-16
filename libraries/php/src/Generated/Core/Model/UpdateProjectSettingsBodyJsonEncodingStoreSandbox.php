<?php

namespace Voidhash\Generated\Core\Model;

class UpdateProjectSettingsBodyJsonEncodingStoreSandbox
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
     * Whether store sandbox purchases unlock access in production apps.
     *
     * @var bool
     */
    protected $isUnlockingProduction;
    /**
     * Whether store sandbox purchases unlock access in production apps.
     *
     * @return bool
     */
    public function getIsUnlockingProduction(): bool
    {
        return $this->isUnlockingProduction;
    }
    /**
     * Whether store sandbox purchases unlock access in production apps.
     *
     * @param bool $isUnlockingProduction
     *
     * @return self
     */
    public function setIsUnlockingProduction(bool $isUnlockingProduction): self
    {
        $this->initialized['isUnlockingProduction'] = true;
        $this->isUnlockingProduction = $isUnlockingProduction;
        return $this;
    }
}