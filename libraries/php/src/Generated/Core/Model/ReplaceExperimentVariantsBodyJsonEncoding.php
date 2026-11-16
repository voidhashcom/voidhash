<?php

namespace Voidhash\Generated\Core\Model;

class ReplaceExperimentVariantsBodyJsonEncoding
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
     * Every arm the experiment has from now on; arms left out are removed. Exactly one is the control, and the weights total 100.
     *
     * @var list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItem>
     */
    protected $variants;
    /**
     * Every arm the experiment has from now on; arms left out are removed. Exactly one is the control, and the weights total 100.
     *
     * @return list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItem>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * Every arm the experiment has from now on; arms left out are removed. Exactly one is the control, and the weights total 100.
     *
     * @param list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItem> $variants
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