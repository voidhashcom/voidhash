<?php

namespace Voidhash\Generated\Core\Model;

class TrackingDomainDnsRecordJsonEncoding
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
     * The record's type: `CNAME` or `TXT`.
     *
     * @var string
     */
    protected $type;
    /**
     * The full name to create the record at.
     *
     * @var string
     */
    protected $name;
    /**
     * What the record must hold.
     *
     * @var string
     */
    protected $value;
    /**
     * Why the record is needed: `routing` is the CNAME to the project's own target, which proves the domain belongs to the project; `ownership` is a TXT record offered instead where that CNAME cannot be seen, as when a DNS provider flattens or proxies it; `certificate` records only speed up certificate issuance.
     *
     * @var string
     */
    protected $purpose;
    /**
     * The record's type: `CNAME` or `TXT`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The record's type: `CNAME` or `TXT`.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The full name to create the record at.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The full name to create the record at.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the record must hold.
     *
     * @return string
     */
    public function getValue(): string
    {
        return $this->value;
    }
    /**
     * What the record must hold.
     *
     * @param string $value
     *
     * @return self
     */
    public function setValue(string $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * Why the record is needed: `routing` is the CNAME to the project's own target, which proves the domain belongs to the project; `ownership` is a TXT record offered instead where that CNAME cannot be seen, as when a DNS provider flattens or proxies it; `certificate` records only speed up certificate issuance.
     *
     * @return string
     */
    public function getPurpose(): string
    {
        return $this->purpose;
    }
    /**
     * Why the record is needed: `routing` is the CNAME to the project's own target, which proves the domain belongs to the project; `ownership` is a TXT record offered instead where that CNAME cannot be seen, as when a DNS provider flattens or proxies it; `certificate` records only speed up certificate issuance.
     *
     * @param string $purpose
     *
     * @return self
     */
    public function setPurpose(string $purpose): self
    {
        $this->initialized['purpose'] = true;
        $this->purpose = $purpose;
        return $this;
    }
}