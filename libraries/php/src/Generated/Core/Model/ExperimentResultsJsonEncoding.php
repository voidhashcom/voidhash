<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentResultsJsonEncoding
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
     * @var list<ExperimentVariantResultJsonEncoding>
     */
    protected $variants;
    /**
     * @return list<ExperimentVariantResultJsonEncoding>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * @param list<ExperimentVariantResultJsonEncoding> $variants
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