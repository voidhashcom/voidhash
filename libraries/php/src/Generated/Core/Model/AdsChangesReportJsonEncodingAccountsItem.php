<?php

namespace Voidhash\Generated\Core\Model;

class AdsChangesReportJsonEncodingAccountsItem
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
     * The connected ad account's id, `ad_acct_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The account's name.
     *
     * @var string
     */
    protected $name;
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @var string
     */
    protected $platform;
    /**
     * ISO 4217 code of the account's amounts.
     *
     * @var string
     */
    protected $currency;
    /**
     * IANA time zone the account's days are cut in.
     *
     * @var string
     */
    protected $timezone;
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; numbers are as of then. Null before the first.
     *
     * @var string|null
     */
    protected $syncedAt;
    /**
     * When Voidhash began keeping the account's history, as an ISO 8601 timestamp; nothing earlier is known. Null before it began.
     *
     * @var string|null
     */
    protected $historySince;
    /**
     * The connected ad account's id, `ad_acct_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The connected ad account's id, `ad_acct_...`.
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
     * The account's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The account's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
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
     * ISO 4217 code of the account's amounts.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of the account's amounts.
     *
     * @param string $currency
     *
     * @return self
     */
    public function setCurrency(string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * IANA time zone the account's days are cut in.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * IANA time zone the account's days are cut in.
     *
     * @param string $timezone
     *
     * @return self
     */
    public function setTimezone(string $timezone): self
    {
        $this->initialized['timezone'] = true;
        $this->timezone = $timezone;
        return $this;
    }
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; numbers are as of then. Null before the first.
     *
     * @return string|null
     */
    public function getSyncedAt(): ?string
    {
        return $this->syncedAt;
    }
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; numbers are as of then. Null before the first.
     *
     * @param string|null $syncedAt
     *
     * @return self
     */
    public function setSyncedAt(?string $syncedAt): self
    {
        $this->initialized['syncedAt'] = true;
        $this->syncedAt = $syncedAt;
        return $this;
    }
    /**
     * When Voidhash began keeping the account's history, as an ISO 8601 timestamp; nothing earlier is known. Null before it began.
     *
     * @return string|null
     */
    public function getHistorySince(): ?string
    {
        return $this->historySince;
    }
    /**
     * When Voidhash began keeping the account's history, as an ISO 8601 timestamp; nothing earlier is known. Null before it began.
     *
     * @param string|null $historySince
     *
     * @return self
     */
    public function setHistorySince(?string $historySince): self
    {
        $this->initialized['historySince'] = true;
        $this->historySince = $historySince;
        return $this;
    }
}