<?php

namespace Voidhash\Generated\Core\Model;

class AvailableAdAccountsJsonEncoding
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
     * What Meta reports about the token checked.
     *
     * @var AvailableAdAccountsJsonEncodingToken
     */
    protected $token;
    /**
     * The accounts the token can read, suggested first, then by name.
     *
     * @var list<AvailableAdAccount>
     */
    protected $accounts;
    /**
     * What Meta reports about the token checked.
     *
     * @return AvailableAdAccountsJsonEncodingToken
     */
    public function getToken(): AvailableAdAccountsJsonEncodingToken
    {
        return $this->token;
    }
    /**
     * What Meta reports about the token checked.
     *
     * @param AvailableAdAccountsJsonEncodingToken $token
     *
     * @return self
     */
    public function setToken(AvailableAdAccountsJsonEncodingToken $token): self
    {
        $this->initialized['token'] = true;
        $this->token = $token;
        return $this;
    }
    /**
     * The accounts the token can read, suggested first, then by name.
     *
     * @return list<AvailableAdAccount>
     */
    public function getAccounts(): array
    {
        return $this->accounts;
    }
    /**
     * The accounts the token can read, suggested first, then by name.
     *
     * @param list<AvailableAdAccount> $accounts
     *
     * @return self
     */
    public function setAccounts(array $accounts): self
    {
        $this->initialized['accounts'] = true;
        $this->accounts = $accounts;
        return $this;
    }
}