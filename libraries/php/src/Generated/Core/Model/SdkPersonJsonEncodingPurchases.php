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
     * Every purchase the person owns or shares, one entry per store transaction.
     *
     * @var list<SdkPurchaseHistoryEntryJsonEncoding>
     */
    protected $history;
    /**
     * Every purchase the person owns or shares, one entry per store transaction.
     *
     * @return list<SdkPurchaseHistoryEntryJsonEncoding>
     */
    public function getHistory(): array
    {
        return $this->history;
    }
    /**
     * Every purchase the person owns or shares, one entry per store transaction.
     *
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