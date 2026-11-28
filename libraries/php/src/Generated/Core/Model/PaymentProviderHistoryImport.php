<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderHistoryImport
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
     * The import's id, `pp_import_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The payment provider whose history is imported.
     *
     * @var string
     */
    protected $paymentProviderId;
    /**
     * The environment the import reads: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @var string
     */
    protected $environment;
    /**
     * `running` until the import ends as `completed`, `canceled`, or `failed` when the store refused the credentials or the import kept failing (see `lastError`).
     *
     * @var string
     */
    protected $status;
    /**
     * What a running import does: `collecting` lists the store's objects, or for the App Store and Google Play takes the purchases you add until you conclude it, while looking up those added; `applying` records them; `done` once the import ended.
     *
     * @var string
     */
    protected $phase;
    /**
     * When the import started, as an ISO 8601 timestamp: objects the store created before it are imported, later ones are recorded as they happen.
     *
     * @var string
     */
    protected $cutoffAt;
    /**
     * When the import was started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $requestedAt;
    /**
     * When the import completed, failed or was canceled, as an ISO 8601 timestamp; null while it runs.
     *
     * @var string|null
     */
    protected $completedAt;
    /**
     * The latest failure: of a step being retried while the import runs, or why it failed; null without one.
     *
     * @var string|null
     */
    protected $lastError;
    /**
     * How many of the store's objects the import found, by what became of them.
     *
     * @var PaymentProviderHistoryImportCounts
     */
    protected $counts;
    /**
     * The import's id, `pp_import_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The import's id, `pp_import_...`.
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
     * The payment provider whose history is imported.
     *
     * @return string
     */
    public function getPaymentProviderId(): string
    {
        return $this->paymentProviderId;
    }
    /**
     * The payment provider whose history is imported.
     *
     * @param string $paymentProviderId
     *
     * @return self
     */
    public function setPaymentProviderId(string $paymentProviderId): self
    {
        $this->initialized['paymentProviderId'] = true;
        $this->paymentProviderId = $paymentProviderId;
        return $this;
    }
    /**
     * The environment the import reads: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment the import reads: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * `running` until the import ends as `completed`, `canceled`, or `failed` when the store refused the credentials or the import kept failing (see `lastError`).
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `running` until the import ends as `completed`, `canceled`, or `failed` when the store refused the credentials or the import kept failing (see `lastError`).
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
     * What a running import does: `collecting` lists the store's objects, or for the App Store and Google Play takes the purchases you add until you conclude it, while looking up those added; `applying` records them; `done` once the import ended.
     *
     * @return string
     */
    public function getPhase(): string
    {
        return $this->phase;
    }
    /**
     * What a running import does: `collecting` lists the store's objects, or for the App Store and Google Play takes the purchases you add until you conclude it, while looking up those added; `applying` records them; `done` once the import ended.
     *
     * @param string $phase
     *
     * @return self
     */
    public function setPhase(string $phase): self
    {
        $this->initialized['phase'] = true;
        $this->phase = $phase;
        return $this;
    }
    /**
     * When the import started, as an ISO 8601 timestamp: objects the store created before it are imported, later ones are recorded as they happen.
     *
     * @return string
     */
    public function getCutoffAt(): string
    {
        return $this->cutoffAt;
    }
    /**
     * When the import started, as an ISO 8601 timestamp: objects the store created before it are imported, later ones are recorded as they happen.
     *
     * @param string $cutoffAt
     *
     * @return self
     */
    public function setCutoffAt(string $cutoffAt): self
    {
        $this->initialized['cutoffAt'] = true;
        $this->cutoffAt = $cutoffAt;
        return $this;
    }
    /**
     * When the import was started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getRequestedAt(): string
    {
        return $this->requestedAt;
    }
    /**
     * When the import was started, as an ISO 8601 timestamp.
     *
     * @param string $requestedAt
     *
     * @return self
     */
    public function setRequestedAt(string $requestedAt): self
    {
        $this->initialized['requestedAt'] = true;
        $this->requestedAt = $requestedAt;
        return $this;
    }
    /**
     * When the import completed, failed or was canceled, as an ISO 8601 timestamp; null while it runs.
     *
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * When the import completed, failed or was canceled, as an ISO 8601 timestamp; null while it runs.
     *
     * @param string|null $completedAt
     *
     * @return self
     */
    public function setCompletedAt(?string $completedAt): self
    {
        $this->initialized['completedAt'] = true;
        $this->completedAt = $completedAt;
        return $this;
    }
    /**
     * The latest failure: of a step being retried while the import runs, or why it failed; null without one.
     *
     * @return string|null
     */
    public function getLastError(): ?string
    {
        return $this->lastError;
    }
    /**
     * The latest failure: of a step being retried while the import runs, or why it failed; null without one.
     *
     * @param string|null $lastError
     *
     * @return self
     */
    public function setLastError(?string $lastError): self
    {
        $this->initialized['lastError'] = true;
        $this->lastError = $lastError;
        return $this;
    }
    /**
     * How many of the store's objects the import found, by what became of them.
     *
     * @return PaymentProviderHistoryImportCounts
     */
    public function getCounts(): PaymentProviderHistoryImportCounts
    {
        return $this->counts;
    }
    /**
     * How many of the store's objects the import found, by what became of them.
     *
     * @param PaymentProviderHistoryImportCounts $counts
     *
     * @return self
     */
    public function setCounts(PaymentProviderHistoryImportCounts $counts): self
    {
        $this->initialized['counts'] = true;
        $this->counts = $counts;
        return $this;
    }
}