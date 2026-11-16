<?php

namespace Voidhash\Generated\Core\Model;

class MetaMeasurementSettingsJsonEncoding
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
     * The project the settings belong to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * Whether the key that opens Meta's install referrers is set.
     *
     * @var bool
     */
    protected $hasInstallReferrerKey;
    /**
     * Why the key last failed to open an install referrer, so that a wrong key shows: `decrypt_failed` or `invalid_key` when the key did not fit, `key_unreadable` when the stored key could not be read. Null once a new key is set or the key opens a referrer.
     *
     * @var string|null
     */
    protected $installReferrerLastError;
    /**
     * When the key last failed to open an install referrer, as an ISO 8601 timestamp; null with `installReferrerLastError`.
     *
     * @var string|null
     */
    protected $installReferrerLastErrorAt;
    /**
     * Whether purchases of people who agreed to ad data sharing are sent to Meta's Conversions API.
     *
     * @var bool
     */
    protected $isConversionsEnabled;
    /**
     * The Meta dataset (pixel) purchases are sent to; null when not set.
     *
     * @var string|null
     */
    protected $conversionsDatasetId;
    /**
     * Whether the Conversions API access token is set.
     *
     * @var bool
     */
    protected $hasConversionsToken;
    /**
     * While set, Meta lists the events under Test Events instead of counting them; null when not set.
     *
     * @var string|null
     */
    protected $conversionsTestEventCode;
    /**
     * When Meta last took a request, as an ISO 8601 timestamp; null before the first.
     *
     * @var string|null
     */
    protected $conversionsLastSentAt;
    /**
     * When delivery last finished a run, or conversions were turned on if that is later, as an ISO 8601 timestamp. It runs every 15 minutes while they are on, so an old time means it is not running.
     *
     * @var string|null
     */
    protected $conversionsLastRunAt;
    /**
     * Why the last request failed, cleared by one that succeeds or by a new token or dataset; or, with `event_refused` or `unpriced`, the last purchases passed over, which only a new token or dataset or a newer error clears. Null without an error.
     *
     * @var string|null
     */
    protected $conversionsLastError;
    /**
     * When `conversionsLastError` was recorded, as an ISO 8601 timestamp; null without an error.
     *
     * @var string|null
     */
    protected $conversionsLastErrorAt;
    /**
     * What kind of error `conversionsLastError` is: `retryable` when it may pass by itself; `permanent` when something has to change, while delivery waits; `event_refused` when Meta refused one purchase, which was skipped; `unpriced` when purchases had no price an hour after being recorded, and were skipped; `internal` when the fault is not Meta's, such as purchases that could not be read, which the next read of them clears. Null without an error.
     *
     * @var string|null
     */
    protected $conversionsLastErrorKind;
    /**
     * Purchases passed over for good: older than the 7 days Meta accepts, refused by it, or still without a price an hour after being recorded.
     *
     * @var int
     */
    protected $conversionsSkippedTotal;
    /**
     * Purchases Meta refused and that were skipped since it last took one. At ten in a row, with none taken, delivery waits for a fix rather than skip more.
     *
     * @var int
     */
    protected $conversionsRefusedInARow;
    /**
     * Purchases read and not sent since Meta last took one, by why, so that a project sending nothing can see what stops it.
     *
     * @var MetaMeasurementSettingsJsonEncodingConversionsWithheld
     */
    protected $conversionsWithheld;
    /**
     * The project the settings belong to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the settings belong to.
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
     * Whether the key that opens Meta's install referrers is set.
     *
     * @return bool
     */
    public function getHasInstallReferrerKey(): bool
    {
        return $this->hasInstallReferrerKey;
    }
    /**
     * Whether the key that opens Meta's install referrers is set.
     *
     * @param bool $hasInstallReferrerKey
     *
     * @return self
     */
    public function setHasInstallReferrerKey(bool $hasInstallReferrerKey): self
    {
        $this->initialized['hasInstallReferrerKey'] = true;
        $this->hasInstallReferrerKey = $hasInstallReferrerKey;
        return $this;
    }
    /**
     * Why the key last failed to open an install referrer, so that a wrong key shows: `decrypt_failed` or `invalid_key` when the key did not fit, `key_unreadable` when the stored key could not be read. Null once a new key is set or the key opens a referrer.
     *
     * @return string|null
     */
    public function getInstallReferrerLastError(): ?string
    {
        return $this->installReferrerLastError;
    }
    /**
     * Why the key last failed to open an install referrer, so that a wrong key shows: `decrypt_failed` or `invalid_key` when the key did not fit, `key_unreadable` when the stored key could not be read. Null once a new key is set or the key opens a referrer.
     *
     * @param string|null $installReferrerLastError
     *
     * @return self
     */
    public function setInstallReferrerLastError(?string $installReferrerLastError): self
    {
        $this->initialized['installReferrerLastError'] = true;
        $this->installReferrerLastError = $installReferrerLastError;
        return $this;
    }
    /**
     * When the key last failed to open an install referrer, as an ISO 8601 timestamp; null with `installReferrerLastError`.
     *
     * @return string|null
     */
    public function getInstallReferrerLastErrorAt(): ?string
    {
        return $this->installReferrerLastErrorAt;
    }
    /**
     * When the key last failed to open an install referrer, as an ISO 8601 timestamp; null with `installReferrerLastError`.
     *
     * @param string|null $installReferrerLastErrorAt
     *
     * @return self
     */
    public function setInstallReferrerLastErrorAt(?string $installReferrerLastErrorAt): self
    {
        $this->initialized['installReferrerLastErrorAt'] = true;
        $this->installReferrerLastErrorAt = $installReferrerLastErrorAt;
        return $this;
    }
    /**
     * Whether purchases of people who agreed to ad data sharing are sent to Meta's Conversions API.
     *
     * @return bool
     */
    public function getIsConversionsEnabled(): bool
    {
        return $this->isConversionsEnabled;
    }
    /**
     * Whether purchases of people who agreed to ad data sharing are sent to Meta's Conversions API.
     *
     * @param bool $isConversionsEnabled
     *
     * @return self
     */
    public function setIsConversionsEnabled(bool $isConversionsEnabled): self
    {
        $this->initialized['isConversionsEnabled'] = true;
        $this->isConversionsEnabled = $isConversionsEnabled;
        return $this;
    }
    /**
     * The Meta dataset (pixel) purchases are sent to; null when not set.
     *
     * @return string|null
     */
    public function getConversionsDatasetId(): ?string
    {
        return $this->conversionsDatasetId;
    }
    /**
     * The Meta dataset (pixel) purchases are sent to; null when not set.
     *
     * @param string|null $conversionsDatasetId
     *
     * @return self
     */
    public function setConversionsDatasetId(?string $conversionsDatasetId): self
    {
        $this->initialized['conversionsDatasetId'] = true;
        $this->conversionsDatasetId = $conversionsDatasetId;
        return $this;
    }
    /**
     * Whether the Conversions API access token is set.
     *
     * @return bool
     */
    public function getHasConversionsToken(): bool
    {
        return $this->hasConversionsToken;
    }
    /**
     * Whether the Conversions API access token is set.
     *
     * @param bool $hasConversionsToken
     *
     * @return self
     */
    public function setHasConversionsToken(bool $hasConversionsToken): self
    {
        $this->initialized['hasConversionsToken'] = true;
        $this->hasConversionsToken = $hasConversionsToken;
        return $this;
    }
    /**
     * While set, Meta lists the events under Test Events instead of counting them; null when not set.
     *
     * @return string|null
     */
    public function getConversionsTestEventCode(): ?string
    {
        return $this->conversionsTestEventCode;
    }
    /**
     * While set, Meta lists the events under Test Events instead of counting them; null when not set.
     *
     * @param string|null $conversionsTestEventCode
     *
     * @return self
     */
    public function setConversionsTestEventCode(?string $conversionsTestEventCode): self
    {
        $this->initialized['conversionsTestEventCode'] = true;
        $this->conversionsTestEventCode = $conversionsTestEventCode;
        return $this;
    }
    /**
     * When Meta last took a request, as an ISO 8601 timestamp; null before the first.
     *
     * @return string|null
     */
    public function getConversionsLastSentAt(): ?string
    {
        return $this->conversionsLastSentAt;
    }
    /**
     * When Meta last took a request, as an ISO 8601 timestamp; null before the first.
     *
     * @param string|null $conversionsLastSentAt
     *
     * @return self
     */
    public function setConversionsLastSentAt(?string $conversionsLastSentAt): self
    {
        $this->initialized['conversionsLastSentAt'] = true;
        $this->conversionsLastSentAt = $conversionsLastSentAt;
        return $this;
    }
    /**
     * When delivery last finished a run, or conversions were turned on if that is later, as an ISO 8601 timestamp. It runs every 15 minutes while they are on, so an old time means it is not running.
     *
     * @return string|null
     */
    public function getConversionsLastRunAt(): ?string
    {
        return $this->conversionsLastRunAt;
    }
    /**
     * When delivery last finished a run, or conversions were turned on if that is later, as an ISO 8601 timestamp. It runs every 15 minutes while they are on, so an old time means it is not running.
     *
     * @param string|null $conversionsLastRunAt
     *
     * @return self
     */
    public function setConversionsLastRunAt(?string $conversionsLastRunAt): self
    {
        $this->initialized['conversionsLastRunAt'] = true;
        $this->conversionsLastRunAt = $conversionsLastRunAt;
        return $this;
    }
    /**
     * Why the last request failed, cleared by one that succeeds or by a new token or dataset; or, with `event_refused` or `unpriced`, the last purchases passed over, which only a new token or dataset or a newer error clears. Null without an error.
     *
     * @return string|null
     */
    public function getConversionsLastError(): ?string
    {
        return $this->conversionsLastError;
    }
    /**
     * Why the last request failed, cleared by one that succeeds or by a new token or dataset; or, with `event_refused` or `unpriced`, the last purchases passed over, which only a new token or dataset or a newer error clears. Null without an error.
     *
     * @param string|null $conversionsLastError
     *
     * @return self
     */
    public function setConversionsLastError(?string $conversionsLastError): self
    {
        $this->initialized['conversionsLastError'] = true;
        $this->conversionsLastError = $conversionsLastError;
        return $this;
    }
    /**
     * When `conversionsLastError` was recorded, as an ISO 8601 timestamp; null without an error.
     *
     * @return string|null
     */
    public function getConversionsLastErrorAt(): ?string
    {
        return $this->conversionsLastErrorAt;
    }
    /**
     * When `conversionsLastError` was recorded, as an ISO 8601 timestamp; null without an error.
     *
     * @param string|null $conversionsLastErrorAt
     *
     * @return self
     */
    public function setConversionsLastErrorAt(?string $conversionsLastErrorAt): self
    {
        $this->initialized['conversionsLastErrorAt'] = true;
        $this->conversionsLastErrorAt = $conversionsLastErrorAt;
        return $this;
    }
    /**
     * What kind of error `conversionsLastError` is: `retryable` when it may pass by itself; `permanent` when something has to change, while delivery waits; `event_refused` when Meta refused one purchase, which was skipped; `unpriced` when purchases had no price an hour after being recorded, and were skipped; `internal` when the fault is not Meta's, such as purchases that could not be read, which the next read of them clears. Null without an error.
     *
     * @return string|null
     */
    public function getConversionsLastErrorKind(): ?string
    {
        return $this->conversionsLastErrorKind;
    }
    /**
     * What kind of error `conversionsLastError` is: `retryable` when it may pass by itself; `permanent` when something has to change, while delivery waits; `event_refused` when Meta refused one purchase, which was skipped; `unpriced` when purchases had no price an hour after being recorded, and were skipped; `internal` when the fault is not Meta's, such as purchases that could not be read, which the next read of them clears. Null without an error.
     *
     * @param string|null $conversionsLastErrorKind
     *
     * @return self
     */
    public function setConversionsLastErrorKind(?string $conversionsLastErrorKind): self
    {
        $this->initialized['conversionsLastErrorKind'] = true;
        $this->conversionsLastErrorKind = $conversionsLastErrorKind;
        return $this;
    }
    /**
     * Purchases passed over for good: older than the 7 days Meta accepts, refused by it, or still without a price an hour after being recorded.
     *
     * @return int
     */
    public function getConversionsSkippedTotal(): int
    {
        return $this->conversionsSkippedTotal;
    }
    /**
     * Purchases passed over for good: older than the 7 days Meta accepts, refused by it, or still without a price an hour after being recorded.
     *
     * @param int $conversionsSkippedTotal
     *
     * @return self
     */
    public function setConversionsSkippedTotal(int $conversionsSkippedTotal): self
    {
        $this->initialized['conversionsSkippedTotal'] = true;
        $this->conversionsSkippedTotal = $conversionsSkippedTotal;
        return $this;
    }
    /**
     * Purchases Meta refused and that were skipped since it last took one. At ten in a row, with none taken, delivery waits for a fix rather than skip more.
     *
     * @return int
     */
    public function getConversionsRefusedInARow(): int
    {
        return $this->conversionsRefusedInARow;
    }
    /**
     * Purchases Meta refused and that were skipped since it last took one. At ten in a row, with none taken, delivery waits for a fix rather than skip more.
     *
     * @param int $conversionsRefusedInARow
     *
     * @return self
     */
    public function setConversionsRefusedInARow(int $conversionsRefusedInARow): self
    {
        $this->initialized['conversionsRefusedInARow'] = true;
        $this->conversionsRefusedInARow = $conversionsRefusedInARow;
        return $this;
    }
    /**
     * Purchases read and not sent since Meta last took one, by why, so that a project sending nothing can see what stops it.
     *
     * @return MetaMeasurementSettingsJsonEncodingConversionsWithheld
     */
    public function getConversionsWithheld(): MetaMeasurementSettingsJsonEncodingConversionsWithheld
    {
        return $this->conversionsWithheld;
    }
    /**
     * Purchases read and not sent since Meta last took one, by why, so that a project sending nothing can see what stops it.
     *
     * @param MetaMeasurementSettingsJsonEncodingConversionsWithheld $conversionsWithheld
     *
     * @return self
     */
    public function setConversionsWithheld(MetaMeasurementSettingsJsonEncodingConversionsWithheld $conversionsWithheld): self
    {
        $this->initialized['conversionsWithheld'] = true;
        $this->conversionsWithheld = $conversionsWithheld;
        return $this;
    }
}