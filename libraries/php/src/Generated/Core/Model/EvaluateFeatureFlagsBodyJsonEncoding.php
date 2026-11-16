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
     * The keys of the flags to evaluate; absent or empty evaluates every flag of the project. Unknown keys are left out of the answer.
     *
     * @var list<string>|null
     */
    protected $flagKeys;
    /**
     * The keys of the flags to evaluate; absent or empty evaluates every flag of the project. Unknown keys are left out of the answer.
     *
     * @return list<string>|null
     */
    public function getFlagKeys(): ?array
    {
        return $this->flagKeys;
    }
    /**
     * The keys of the flags to evaluate; absent or empty evaluates every flag of the project. Unknown keys are left out of the answer.
     *
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