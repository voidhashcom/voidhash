<?php

namespace Voidhash\Generated\Core\Model;

class ConnectAdAccountBodyJsonEncoding
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
     * The ad account id from Ads Manager, with or without the `act_` prefix.
     *
     * @var string
     */
    protected $externalId;
    /**
     * A system user access token with the `ads_read` permission on the account. Stored encrypted and never returned.
     *
     * @var string
     */
    protected $accessToken;
    /**
     * Days of history the first sync pulls, from 1 to 1095; defaults to 90. Asking a connected account for more pulls the earlier days too.
     *
     * @var int|null
     */
    protected $backfillDays;
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
     * The ad account id from Ads Manager, with or without the `act_` prefix.
     *
     * @return string
     */
    public function getExternalId(): string
    {
        return $this->externalId;
    }
    /**
     * The ad account id from Ads Manager, with or without the `act_` prefix.
     *
     * @param string $externalId
     *
     * @return self
     */
    public function setExternalId(string $externalId): self
    {
        $this->initialized['externalId'] = true;
        $this->externalId = $externalId;
        return $this;
    }
    /**
     * A system user access token with the `ads_read` permission on the account. Stored encrypted and never returned.
     *
     * @return string
     */
    public function getAccessToken(): string
    {
        return $this->accessToken;
    }
    /**
     * A system user access token with the `ads_read` permission on the account. Stored encrypted and never returned.
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
    /**
     * Days of history the first sync pulls, from 1 to 1095; defaults to 90. Asking a connected account for more pulls the earlier days too.
     *
     * @return int|null
     */
    public function getBackfillDays(): ?int
    {
        return $this->backfillDays;
    }
    /**
     * Days of history the first sync pulls, from 1 to 1095; defaults to 90. Asking a connected account for more pulls the earlier days too.
     *
     * @param int|null $backfillDays
     *
     * @return self
     */
    public function setBackfillDays(?int $backfillDays): self
    {
        $this->initialized['backfillDays'] = true;
        $this->backfillDays = $backfillDays;
        return $this;
    }
}