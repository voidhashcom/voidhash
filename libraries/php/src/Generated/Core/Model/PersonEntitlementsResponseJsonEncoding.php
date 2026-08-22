<?php

namespace Voidhash\Generated\Core\Model;

class PersonEntitlementsResponseJsonEncoding
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
     * @var list<SdkEntitlementGrantJsonEncoding>
     */
    protected $grants;
    /**
     * @return list<SdkEntitlementGrantJsonEncoding>
     */
    public function getGrants(): array
    {
        return $this->grants;
    }
    /**
     * @param list<SdkEntitlementGrantJsonEncoding> $grants
     *
     * @return self
     */
    public function setGrants(array $grants): self
    {
        $this->initialized['grants'] = true;
        $this->grants = $grants;
        return $this;
    }
}