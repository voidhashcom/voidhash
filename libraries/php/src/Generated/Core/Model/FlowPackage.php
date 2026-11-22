<?php

namespace Voidhash\Generated\Core\Model;

class FlowPackage
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
     * The version of the package format; SDKs whose engine cannot read it get no paywall.
     *
     * @var int
     */
    protected $abiVersion;
    /**
     * The slugs of the products the flow can sell, so apps can load them ahead of time.
     *
     * @var list<string>
     */
    protected $productIds;
    /**
     * The SHA-256 hash of the package's bytes, in lowercase hex.
     *
     * @var string
     */
    protected $sha256;
    /**
     * Where apps download the package; its content never changes.
     *
     * @var string
     */
    protected $url;
    /**
     * Whether the flow's texts follow the text size the end user chose on their device; false for packages built before flows did, which keep the sizes they were designed at.
     *
     * @var bool
     */
    protected $isFollowingTextSize;
    /**
     * The version of the package format; SDKs whose engine cannot read it get no paywall.
     *
     * @return int
     */
    public function getAbiVersion(): int
    {
        return $this->abiVersion;
    }
    /**
     * The version of the package format; SDKs whose engine cannot read it get no paywall.
     *
     * @param int $abiVersion
     *
     * @return self
     */
    public function setAbiVersion(int $abiVersion): self
    {
        $this->initialized['abiVersion'] = true;
        $this->abiVersion = $abiVersion;
        return $this;
    }
    /**
     * The slugs of the products the flow can sell, so apps can load them ahead of time.
     *
     * @return list<string>
     */
    public function getProductIds(): array
    {
        return $this->productIds;
    }
    /**
     * The slugs of the products the flow can sell, so apps can load them ahead of time.
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
     * The SHA-256 hash of the package's bytes, in lowercase hex.
     *
     * @return string
     */
    public function getSha256(): string
    {
        return $this->sha256;
    }
    /**
     * The SHA-256 hash of the package's bytes, in lowercase hex.
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
     * Where apps download the package; its content never changes.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * Where apps download the package; its content never changes.
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
    /**
     * Whether the flow's texts follow the text size the end user chose on their device; false for packages built before flows did, which keep the sizes they were designed at.
     *
     * @return bool
     */
    public function getIsFollowingTextSize(): bool
    {
        return $this->isFollowingTextSize;
    }
    /**
     * Whether the flow's texts follow the text size the end user chose on their device; false for packages built before flows did, which keep the sizes they were designed at.
     *
     * @param bool $isFollowingTextSize
     *
     * @return self
     */
    public function setIsFollowingTextSize(bool $isFollowingTextSize): self
    {
        $this->initialized['isFollowingTextSize'] = true;
        $this->isFollowingTextSize = $isFollowingTextSize;
        return $this;
    }
}