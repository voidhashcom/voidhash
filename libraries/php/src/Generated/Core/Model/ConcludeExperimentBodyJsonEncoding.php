<?php

namespace Voidhash\Generated\Core\Model;

class ConcludeExperimentBodyJsonEncoding
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
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @var string|null
     */
    protected $winningVariantId;
    /**
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @return string|null
     */
    public function getWinningVariantId(): ?string
    {
        return $this->winningVariantId;
    }
    /**
     * The arm to promote, `exp_var_...`; omitted, the control arm is promoted.
     *
     * @param string|null $winningVariantId
     *
     * @return self
     */
    public function setWinningVariantId(?string $winningVariantId): self
    {
        $this->initialized['winningVariantId'] = true;
        $this->winningVariantId = $winningVariantId;
        return $this;
    }
}