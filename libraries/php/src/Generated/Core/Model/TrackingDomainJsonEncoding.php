<?php

namespace Voidhash\Generated\Core\Model;

class TrackingDomainJsonEncoding
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
     * The tracking domain's id, `tdom_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the domain serves, `proj_...`.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The domain's hostname, lowercased.
     *
     * @var string
     */
    protected $hostname;
    /**
     * Where the domain is in its setup: `pending_dns` waits for its DNS records, `pending_certificate` for its certificate, `active` serves the web SDK, and `failed` stopped (`failureReason` says why). A domain whose DNS does not prove it within seven days is removed.
     *
     * @var string
     */
    protected $status;
    /**
     * Why the domain failed, or a warning about a domain that still serves, such as a CNAME that can no longer be seen, in plain language; null when there is nothing to report.
     *
     * @var string|null
     */
    protected $failureReason;
    /**
     * The DNS records to create at your DNS provider.
     *
     * @var list<TrackingDomainDnsRecordJsonEncoding>
     */
    protected $dnsRecords;
    /**
     * When the domain's DNS and certificate were last checked; null before the first check.
     *
     * @var string|null
     */
    protected $lastCheckedAt;
    /**
     * When the domain last became active; null while it is not active.
     *
     * @var string|null
     */
    protected $activatedAt;
    /**
     * When the domain was added to the project, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The tracking domain's id, `tdom_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The tracking domain's id, `tdom_...`.
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
     * The project the domain serves, `proj_...`.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the domain serves, `proj_...`.
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
     * The domain's hostname, lowercased.
     *
     * @return string
     */
    public function getHostname(): string
    {
        return $this->hostname;
    }
    /**
     * The domain's hostname, lowercased.
     *
     * @param string $hostname
     *
     * @return self
     */
    public function setHostname(string $hostname): self
    {
        $this->initialized['hostname'] = true;
        $this->hostname = $hostname;
        return $this;
    }
    /**
     * Where the domain is in its setup: `pending_dns` waits for its DNS records, `pending_certificate` for its certificate, `active` serves the web SDK, and `failed` stopped (`failureReason` says why). A domain whose DNS does not prove it within seven days is removed.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where the domain is in its setup: `pending_dns` waits for its DNS records, `pending_certificate` for its certificate, `active` serves the web SDK, and `failed` stopped (`failureReason` says why). A domain whose DNS does not prove it within seven days is removed.
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
     * Why the domain failed, or a warning about a domain that still serves, such as a CNAME that can no longer be seen, in plain language; null when there is nothing to report.
     *
     * @return string|null
     */
    public function getFailureReason(): ?string
    {
        return $this->failureReason;
    }
    /**
     * Why the domain failed, or a warning about a domain that still serves, such as a CNAME that can no longer be seen, in plain language; null when there is nothing to report.
     *
     * @param string|null $failureReason
     *
     * @return self
     */
    public function setFailureReason(?string $failureReason): self
    {
        $this->initialized['failureReason'] = true;
        $this->failureReason = $failureReason;
        return $this;
    }
    /**
     * The DNS records to create at your DNS provider.
     *
     * @return list<TrackingDomainDnsRecordJsonEncoding>
     */
    public function getDnsRecords(): array
    {
        return $this->dnsRecords;
    }
    /**
     * The DNS records to create at your DNS provider.
     *
     * @param list<TrackingDomainDnsRecordJsonEncoding> $dnsRecords
     *
     * @return self
     */
    public function setDnsRecords(array $dnsRecords): self
    {
        $this->initialized['dnsRecords'] = true;
        $this->dnsRecords = $dnsRecords;
        return $this;
    }
    /**
     * When the domain's DNS and certificate were last checked; null before the first check.
     *
     * @return string|null
     */
    public function getLastCheckedAt(): ?string
    {
        return $this->lastCheckedAt;
    }
    /**
     * When the domain's DNS and certificate were last checked; null before the first check.
     *
     * @param string|null $lastCheckedAt
     *
     * @return self
     */
    public function setLastCheckedAt(?string $lastCheckedAt): self
    {
        $this->initialized['lastCheckedAt'] = true;
        $this->lastCheckedAt = $lastCheckedAt;
        return $this;
    }
    /**
     * When the domain last became active; null while it is not active.
     *
     * @return string|null
     */
    public function getActivatedAt(): ?string
    {
        return $this->activatedAt;
    }
    /**
     * When the domain last became active; null while it is not active.
     *
     * @param string|null $activatedAt
     *
     * @return self
     */
    public function setActivatedAt(?string $activatedAt): self
    {
        $this->initialized['activatedAt'] = true;
        $this->activatedAt = $activatedAt;
        return $this;
    }
    /**
     * When the domain was added to the project, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the domain was added to the project, as an ISO 8601 timestamp.
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