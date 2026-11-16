<?php

namespace Voidhash\Generated\Core\Model;

class QueryAvailableAdAccountsBodyJsonEncoding
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
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @var string
     */
    protected $platform;
    /**
     * A system user access token to check; it needs `ads_read` on the accounts to list them. Used for this request only and not stored.
     *
     * @var string
     */
    protected $accessToken;
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * A system user access token to check; it needs `ads_read` on the accounts to list them. Used for this request only and not stored.
     *
     * @return string
     */
    public function getAccessToken(): string
    {
        return $this->accessToken;
    }
    /**
     * A system user access token to check; it needs `ads_read` on the accounts to list them. Used for this request only and not stored.
     *
     * @param string $accessToken
     *
     * @return self
     */
    public function setAccessToken(string $accessToken): self
    {
        $this->initialized['accessToken'] = true;
        $this->accessToken = $accessToken;
        return $this;
    }
}