<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncodingEntitlements
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
     * The perks the person has or had, one entry per perk.
     *
     * @var list<SdkEntitlementGrantJsonEncoding>
     */
    protected $grants;
    /**
     * The perks the person has or had, one entry per perk.
     *
     * @return list<SdkEntitlementGrantJsonEncoding>
     */
    public function getGrants(): array
    {
        return $this->grants;
    }
    /**
     * The perks the person has or had, one entry per perk.
     *
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