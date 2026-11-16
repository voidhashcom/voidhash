<?php

namespace Voidhash\Generated\Core\Model;

class InviteOrganizationMemberBodyJsonEncoding
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
     * The email address of the person's Voidhash account, which must be verified; matched without regard to case.
     *
     * @var string
     */
    protected $email;
    /**
     * The email address of the person's Voidhash account, which must be verified; matched without regard to case.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The email address of the person's Voidhash account, which must be verified; matched without regard to case.
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
}