<?php

namespace Voidhash\Generated\Core\Model;

class PersonGrantJsonEncoding
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
     * The grant's id, `grant_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The person it was granted to: this person, or one merged into them since, whose grants count for them.
     *
     * @var string
     */
    protected $personId;
    /**
     * The perk it gives, `perk_...`.
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
     * Where it gives access: `production`, to apps using production keys, or `test`, to apps using test keys.
     *
     * @var string
     */
    protected $environment;
    /**
     * `active` while it gives access, `expired` after `expiresAt`, `revoked` once revoked.
     *
     * @var string
     */
    protected $status;
    /**
     * When the access ends, as an ISO 8601 timestamp; null for lifetime access until revoked.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * Why it was granted, as your team wrote it; null when none was given or the person's data was erased.
     *
     * @var string|null
     */
    protected $note;
    /**
     * Who granted it.
     *
     * @var PersonGrantJsonEncodingGrantedBy
     */
    protected $grantedBy;
    /**
     * When it was granted, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When it was revoked, as an ISO 8601 timestamp; null while it is not.
     *
     * @var string|null
     */
    protected $revokedAt;
    /**
     * Who granted or revoked a grant.
     *
     * @var PersonGrantActor
     */
    protected $revokedBy;
    /**
     * The grant's id, `grant_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The grant's id, `grant_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The person it was granted to: this person, or one merged into them since, whose grants count for them.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person it was granted to: this person, or one merged into them since, whose grants count for them.
     *
     * @param string $personId
     *
     * @return self
     */
    public function setPersonId(string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * The perk it gives, `perk_...`.
     *
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * The perk it gives, `perk_...`.
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
     * Where it gives access: `production`, to apps using production keys, or `test`, to apps using test keys.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Where it gives access: `production`, to apps using production keys, or `test`, to apps using test keys.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * `active` while it gives access, `expired` after `expiresAt`, `revoked` once revoked.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` while it gives access, `expired` after `expiresAt`, `revoked` once revoked.
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
    /**
     * When the access ends, as an ISO 8601 timestamp; null for lifetime access until revoked.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the access ends, as an ISO 8601 timestamp; null for lifetime access until revoked.
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
     * Why it was granted, as your team wrote it; null when none was given or the person's data was erased.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why it was granted, as your team wrote it; null when none was given or the person's data was erased.
     *
     * @param string|null $note
     *
     * @return self
     */
    public function setNote(?string $note): self
    {
        $this->initialized['note'] = true;
        $this->note = $note;
        return $this;
    }
    /**
     * Who granted it.
     *
     * @return PersonGrantJsonEncodingGrantedBy
     */
    public function getGrantedBy(): PersonGrantJsonEncodingGrantedBy
    {
        return $this->grantedBy;
    }
    /**
     * Who granted it.
     *
     * @param PersonGrantJsonEncodingGrantedBy $grantedBy
     *
     * @return self
     */
    public function setGrantedBy(PersonGrantJsonEncodingGrantedBy $grantedBy): self
    {
        $this->initialized['grantedBy'] = true;
        $this->grantedBy = $grantedBy;
        return $this;
    }
    /**
     * When it was granted, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When it was granted, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When it was revoked, as an ISO 8601 timestamp; null while it is not.
     *
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
     * When it was revoked, as an ISO 8601 timestamp; null while it is not.
     *
     * @param string|null $revokedAt
     *
     * @return self
     */
    public function setRevokedAt(?string $revokedAt): self
    {
        $this->initialized['revokedAt'] = true;
        $this->revokedAt = $revokedAt;
        return $this;
    }
    /**
     * Who granted or revoked a grant.
     *
     * @return PersonGrantActor
     */
    public function getRevokedBy(): PersonGrantActor
    {
        return $this->revokedBy;
    }
    /**
     * Who granted or revoked a grant.
     *
     * @param PersonGrantActor $revokedBy
     *
     * @return self
     */
    public function setRevokedBy(PersonGrantActor $revokedBy): self
    {
        $this->initialized['revokedBy'] = true;
        $this->revokedBy = $revokedBy;
        return $this;
    }
}