<?php

namespace Voidhash\Generated\Core\Model;

class ProjectSettingsJsonEncodingStoreSandbox
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
     * Whether store sandbox purchases unlock access in production apps. A change applies from the next request; no existing access is rewritten.
     *
     * @var bool
     */
    protected $isUnlockingProduction;
    /**
     * Whether store sandbox purchases unlock access in production apps. A change applies from the next request; no existing access is rewritten.
     *
     * @return bool
     */
    public function getIsUnlockingProduction(): bool
    {
        return $this->isUnlockingProduction;
    }
    /**
     * Whether store sandbox purchases unlock access in production apps. A change applies from the next request; no existing access is rewritten.
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