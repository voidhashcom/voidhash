<?php

namespace Voidhash\Generated\Core\Model;

class AdAccountJsonEncoding
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
     * The connected account's id in Voidhash, `ad_acct_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the account is connected to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @var string
     */
    protected $platform;
    /**
     * The platform's account id, without Meta's `act_` prefix.
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
     * ISO 4217 code of the account's spend and budgets, as the platform reports it.
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
     * Days of history the first sync pulls, from 1 to 1095.
     *
     * @var int
     */
    protected $backfillDays;
    /**
     * How the account's sync stands: `pending` until the first sync finishes, `ok` after a successful one, `error` when the last sync failed and is retried, `stopped` when the token was revoked or lost access and the account must be connected again.
     *
     * @var string
     */
    protected $syncStatus;
    /**
     * When the last sync started, as an ISO 8601 timestamp; null before the first.
     *
     * @var string|null
     */
    protected $lastSyncStartedAt;
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; null before the first.
     *
     * @var string|null
     */
    protected $lastSyncSucceededAt;
    /**
     * When the last sync failed, as an ISO 8601 timestamp; null when it did not.
     *
     * @var string|null
     */
    protected $lastSyncErrorAt;
    /**
     * Why the last sync failed; cleared by a successful sync.
     *
     * @var string|null
     */
    protected $lastSyncError;
    /**
     * When the account is next synced, as an ISO 8601 timestamp; null while syncing is stopped.
     *
     * @var string|null
     */
    protected $nextSyncAt;
    /**
     * The account's spending limit on the platform; null without a limit.
     *
     * @var AdAccountJsonEncodingSpendCap|null
     */
    protected $spendCap;
    /**
     * When the account was first connected, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The connected account's id in Voidhash, `ad_acct_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The connected account's id in Voidhash, `ad_acct_...`.
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
     * The project the account is connected to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the account is connected to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
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
     * The platform's account id, without Meta's `act_` prefix.
     *
     * @return string
     */
    public function getExternalId(): string
    {
        return $this->externalId;
    }
    /**
     * The platform's account id, without Meta's `act_` prefix.
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
     * ISO 4217 code of the account's spend and budgets, as the platform reports it.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of the account's spend and budgets, as the platform reports it.
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
     * Days of history the first sync pulls, from 1 to 1095.
     *
     * @return int
     */
    public function getBackfillDays(): int
    {
        return $this->backfillDays;
    }
    /**
     * Days of history the first sync pulls, from 1 to 1095.
     *
     * @param int $backfillDays
     *
     * @return self
     */
    public function setBackfillDays(int $backfillDays): self
    {
        $this->initialized['backfillDays'] = true;
        $this->backfillDays = $backfillDays;
        return $this;
    }
    /**
     * How the account's sync stands: `pending` until the first sync finishes, `ok` after a successful one, `error` when the last sync failed and is retried, `stopped` when the token was revoked or lost access and the account must be connected again.
     *
     * @return string
     */
    public function getSyncStatus(): string
    {
        return $this->syncStatus;
    }
    /**
     * How the account's sync stands: `pending` until the first sync finishes, `ok` after a successful one, `error` when the last sync failed and is retried, `stopped` when the token was revoked or lost access and the account must be connected again.
     *
     * @param string $syncStatus
     *
     * @return self
     */
    public function setSyncStatus(string $syncStatus): self
    {
        $this->initialized['syncStatus'] = true;
        $this->syncStatus = $syncStatus;
        return $this;
    }
    /**
     * When the last sync started, as an ISO 8601 timestamp; null before the first.
     *
     * @return string|null
     */
    public function getLastSyncStartedAt(): ?string
    {
        return $this->lastSyncStartedAt;
    }
    /**
     * When the last sync started, as an ISO 8601 timestamp; null before the first.
     *
     * @param string|null $lastSyncStartedAt
     *
     * @return self
     */
    public function setLastSyncStartedAt(?string $lastSyncStartedAt): self
    {
        $this->initialized['lastSyncStartedAt'] = true;
        $this->lastSyncStartedAt = $lastSyncStartedAt;
        return $this;
    }
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; null before the first.
     *
     * @return string|null
     */
    public function getLastSyncSucceededAt(): ?string
    {
        return $this->lastSyncSucceededAt;
    }
    /**
     * When a sync last succeeded, as an ISO 8601 timestamp; null before the first.
     *
     * @param string|null $lastSyncSucceededAt
     *
     * @return self
     */
    public function setLastSyncSucceededAt(?string $lastSyncSucceededAt): self
    {
        $this->initialized['lastSyncSucceededAt'] = true;
        $this->lastSyncSucceededAt = $lastSyncSucceededAt;
        return $this;
    }
    /**
     * When the last sync failed, as an ISO 8601 timestamp; null when it did not.
     *
     * @return string|null
     */
    public function getLastSyncErrorAt(): ?string
    {
        return $this->lastSyncErrorAt;
    }
    /**
     * When the last sync failed, as an ISO 8601 timestamp; null when it did not.
     *
     * @param string|null $lastSyncErrorAt
     *
     * @return self
     */
    public function setLastSyncErrorAt(?string $lastSyncErrorAt): self
    {
        $this->initialized['lastSyncErrorAt'] = true;
        $this->lastSyncErrorAt = $lastSyncErrorAt;
        return $this;
    }
    /**
     * Why the last sync failed; cleared by a successful sync.
     *
     * @return string|null
     */
    public function getLastSyncError(): ?string
    {
        return $this->lastSyncError;
    }
    /**
     * Why the last sync failed; cleared by a successful sync.
     *
     * @param string|null $lastSyncError
     *
     * @return self
     */
    public function setLastSyncError(?string $lastSyncError): self
    {
        $this->initialized['lastSyncError'] = true;
        $this->lastSyncError = $lastSyncError;
        return $this;
    }
    /**
     * When the account is next synced, as an ISO 8601 timestamp; null while syncing is stopped.
     *
     * @return string|null
     */
    public function getNextSyncAt(): ?string
    {
        return $this->nextSyncAt;
    }
    /**
     * When the account is next synced, as an ISO 8601 timestamp; null while syncing is stopped.
     *
     * @param string|null $nextSyncAt
     *
     * @return self
     */
    public function setNextSyncAt(?string $nextSyncAt): self
    {
        $this->initialized['nextSyncAt'] = true;
        $this->nextSyncAt = $nextSyncAt;
        return $this;
    }
    /**
     * The account's spending limit on the platform; null without a limit.
     *
     * @return AdAccountJsonEncodingSpendCap|null
     */
    public function getSpendCap(): ?AdAccountJsonEncodingSpendCap
    {
        return $this->spendCap;
    }
    /**
     * The account's spending limit on the platform; null without a limit.
     *
     * @param AdAccountJsonEncodingSpendCap|null $spendCap
     *
     * @return self
     */
    public function setSpendCap(?AdAccountJsonEncodingSpendCap $spendCap): self
    {
        $this->initialized['spendCap'] = true;
        $this->spendCap = $spendCap;
        return $this;
    }
    /**
     * When the account was first connected, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the account was first connected, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}