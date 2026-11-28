<?php

namespace Voidhash\Generated\Core\Model;

class PersonEntitlementJsonEncoding
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
     * The perk the person can use, `perk_...`.
     *
     * @var string
     */
    protected $perkId;
    /**
     * The slug SDKs check access by; null when the perk has since been deleted.
     *
     * @var string|null
     */
    protected $perkSlug;
    /**
     * What gives the access: a `subscription`, a one-time `purchase`, or `manual` access your team gave.
     *
     * @var string
     */
    protected $source;
    /**
     * The subscription, purchase or grant (`grant_...`) that gives the access; null only for manual access given before grants were recorded.
     *
     * @var string|null
     */
    protected $sourceId;
    /**
     * The person whose subscription, purchase or grant gives the access: this person, or one merged into them.
     *
     * @var string
     */
    protected $sourcePersonId;
    /**
     * When the access ends, as an ISO 8601 timestamp; null when it does not expire.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * The perk the person can use, `perk_...`.
     *
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * The perk the person can use, `perk_...`.
     *
     * @param string $perkId
     *
     * @return self
     */
    public function setPerkId(string $perkId): self
    {
        $this->initialized['perkId'] = true;
        $this->perkId = $perkId;
        return $this;
    }
    /**
     * The slug SDKs check access by; null when the perk has since been deleted.
     *
     * @return string|null
     */
    public function getPerkSlug(): ?string
    {
        return $this->perkSlug;
    }
    /**
     * The slug SDKs check access by; null when the perk has since been deleted.
     *
     * @param string|null $perkSlug
     *
     * @return self
     */
    public function setPerkSlug(?string $perkSlug): self
    {
        $this->initialized['perkSlug'] = true;
        $this->perkSlug = $perkSlug;
        return $this;
    }
    /**
     * What gives the access: a `subscription`, a one-time `purchase`, or `manual` access your team gave.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * What gives the access: a `subscription`, a one-time `purchase`, or `manual` access your team gave.
     *
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * The subscription, purchase or grant (`grant_...`) that gives the access; null only for manual access given before grants were recorded.
     *
     * @return string|null
     */
    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }
    /**
     * The subscription, purchase or grant (`grant_...`) that gives the access; null only for manual access given before grants were recorded.
     *
     * @param string|null $sourceId
     *
     * @return self
     */
    public function setSourceId(?string $sourceId): self
    {
        $this->initialized['sourceId'] = true;
        $this->sourceId = $sourceId;
        return $this;
    }
    /**
     * The person whose subscription, purchase or grant gives the access: this person, or one merged into them.
     *
     * @return string
     */
    public function getSourcePersonId(): string
    {
        return $this->sourcePersonId;
    }
    /**
     * The person whose subscription, purchase or grant gives the access: this person, or one merged into them.
     *
     * @param string $sourcePersonId
     *
     * @return self
     */
    public function setSourcePersonId(string $sourcePersonId): self
    {
        $this->initialized['sourcePersonId'] = true;
        $this->sourcePersonId = $sourcePersonId;
        return $this;
    }
    /**
     * When the access ends, as an ISO 8601 timestamp; null when it does not expire.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the access ends, as an ISO 8601 timestamp; null when it does not expire.
     *
     * @param string|null $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(?string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
}