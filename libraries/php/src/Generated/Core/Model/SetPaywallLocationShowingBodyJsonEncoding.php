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
     * The paywall to show, `pw_...`; it must have a deployed build.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The paywall to show, `pw_...`; it must have a deployed build.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall to show, `pw_...`; it must have a deployed build.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
}