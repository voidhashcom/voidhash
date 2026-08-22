<?php

namespace Voidhash\Generated\Core\Model;

class SdkSyncTransactionResponseJsonEncoding
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
     * @var bool
     */
    protected $accepted;
    /**
     * @return bool
     */
    public function getAccepted(): bool
    {
        return $this->accepted;
    }
    /**
     * @param bool $accepted
     *
     * @return self
     */
    public function setAccepted(bool $accepted): self
    {
        $this->initialized['accepted'] = true;
        $this->accepted = $accepted;
        return $this;
    }
}