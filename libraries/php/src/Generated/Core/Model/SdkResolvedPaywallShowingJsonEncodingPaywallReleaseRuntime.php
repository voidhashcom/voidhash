<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime
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
    protected $contentHash;
    /**
     * @var list<string>
     */
    protected $productSlugs;
    /**
     * @var array<string, mixed>
     */
    protected $variables;
    /**
     * @return string
     */
    public function getContentHash(): string
    {
        return $this->contentHash;
    }
    /**
     * @param string $contentHash
     *
     * @return self
     */
    public function setContentHash(string $contentHash): self
    {
        $this->initialized['contentHash'] = true;
        $this->contentHash = $contentHash;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getProductSlugs(): array
    {
        return $this->productSlugs;
    }
    /**
     * @param list<string> $productSlugs
     *
     * @return self
     */
    public function setProductSlugs(array $productSlugs): self
    {
        $this->initialized['productSlugs'] = true;
        $this->productSlugs = $productSlugs;
        return $this;
    }
    /**
     * @return array<string, mixed>
     */
    public function getVariables(): iterable
    {
        return $this->variables;
    }
    /**
     * @param array<string, mixed> $variables
     *
     * @return self
     */
    public function setVariables(iterable $variables): self
    {
        $this->initialized['variables'] = true;
        $this->variables = $variables;
        return $this;
    }
}