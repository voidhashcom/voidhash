<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage
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
     * The package's format version.
     *
     * @var mixed
     */
    protected $abiVersion;
    /**
     * What the flow is for, such as `paywall` or `onboarding`.
     *
     * @var string
     */
    protected $kind;
    /**
     * The store product ids the package can offer, for prefetching their prices.
     *
     * @var list<string>
     */
    protected $productIds;
    /**
     * Whether a successful purchase closes the flow, as on a paywall, rather than letting it continue, as in onboarding.
     *
     * @var bool
     */
    protected $shouldEndFlowOnPurchase;
    /**
     * The SHA-256 hash of the package's bytes, as hex; verify the download against it.
     *
     * @var string
     */
    protected $sha256;
    /**
     * Where to download the package; its content never changes, so cache it by `sha256`.
     *
     * @var string
     */
    protected $url;
    /**
     * The package's format version.
     *
     * @return mixed
     */
    public function getAbiVersion()
    {
        return $this->abiVersion;
    }
    /**
     * The package's format version.
     *
     * @param mixed $abiVersion
     *
     * @return self
     */
    public function setAbiVersion($abiVersion): self
    {
        $this->initialized['abiVersion'] = true;
        $this->abiVersion = $abiVersion;
        return $this;
    }
    /**
     * What the flow is for, such as `paywall` or `onboarding`.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the flow is for, such as `paywall` or `onboarding`.
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
     * The store product ids the package can offer, for prefetching their prices.
     *
     * @return list<string>
     */
    public function getProductIds(): array
    {
        return $this->productIds;
    }
    /**
     * The store product ids the package can offer, for prefetching their prices.
     *
     * @param list<string> $productIds
     *
     * @return self
     */
    public function setProductIds(array $productIds): self
    {
        $this->initialized['productIds'] = true;
        $this->productIds = $productIds;
        return $this;
    }
    /**
     * Whether a successful purchase closes the flow, as on a paywall, rather than letting it continue, as in onboarding.
     *
     * @return bool
     */
    public function getShouldEndFlowOnPurchase(): bool
    {
        return $this->shouldEndFlowOnPurchase;
    }
    /**
     * Whether a successful purchase closes the flow, as on a paywall, rather than letting it continue, as in onboarding.
     *
     * @param bool $shouldEndFlowOnPurchase
     *
     * @return self
     */
    public function setShouldEndFlowOnPurchase(bool $shouldEndFlowOnPurchase): self
    {
        $this->initialized['shouldEndFlowOnPurchase'] = true;
        $this->shouldEndFlowOnPurchase = $shouldEndFlowOnPurchase;
        return $this;
    }
    /**
     * The SHA-256 hash of the package's bytes, as hex; verify the download against it.
     *
     * @return string
     */
    public function getSha256(): string
    {
        return $this->sha256;
    }
    /**
     * The SHA-256 hash of the package's bytes, as hex; verify the download against it.
     *
     * @param string $sha256
     *
     * @return self
     */
    public function setSha256(string $sha256): self
    {
        $this->initialized['sha256'] = true;
        $this->sha256 = $sha256;
        return $this;
    }
    /**
     * Where to download the package; its content never changes, so cache it by `sha256`.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * Where to download the package; its content never changes, so cache it by `sha256`.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
}