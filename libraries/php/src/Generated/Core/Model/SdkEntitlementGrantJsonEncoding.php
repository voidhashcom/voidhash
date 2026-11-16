<?php

namespace Voidhash\Generated\Core\Model;

class SdkEntitlementGrantJsonEncoding
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
     * When the access ends, as an ISO 8601 timestamp; null when it does not expire.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * The id of the perk granted.
     *
     * @var string
     */
    protected $perkId;
    /**
     * The slug of the perk granted, which apps check access by; absent when the perk was deleted.
     *
     * @var string|null
     */
    protected $perkSlug;
    /**
     * What granted the perk: a `subscription`, a one-time `purchase`, or a `manual` grant.
     *
     * @var string
     */
    protected $source;
    /**
     * The id of the subscription or purchase that granted the perk; null for a manual grant.
     *
     * @var string|null
     */
    protected $sourceId;
    /**
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @var string
     */
    protected $sourcePersonId;
    /**
     * `active` while the person has access, `expired` once it ended.
     *
     * @var string
     */
    protected $status;
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
    /**
     * The id of the perk granted.
     *
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * The id of the perk granted.
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
     * The slug of the perk granted, which apps check access by; absent when the perk was deleted.
     *
     * @return string|null
     */
    public function getPerkSlug(): ?string
    {
        return $this->perkSlug;
    }
    /**
     * The slug of the perk granted, which apps check access by; absent when the perk was deleted.
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
     * What granted the perk: a `subscription`, a one-time `purchase`, or a `manual` grant.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * What granted the perk: a `subscription`, a one-time `purchase`, or a `manual` grant.
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
     * The id of the subscription or purchase that granted the perk; null for a manual grant.
     *
     * @return string|null
     */
    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }
    /**
     * The id of the subscription or purchase that granted the perk; null for a manual grant.
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
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @return string
     */
    public function getSourcePersonId(): string
    {
        return $this->sourcePersonId;
    }
    /**
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
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
     * `active` while the person has access, `expired` once it ended.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` while the person has access, `expired` once it ended.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
}