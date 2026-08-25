<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationShowingJsonEncoding
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
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $createdByUserId;
    /**
     * @var string|null
     */
    protected $endedAt;
    /**
     * @var string|null
     */
    protected $featureFlagId;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var PaywallLocationShowingJsonEncodingPaywall|null
     */
    protected $paywall;
    /**
     * @var string|null
     */
    protected $paywallId;
    /**
     * @var string
     */
    protected $paywallLocationId;
    /**
     * @var PaywallLocationShowingJsonEncodingPaywallRelease|null
     */
    protected $paywallRelease;
    /**
     * @var string|null
     */
    protected $paywallReleaseId;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $startedAt;
    /**
     * @var string
     */
    protected $type;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedByUserId(): ?string
    {
        return $this->createdByUserId;
    }
    /**
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
     * @return string|null
     */
    public function getEndedAt(): ?string
    {
        return $this->endedAt;
    }
    /**
     * @param string|null $endedAt
     *
     * @return self
     */
    public function setEndedAt(?string $endedAt): self
    {
        $this->initialized['endedAt'] = true;
        $this->endedAt = $endedAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getFeatureFlagId(): ?string
    {
        return $this->featureFlagId;
    }
    /**
     * @param string|null $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(?string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return PaywallLocationShowingJsonEncodingPaywall|null
     */
    public function getPaywall(): ?PaywallLocationShowingJsonEncodingPaywall
    {
        return $this->paywall;
    }
    /**
     * @param PaywallLocationShowingJsonEncodingPaywall|null $paywall
     *
     * @return self
     */
    public function setPaywall(?PaywallLocationShowingJsonEncodingPaywall $paywall): self
    {
        $this->initialized['paywall'] = true;
        $this->paywall = $paywall;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPaywallId(): ?string
    {
        return $this->paywallId;
    }
    /**
     * @param string|null $paywallId
     *
     * @return self
     */
    public function setPaywallId(?string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * @param string $paywallLocationId
     *
     * @return self
     */
    public function setPaywallLocationId(string $paywallLocationId): self
    {
        $this->initialized['paywallLocationId'] = true;
        $this->paywallLocationId = $paywallLocationId;
        return $this;
    }
    /**
     * @return PaywallLocationShowingJsonEncodingPaywallRelease|null
     */
    public function getPaywallRelease(): ?PaywallLocationShowingJsonEncodingPaywallRelease
    {
        return $this->paywallRelease;
    }
    /**
     * @param PaywallLocationShowingJsonEncodingPaywallRelease|null $paywallRelease
     *
     * @return self
     */
    public function setPaywallRelease(?PaywallLocationShowingJsonEncodingPaywallRelease $paywallRelease): self
    {
        $this->initialized['paywallRelease'] = true;
        $this->paywallRelease = $paywallRelease;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPaywallReleaseId(): ?string
    {
        return $this->paywallReleaseId;
    }
    /**
     * @param string|null $paywallReleaseId
     *
     * @return self
     */
    public function setPaywallReleaseId(?string $paywallReleaseId): self
    {
        $this->initialized['paywallReleaseId'] = true;
        $this->paywallReleaseId = $paywallReleaseId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
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
     * @return string
     */
    public function getStartedAt(): string
    {
        return $this->startedAt;
    }
    /**
     * @param string $startedAt
     *
     * @return self
     */
    public function setStartedAt(string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}