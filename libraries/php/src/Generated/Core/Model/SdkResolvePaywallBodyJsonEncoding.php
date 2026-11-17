<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvePaywallBodyJsonEncoding
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
     * The slug of the location to show a paywall at.
     *
     * @var string
     */
    protected $locationSlug;
    /**
     * The revision of the location's interface the app was built against. A flow that calls an app action or ends with an outcome the location added later is not served: the person gets the newest earlier release the app can answer, or nothing. Absent means 0, an app that handles nothing a flow asks of it.
     *
     * @var int|null
     */
    protected $interfaceRevision;
    /**
     * The slug of the location to show a paywall at.
     *
     * @return string
     */
    public function getLocationSlug(): string
    {
        return $this->locationSlug;
    }
    /**
     * The slug of the location to show a paywall at.
     *
     * @param string $locationSlug
     *
     * @return self
     */
    public function setLocationSlug(string $locationSlug): self
    {
        $this->initialized['locationSlug'] = true;
        $this->locationSlug = $locationSlug;
        return $this;
    }
    /**
     * The revision of the location's interface the app was built against. A flow that calls an app action or ends with an outcome the location added later is not served: the person gets the newest earlier release the app can answer, or nothing. Absent means 0, an app that handles nothing a flow asks of it.
     *
     * @return int|null
     */
    public function getInterfaceRevision(): ?int
    {
        return $this->interfaceRevision;
    }
    /**
     * The revision of the location's interface the app was built against. A flow that calls an app action or ends with an outcome the location added later is not served: the person gets the newest earlier release the app can answer, or nothing. Absent means 0, an app that handles nothing a flow asks of it.
     *
     * @param int|null $interfaceRevision
     *
     * @return self
     */
    public function setInterfaceRevision(?int $interfaceRevision): self
    {
        $this->initialized['interfaceRevision'] = true;
        $this->interfaceRevision = $interfaceRevision;
        return $this;
    }
}