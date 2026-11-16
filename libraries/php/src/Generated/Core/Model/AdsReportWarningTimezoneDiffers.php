<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningTimezoneDiffers
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
     * What the warning is about.
     *
     * @var string
     */
    protected $code;
    /**
     * The connected ad account's id, `ad_acct_...`.
     *
     * @var string
     */
    protected $accountId;
    /**
     * The ad account's name.
     *
     * @var string
     */
    protected $accountName;
    /**
     * The account's own IANA time zone.
     *
     * @var string
     */
    protected $timezone;
    /**
     * What the warning is about.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * What the warning is about.
     *
     * @param string $code
     *
     * @return self
     */
    public function setCode(string $code): self
    {
        $this->initialized['code'] = true;
        $this->code = $code;
        return $this;
    }
    /**
     * The connected ad account's id, `ad_acct_...`.
     *
     * @return string
     */
    public function getAccountId(): string
    {
        return $this->accountId;
    }
    /**
     * The connected ad account's id, `ad_acct_...`.
     *
     * @param string $accountId
     *
     * @return self
     */
    public function setAccountId(string $accountId): self
    {
        $this->initialized['accountId'] = true;
        $this->accountId = $accountId;
        return $this;
    }
    /**
     * The ad account's name.
     *
     * @return string
     */
    public function getAccountName(): string
    {
        return $this->accountName;
    }
    /**
     * The ad account's name.
     *
     * @param string $accountName
     *
     * @return self
     */
    public function setAccountName(string $accountName): self
    {
        $this->initialized['accountName'] = true;
        $this->accountName = $accountName;
        return $this;
    }
    /**
     * The account's own IANA time zone.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * The account's own IANA time zone.
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
}