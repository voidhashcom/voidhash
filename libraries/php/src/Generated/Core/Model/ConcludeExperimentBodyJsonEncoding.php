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
     * @var string|null
     */
    protected $winningVariantId;
    /**
     * @return string|null
     */
    public function getWinningVariantId(): ?string
    {
        return $this->winningVariantId;
    }
    /**
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