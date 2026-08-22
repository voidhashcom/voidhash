<?php

namespace Voidhash\Generated\Core\Model;

class EvaluateFeatureFlagsBodyJsonEncoding
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
     * @var list<string>|null
     */
    protected $flagKeys;
    /**
     * @return list<string>|null
     */
    public function getFlagKeys(): ?array
    {
        return $this->flagKeys;
    }
    /**
     * @param list<string>|null $flagKeys
     *
     * @return self
     */
    public function setFlagKeys(?array $flagKeys): self
    {
        $this->initialized['flagKeys'] = true;
        $this->flagKeys = $flagKeys;
        return $this;
    }
}