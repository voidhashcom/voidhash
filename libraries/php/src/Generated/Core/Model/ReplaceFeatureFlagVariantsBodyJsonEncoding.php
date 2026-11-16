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
     * Every variant the flag has from now on; variants left out are removed, and traffic splits evenly between these.
     *
     * @var list<ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem>
     */
    protected $variants;
    /**
     * Every variant the flag has from now on; variants left out are removed, and traffic splits evenly between these.
     *
     * @return list<ReplaceFeatureFlagVariantsBodyJsonEncodingVariantsItem>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * Every variant the flag has from now on; variants left out are removed, and traffic splits evenly between these.
     *
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