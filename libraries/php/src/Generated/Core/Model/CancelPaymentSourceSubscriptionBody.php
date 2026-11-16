<?php

namespace Voidhash\Generated\Core\Model;

class CancelPaymentSourceSubscriptionBody
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
     * `true` ends access now; by default access lasts to the end of the paid period.
     *
     * @var bool|null
     */
    protected $isImmediate;
    /**
     * `true` ends access now; by default access lasts to the end of the paid period.
     *
     * @return bool|null
     */
    public function getIsImmediate(): ?bool
    {
        return $this->isImmediate;
    }
    /**
     * `true` ends access now; by default access lasts to the end of the paid period.
     *
     * @param bool|null $isImmediate
     *
     * @return self
     */
    public function setIsImmediate(?bool $isImmediate): self
    {
        $this->initialized['isImmediate'] = true;
        $this->isImmediate = $isImmediate;
        return $this;
    }
}