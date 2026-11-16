<?php

namespace Voidhash\Generated\Core\Model;

class OrganizationInvitationJsonEncoding
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
     * The invitation's id, `inv_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization the invitation is to, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The invited email address, lowercased.
     *
     * @var string
     */
    protected $email;
    /**
     * The role the person gets on accepting: `member` or `admin`.
     *
     * @var string
     */
    protected $role;
    /**
     * The person who sent the invitation, `user_...`; null once their account is deleted.
     *
     * @var string|null
     */
    protected $inviterId;
    /**
     * When the invitation was sent, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the invitation's link stops working, seven days after it was sent.
     *
     * @var string
     */
    protected $expiresAt;
    /**
     * The invitation's id, `inv_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The invitation's id, `inv_...`.
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
     * The organization the invitation is to, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization the invitation is to, `org_...`.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * The invited email address, lowercased.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The invited email address, lowercased.
     *
     * @param string $email
     *
     * @return self
     */
    public function setEmail(string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * The role the person gets on accepting: `member` or `admin`.
     *
     * @return string
     */
    public function getRole(): string
    {
        return $this->role;
    }
    /**
     * The role the person gets on accepting: `member` or `admin`.
     *
     * @param string $role
     *
     * @return self
     */
    public function setRole(string $role): self
    {
        $this->initialized['role'] = true;
        $this->role = $role;
        return $this;
    }
    /**
     * The person who sent the invitation, `user_...`; null once their account is deleted.
     *
     * @return string|null
     */
    public function getInviterId(): ?string
    {
        return $this->inviterId;
    }
    /**
     * The person who sent the invitation, `user_...`; null once their account is deleted.
     *
     * @param string|null $inviterId
     *
     * @return self
     */
    public function setInviterId(?string $inviterId): self
    {
        $this->initialized['inviterId'] = true;
        $this->inviterId = $inviterId;
        return $this;
    }
    /**
     * When the invitation was sent, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the invitation was sent, as an ISO 8601 timestamp.
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
     * When the invitation's link stops working, seven days after it was sent.
     *
     * @return string
     */
    public function getExpiresAt(): string
    {
        return $this->expiresAt;
    }
    /**
     * When the invitation's link stops working, seven days after it was sent.
     *
     * @param string $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
}