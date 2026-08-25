<?php

namespace Voidhash\Generated\Core\Model;

class ReplaceFeatureFlagVariantsBodyJsonEncoding
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
     * @var list<ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem>
     */
    protected $variants;
    /**
     * @return list<ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * @param list<ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem> $variants
     *
     * @return self
     */
    public function setVariants(array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
}