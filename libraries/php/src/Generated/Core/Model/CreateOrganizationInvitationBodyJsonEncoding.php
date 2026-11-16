<?php

namespace Voidhash\Generated\Core\Model;

class CreateOrganizationInvitationBodyJsonEncoding
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
     * The email address to invite; inviting it again replaces its pending invitation.
     *
     * @var string
     */
    protected $email;
    /**
     * The role the person gets on accepting, `member` or `admin`. Defaults to `member`.
     *
     * @var string|null
     */
    protected $role;
    /**
     * The email address to invite; inviting it again replaces its pending invitation.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The email address to invite; inviting it again replaces its pending invitation.
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
     * The role the person gets on accepting, `member` or `admin`. Defaults to `member`.
     *
     * @return string|null
     */
    public function getRole(): ?string
    {
        return $this->role;
    }
    /**
     * The role the person gets on accepting, `member` or `admin`. Defaults to `member`.
     *
     * @param string|null $role
     *
     * @return self
     */
    public function setRole(?string $role): self
    {
        $this->initialized['role'] = true;
        $this->role = $role;
        return $this;
    }
}