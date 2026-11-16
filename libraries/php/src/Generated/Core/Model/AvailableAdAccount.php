<?php

namespace Voidhash\Generated\Core\Model;

class AvailableAdAccount
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
     * The platform's account id, what `POST /ads/accounts` takes as `externalId`.
     *
     * @var string
     */
    protected $externalId;
    /**
     * The account's name on the platform.
     *
     * @var string
     */
    protected $name;
    /**
     * ISO 4217 code of the account's money.
     *
     * @var string
     */
    protected $currency;
    /**
     * IANA time zone the platform dates the account's reports in.
     *
     * @var string
     */
    protected $timezone;
    /**
     * `connected` when this project connected it already; `inactive` when the platform says it cannot deliver; else `has_spend` or `no_spend`, by whether it ever spent.
     *
     * @var string
     */
    protected $status;
    /**
     * Why the platform says it is not active, in the platform's words; null when active.
     *
     * @var string|null
     */
    protected $inactiveReason;
    /**
     * What it spent to date, in minor units of its own `currency`.
     *
     * @var int
     */
    protected $amountSpent;
    /**
     * Whether it is active, not yet connected and has spend: the accounts to connect first.
     *
     * @var bool
     */
    protected $isSuggested;
    /**
     * Whether this project has connected it already.
     *
     * @var bool
     */
    protected $isConnected;
    /**
     * The platform's account id, what `POST /ads/accounts` takes as `externalId`.
     *
     * @return string
     */
    public function getExternalId(): string
    {
        return $this->externalId;
    }
    /**
     * The platform's account id, what `POST /ads/accounts` takes as `externalId`.
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
     * The account's name on the platform.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The account's name on the platform.
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
     * ISO 4217 code of the account's money.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of the account's money.
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
     * IANA time zone the platform dates the account's reports in.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * IANA time zone the platform dates the account's reports in.
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
     * `connected` when this project connected it already; `inactive` when the platform says it cannot deliver; else `has_spend` or `no_spend`, by whether it ever spent.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `connected` when this project connected it already; `inactive` when the platform says it cannot deliver; else `has_spend` or `no_spend`, by whether it ever spent.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * Why the platform says it is not active, in the platform's words; null when active.
     *
     * @return string|null
     */
    public function getInactiveReason(): ?string
    {
        return $this->inactiveReason;
    }
    /**
     * Why the platform says it is not active, in the platform's words; null when active.
     *
     * @param string|null $inactiveReason
     *
     * @return self
     */
    public function setInactiveReason(?string $inactiveReason): self
    {
        $this->initialized['inactiveReason'] = true;
        $this->inactiveReason = $inactiveReason;
        return $this;
    }
    /**
     * What it spent to date, in minor units of its own `currency`.
     *
     * @return int
     */
    public function getAmountSpent(): int
    {
        return $this->amountSpent;
    }
    /**
     * What it spent to date, in minor units of its own `currency`.
     *
     * @param int $amountSpent
     *
     * @return self
     */
    public function setAmountSpent(int $amountSpent): self
    {
        $this->initialized['amountSpent'] = true;
        $this->amountSpent = $amountSpent;
        return $this;
    }
    /**
     * Whether it is active, not yet connected and has spend: the accounts to connect first.
     *
     * @return bool
     */
    public function getIsSuggested(): bool
    {
        return $this->isSuggested;
    }
    /**
     * Whether it is active, not yet connected and has spend: the accounts to connect first.
     *
     * @param bool $isSuggested
     *
     * @return self
     */
    public function setIsSuggested(bool $isSuggested): self
    {
        $this->initialized['isSuggested'] = true;
        $this->isSuggested = $isSuggested;
        return $this;
    }
    /**
     * Whether this project has connected it already.
     *
     * @return bool
     */
    public function getIsConnected(): bool
    {
        return $this->isConnected;
    }
    /**
     * Whether this project has connected it already.
     *
     * @param bool $isConnected
     *
     * @return self
     */
    public function setIsConnected(bool $isConnected): self
    {
        $this->initialized['isConnected'] = true;
        $this->isConnected = $isConnected;
        return $this;
    }
}