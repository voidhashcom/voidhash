<?php

namespace Voidhash\Generated\Core\Model;

class AttachProductPerkBodyJsonEncoding
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
    protected $perkId;
    /**
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * @param string $perkId
     *
     * @return self
     */
    public function setPerkId(string $perkId): self
    {
        $this->initialized['perkId'] = true;
        $this->perkId = $perkId;
        return $this;
    }
}