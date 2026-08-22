<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncodingPurchases
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
     * @var list<SdkPurchaseHistoryEntryJsonEncoding>
     */
    protected $history;
    /**
     * @return list<SdkPurchaseHistoryEntryJsonEncoding>
     */
    public function getHistory(): array
    {
        return $this->history;
    }
    /**
     * @param list<SdkPurchaseHistoryEntryJsonEncoding> $history
     *
     * @return self
     */
    public function setHistory(array $history): self
    {
        $this->initialized['history'] = true;
        $this->history = $history;
        return $this;
    }
}