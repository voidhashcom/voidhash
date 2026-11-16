<?php

namespace Voidhash\Generated\Core\Model;

class CreateTrackingDomainBodyJsonEncoding
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
     * A subdomain you control, such as `t.example.com`; a scheme, a trailing slash and letter case are ignored. It needs at least three labels, since a CNAME cannot sit at the root of a domain.
     *
     * @var string
     */
    protected $hostname;
    /**
     * A subdomain you control, such as `t.example.com`; a scheme, a trailing slash and letter case are ignored. It needs at least three labels, since a CNAME cannot sit at the root of a domain.
     *
     * @return string
     */
    public function getHostname(): string
    {
        return $this->hostname;
    }
    /**
     * A subdomain you control, such as `t.example.com`; a scheme, a trailing slash and letter case are ignored. It needs at least three labels, since a CNAME cannot sit at the root of a domain.
     *
     * @param string $hostname
     *
     * @return self
     */
    public function setHostname(string $hostname): self
    {
        $this->initialized['hostname'] = true;
        $this->hostname = $hostname;
        return $this;
    }
}