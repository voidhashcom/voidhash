<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildJsonEncoding
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
     * The build's id, `pw_build_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The paywall the build is of, `pw_...`.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The build's number, counting the paywall's builds from 1.
     *
     * @var int
     */
    protected $number;
    /**
     * How far the build got: `building` while it compiles, then `ready` to deploy or `failed`.
     *
     * @var string
     */
    protected $status;
    /**
     * The version of the paywall's design that was built; null for builds made before it was recorded.
     *
     * @var int|null
     */
    protected $documentVersion;
    /**
     * Whether this is the paywall's deployed build, the one end users see.
     *
     * @var bool
     */
    protected $isDeployed;
    /**
     * When the build was last deployed, as an ISO 8601 timestamp; null when it never was.
     *
     * @var string|null
     */
    protected $deployedAt;
    /**
     * The compiled flow a ready build produced, as apps download it.
     *
     * @var FlowPackage
     */
    protected $flowPackage;
    /**
     * Why a build failed.
     *
     * @var PaywallBuildFailure
     */
    protected $failure;
    /**
     * The team member who started the build, `user_...`; null when they no longer exist.
     *
     * @var string|null
     */
    protected $createdByUserId;
    /**
     * When the build was started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the build became `ready` or `failed`, as an ISO 8601 timestamp; null while it is `building`.
     *
     * @var string|null
     */
    protected $finishedAt;
    /**
     * The build's id, `pw_build_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The build's id, `pw_build_...`.
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
     * The paywall the build is of, `pw_...`.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall the build is of, `pw_...`.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * The build's number, counting the paywall's builds from 1.
     *
     * @return int
     */
    public function getNumber(): int
    {
        return $this->number;
    }
    /**
     * The build's number, counting the paywall's builds from 1.
     *
     * @param int $number
     *
     * @return self
     */
    public function setNumber(int $number): self
    {
        $this->initialized['number'] = true;
        $this->number = $number;
        return $this;
    }
    /**
     * How far the build got: `building` while it compiles, then `ready` to deploy or `failed`.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * How far the build got: `building` while it compiles, then `ready` to deploy or `failed`.
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
     * The version of the paywall's design that was built; null for builds made before it was recorded.
     *
     * @return int|null
     */
    public function getDocumentVersion(): ?int
    {
        return $this->documentVersion;
    }
    /**
     * The version of the paywall's design that was built; null for builds made before it was recorded.
     *
     * @param int|null $documentVersion
     *
     * @return self
     */
    public function setDocumentVersion(?int $documentVersion): self
    {
        $this->initialized['documentVersion'] = true;
        $this->documentVersion = $documentVersion;
        return $this;
    }
    /**
     * Whether this is the paywall's deployed build, the one end users see.
     *
     * @return bool
     */
    public function getIsDeployed(): bool
    {
        return $this->isDeployed;
    }
    /**
     * Whether this is the paywall's deployed build, the one end users see.
     *
     * @param bool $isDeployed
     *
     * @return self
     */
    public function setIsDeployed(bool $isDeployed): self
    {
        $this->initialized['isDeployed'] = true;
        $this->isDeployed = $isDeployed;
        return $this;
    }
    /**
     * When the build was last deployed, as an ISO 8601 timestamp; null when it never was.
     *
     * @return string|null
     */
    public function getDeployedAt(): ?string
    {
        return $this->deployedAt;
    }
    /**
     * When the build was last deployed, as an ISO 8601 timestamp; null when it never was.
     *
     * @param string|null $deployedAt
     *
     * @return self
     */
    public function setDeployedAt(?string $deployedAt): self
    {
        $this->initialized['deployedAt'] = true;
        $this->deployedAt = $deployedAt;
        return $this;
    }
    /**
     * The compiled flow a ready build produced, as apps download it.
     *
     * @return FlowPackage
     */
    public function getFlowPackage(): FlowPackage
    {
        return $this->flowPackage;
    }
    /**
     * The compiled flow a ready build produced, as apps download it.
     *
     * @param FlowPackage $flowPackage
     *
     * @return self
     */
    public function setFlowPackage(FlowPackage $flowPackage): self
    {
        $this->initialized['flowPackage'] = true;
        $this->flowPackage = $flowPackage;
        return $this;
    }
    /**
     * Why a build failed.
     *
     * @return PaywallBuildFailure
     */
    public function getFailure(): PaywallBuildFailure
    {
        return $this->failure;
    }
    /**
     * Why a build failed.
     *
     * @param PaywallBuildFailure $failure
     *
     * @return self
     */
    public function setFailure(PaywallBuildFailure $failure): self
    {
        $this->initialized['failure'] = true;
        $this->failure = $failure;
        return $this;
    }
    /**
     * The team member who started the build, `user_...`; null when they no longer exist.
     *
     * @return string|null
     */
    public function getCreatedByUserId(): ?string
    {
        return $this->createdByUserId;
    }
    /**
     * The team member who started the build, `user_...`; null when they no longer exist.
     *
     * @param string|null $createdByUserId
     *
     * @return self
     */
    public function setCreatedByUserId(?string $createdByUserId): self
    {
        $this->initialized['createdByUserId'] = true;
        $this->createdByUserId = $createdByUserId;
        return $this;
    }
    /**
     * When the build was started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the build was started, as an ISO 8601 timestamp.
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
    /**
     * When the build became `ready` or `failed`, as an ISO 8601 timestamp; null while it is `building`.
     *
     * @return string|null
     */
    public function getFinishedAt(): ?string
    {
        return $this->finishedAt;
    }
    /**
     * When the build became `ready` or `failed`, as an ISO 8601 timestamp; null while it is `building`.
     *
     * @param string|null $finishedAt
     *
     * @return self
     */
    public function setFinishedAt(?string $finishedAt): self
    {
        $this->initialized['finishedAt'] = true;
        $this->finishedAt = $finishedAt;
        return $this;
    }
}