<?php

namespace Voidhash\Generated\Core\Model;

class CreatePersonGrantBodyJsonEncoding
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
     * The perk to grant, `perk_...`.
     *
     * @var string
     */
    protected $perkId;
    /**
     * When the access ends, as an ISO 8601 timestamp in the future. Leave it out, or send null, for lifetime access until revoked.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * Why it is granted, for your team, such as a support ticket; at most 500 characters. Avoid personal data.
     *
     * @var string|null
     */
    protected $note;
    /**
     * The perk to grant, `perk_...`.
     *
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * The perk to grant, `perk_...`.
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
     * When the access ends, as an ISO 8601 timestamp in the future. Leave it out, or send null, for lifetime access until revoked.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the access ends, as an ISO 8601 timestamp in the future. Leave it out, or send null, for lifetime access until revoked.
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
     * Why it is granted, for your team, such as a support ticket; at most 500 characters. Avoid personal data.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why it is granted, for your team, such as a support ticket; at most 500 characters. Avoid personal data.
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
}