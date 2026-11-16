<?php

namespace Voidhash\Generated\Core\Model;

class UpdateOrganizationMemberBodyJsonEncoding
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
     * The member's new role, `member` or `admin`; omit to keep it.
     *
     * @var string|null
     */
    protected $role;
    /**
     * The member's new role, `member` or `admin`; omit to keep it.
     *
     * @return string|null
     */
    public function getRole(): ?string
    {
        return $this->role;
    }
    /**
     * The member's new role, `member` or `admin`; omit to keep it.
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