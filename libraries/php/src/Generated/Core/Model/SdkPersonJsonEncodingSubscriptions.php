<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncodingSubscriptions
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
     * @var SdkCurrentSubscriptionJsonEncoding
     */
    protected $current;
    /**
     * @var list<SdkSubscriptionHistoryEntryJsonEncoding>
     */
    protected $history;
    /**
     * @return SdkCurrentSubscriptionJsonEncoding
     */
    public function getCurrent(): SdkCurrentSubscriptionJsonEncoding
    {
        return $this->current;
    }
    /**
     * @param SdkCurrentSubscriptionJsonEncoding $current
     *
     * @return self
     */
    public function setCurrent(SdkCurrentSubscriptionJsonEncoding $current): self
    {
        $this->initialized['current'] = true;
        $this->current = $current;
        return $this;
    }
    /**
     * @return list<SdkSubscriptionHistoryEntryJsonEncoding>
     */
    public function getHistory(): array
    {
        return $this->history;
    }
    /**
     * @param list<SdkSubscriptionHistoryEntryJsonEncoding> $history
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