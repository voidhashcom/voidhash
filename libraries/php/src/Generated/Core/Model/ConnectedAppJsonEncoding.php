<?php

namespace Voidhash\Generated\Core\Model;

class ConnectedAppJsonEncoding
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
     * The connected app's id, a UUID.
     *
     * @var string
     */
    protected $id;
    /**
     * `cli` for the Voidhash CLI, `mcp` for an app connected over MCP.
     *
     * @var string
     */
    protected $kind;
    /**
     * The app as people know it.
     *
     * @var string
     */
    protected $clientName;
    /**
     * What the app reports itself as; unverified and shown only for context. Null when it reported nothing.
     *
     * @var string|null
     */
    protected $reportedName;
    /**
     * The computer the app runs on; null when the app did not report it.
     *
     * @var string|null
     */
    protected $device;
    /**
     * Whether the app is limited to reading, so its changes are refused.
     *
     * @var bool
     */
    protected $isReadOnly;
    /**
     * When the person connected the app, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $connectedAt;
    /**
     * When the app last made a request, to within 10 minutes.
     *
     * @var string
     */
    protected $lastUsedAt;
    /**
     * When the app stops working unless it is used before then: 90 days after its last use.
     *
     * @var string
     */
    protected $idleExpiresAt;
    /**
     * The connected app's id, a UUID.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The connected app's id, a UUID.
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
     * `cli` for the Voidhash CLI, `mcp` for an app connected over MCP.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * `cli` for the Voidhash CLI, `mcp` for an app connected over MCP.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The app as people know it.
     *
     * @return string
     */
    public function getClientName(): string
    {
        return $this->clientName;
    }
    /**
     * The app as people know it.
     *
     * @param string $clientName
     *
     * @return self
     */
    public function setClientName(string $clientName): self
    {
        $this->initialized['clientName'] = true;
        $this->clientName = $clientName;
        return $this;
    }
    /**
     * What the app reports itself as; unverified and shown only for context. Null when it reported nothing.
     *
     * @return string|null
     */
    public function getReportedName(): ?string
    {
        return $this->reportedName;
    }
    /**
     * What the app reports itself as; unverified and shown only for context. Null when it reported nothing.
     *
     * @param string|null $reportedName
     *
     * @return self
     */
    public function setReportedName(?string $reportedName): self
    {
        $this->initialized['reportedName'] = true;
        $this->reportedName = $reportedName;
        return $this;
    }
    /**
     * The computer the app runs on; null when the app did not report it.
     *
     * @return string|null
     */
    public function getDevice(): ?string
    {
        return $this->device;
    }
    /**
     * The computer the app runs on; null when the app did not report it.
     *
     * @param string|null $device
     *
     * @return self
     */
    public function setDevice(?string $device): self
    {
        $this->initialized['device'] = true;
        $this->device = $device;
        return $this;
    }
    /**
     * Whether the app is limited to reading, so its changes are refused.
     *
     * @return bool
     */
    public function getIsReadOnly(): bool
    {
        return $this->isReadOnly;
    }
    /**
     * Whether the app is limited to reading, so its changes are refused.
     *
     * @param bool $isReadOnly
     *
     * @return self
     */
    public function setIsReadOnly(bool $isReadOnly): self
    {
        $this->initialized['isReadOnly'] = true;
        $this->isReadOnly = $isReadOnly;
        return $this;
    }
    /**
     * When the person connected the app, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getConnectedAt(): string
    {
        return $this->connectedAt;
    }
    /**
     * When the person connected the app, as an ISO 8601 timestamp.
     *
     * @param string $connectedAt
     *
     * @return self
     */
    public function setConnectedAt(string $connectedAt): self
    {
        $this->initialized['connectedAt'] = true;
        $this->connectedAt = $connectedAt;
        return $this;
    }
    /**
     * When the app last made a request, to within 10 minutes.
     *
     * @return string
     */
    public function getLastUsedAt(): string
    {
        return $this->lastUsedAt;
    }
    /**
     * When the app last made a request, to within 10 minutes.
     *
     * @param string $lastUsedAt
     *
     * @return self
     */
    public function setLastUsedAt(string $lastUsedAt): self
    {
        $this->initialized['lastUsedAt'] = true;
        $this->lastUsedAt = $lastUsedAt;
        return $this;
    }
    /**
     * When the app stops working unless it is used before then: 90 days after its last use.
     *
     * @return string
     */
    public function getIdleExpiresAt(): string
    {
        return $this->idleExpiresAt;
    }
    /**
     * When the app stops working unless it is used before then: 90 days after its last use.
     *
     * @param string $idleExpiresAt
     *
     * @return self
     */
    public function setIdleExpiresAt(string $idleExpiresAt): self
    {
        $this->initialized['idleExpiresAt'] = true;
        $this->idleExpiresAt = $idleExpiresAt;
        return $this;
    }
}