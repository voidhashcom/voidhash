<?php

namespace Voidhash\Generated\Core\Model;

class SandboxGrantJsonEncoding
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
     * The grant's id, `person_perk_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The perk the grant gives.
     *
     * @var string
     */
    protected $perkId;
    /**
     * `active` while the person has the perk, `expired` once the access ended.
     *
     * @var string
     */
    protected $status;
    /**
     * When the access ends, as an ISO 8601 timestamp; null when it does not, as for a one-time purchase.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * The grant's id, `person_perk_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The grant's id, `person_perk_...`.
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
     * The perk the grant gives.
     *
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * The perk the grant gives.
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
     * `active` while the person has the perk, `expired` once the access ended.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` while the person has the perk, `expired` once the access ended.
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
     * When the access ends, as an ISO 8601 timestamp; null when it does not, as for a one-time purchase.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the access ends, as an ISO 8601 timestamp; null when it does not, as for a one-time purchase.
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