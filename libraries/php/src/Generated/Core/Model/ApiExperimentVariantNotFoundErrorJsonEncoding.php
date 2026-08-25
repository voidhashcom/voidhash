<?php

namespace Voidhash\Generated\Core\Model;

class ApiExperimentVariantNotFoundErrorJsonEncoding
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
    protected $tag;
    /**
     * @var string
     */
    protected $variantId;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * @param string $tag
     *
     * @return self
     */
    public function setTag(string $tag): self
    {
        $this->initialized['tag'] = true;
        $this->tag = $tag;
        return $this;
    }
    /**
     * @return string
     */
    public function getVariantId(): string
    {
        return $this->variantId;
    }
    /**
     * @param string $variantId
     *
     * @return self
     */
    public function setVariantId(string $variantId): self
    {
        $this->initialized['variantId'] = true;
        $this->variantId = $variantId;
        return $this;
    }
}