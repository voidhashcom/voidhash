<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncoding
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
     * @var string
     */
    protected $id;
    /**
     * @var SdkResolvedPaywallShowingJsonEncodingPaywall|null
     */
    protected $paywall;
    /**
     * @var string|null
     */
    protected $paywallId;
    /**
     * @var SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null
     */
    protected $paywallRelease;
    /**
     * @var string|null
     */
    protected $paywallReleaseId;
    /**
     * @var string
     */
    protected $startedAt;
    /**
     * @var string
     */
    protected $type;
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
     * @return SdkResolvedPaywallShowingJsonEncodingPaywall|null
     */
    public function getPaywall(): ?SdkResolvedPaywallShowingJsonEncodingPaywall
    {
        return $this->paywall;
    }
    /**
     * @param SdkResolvedPaywallShowingJsonEncodingPaywall|null $paywall
     *
     * @return self
     */
    public function setPaywall(?SdkResolvedPaywallShowingJsonEncodingPaywall $paywall): self
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
     * @return SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null
     */
    public function getPaywallRelease(): ?SdkResolvedPaywallShowingJsonEncodingPaywallRelease
    {
        return $this->paywallRelease;
    }
    /**
     * @param SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null $paywallRelease
     *
     * @return self
     */
    public function setPaywallRelease(?SdkResolvedPaywallShowingJsonEncodingPaywallRelease $paywallRelease): self
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
}