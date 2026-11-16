<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEvaluationsJsonEncoding
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
     * What each flag evaluated to for the end user.
     *
     * @var list<FeatureFlagEvaluationJsonEncoding>
     */
    protected $flags;
    /**
     * What each flag evaluated to for the end user.
     *
     * @return list<FeatureFlagEvaluationJsonEncoding>
     */
    public function getFlags(): array
    {
        return $this->flags;
    }
    /**
     * What each flag evaluated to for the end user.
     *
     * @param list<FeatureFlagEvaluationJsonEncoding> $flags
     *
     * @return self
     */
    public function setFlags(array $flags): self
    {
        $this->initialized['flags'] = true;
        $this->flags = $flags;
        return $this;
    }
}