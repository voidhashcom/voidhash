<?php

namespace Voidhash\Generated\Core\Model;

class AvailableAdAccountsJsonEncodingToken
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
     * The token's first and last four characters, such as `EAAB…x9Zq`.
     *
     * @var string
     */
    protected $maskedToken;
    /**
     * Whether it grants `ads_read` (or `ads_management`); without it no account is listed.
     *
     * @var bool
     */
    protected $hasRequiredPermission;
    /**
     * The ads permissions it grants, such as `ads_read`.
     *
     * @var list<string>
     */
    protected $permissions;
    /**
     * The business portfolio that owns the accounts; null when they belong to none or to several.
     *
     * @var string|null
     */
    protected $businessName;
    /**
     * The token's first and last four characters, such as `EAAB…x9Zq`.
     *
     * @return string
     */
    public function getMaskedToken(): string
    {
        return $this->maskedToken;
    }
    /**
     * The token's first and last four characters, such as `EAAB…x9Zq`.
     *
     * @param string $maskedToken
     *
     * @return self
     */
    public function setMaskedToken(string $maskedToken): self
    {
        $this->initialized['maskedToken'] = true;
        $this->maskedToken = $maskedToken;
        return $this;
    }
    /**
     * Whether it grants `ads_read` (or `ads_management`); without it no account is listed.
     *
     * @return bool
     */
    public function getHasRequiredPermission(): bool
    {
        return $this->hasRequiredPermission;
    }
    /**
     * Whether it grants `ads_read` (or `ads_management`); without it no account is listed.
     *
     * @param bool $hasRequiredPermission
     *
     * @return self
     */
    public function setHasRequiredPermission(bool $hasRequiredPermission): self
    {
        $this->initialized['hasRequiredPermission'] = true;
        $this->hasRequiredPermission = $hasRequiredPermission;
        return $this;
    }
    /**
     * The ads permissions it grants, such as `ads_read`.
     *
     * @return list<string>
     */
    public function getPermissions(): array
    {
        return $this->permissions;
    }
    /**
     * The ads permissions it grants, such as `ads_read`.
     *
     * @param list<string> $permissions
     *
     * @return self
     */
    public function setPermissions(array $permissions): self
    {
        $this->initialized['permissions'] = true;
        $this->permissions = $permissions;
        return $this;
    }
    /**
     * The business portfolio that owns the accounts; null when they belong to none or to several.
     *
     * @return string|null
     */
    public function getBusinessName(): ?string
    {
        return $this->businessName;
    }
    /**
     * The business portfolio that owns the accounts; null when they belong to none or to several.
     *
     * @param string|null $businessName
     *
     * @return self
     */
    public function setBusinessName(?string $businessName): self
    {
        $this->initialized['businessName'] = true;
        $this->businessName = $businessName;
        return $this;
    }
}