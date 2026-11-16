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
     * Every subscription that has not ended (neither `expired` nor `revoked`), including those in a grace period, billing retry, on hold or paused, best first as for `current`. What a screen to manage subscriptions lists; access comes from `entitlements`, never from this list.
     *
     * @var list<SdkSubscriptionJsonEncoding>
     */
    protected $all;
    /**
     * @var SdkSubscriptionJsonEncoding
     */
    protected $current;
    /**
     * Every subscription the person owns or shares, ended ones included.
     *
     * @var list<SdkSubscriptionHistoryEntryJsonEncoding>
     */
    protected $history;
    /**
     * Every subscription that has not ended (neither `expired` nor `revoked`), including those in a grace period, billing retry, on hold or paused, best first as for `current`. What a screen to manage subscriptions lists; access comes from `entitlements`, never from this list.
     *
     * @return list<SdkSubscriptionJsonEncoding>
     */
    public function getAll(): array
    {
        return $this->all;
    }
    /**
     * Every subscription that has not ended (neither `expired` nor `revoked`), including those in a grace period, billing retry, on hold or paused, best first as for `current`. What a screen to manage subscriptions lists; access comes from `entitlements`, never from this list.
     *
     * @param list<SdkSubscriptionJsonEncoding> $all
     *
     * @return self
     */
    public function setAll(array $all): self
    {
        $this->initialized['all'] = true;
        $this->all = $all;
        return $this;
    }
    /**
     * @return SdkSubscriptionJsonEncoding
     */
    public function getCurrent(): SdkSubscriptionJsonEncoding
    {
        return $this->current;
    }
    /**
     * @param SdkSubscriptionJsonEncoding $current
     *
     * @return self
     */
    public function setCurrent(SdkSubscriptionJsonEncoding $current): self
    {
        $this->initialized['current'] = true;
        $this->current = $current;
        return $this;
    }
    /**
     * Every subscription the person owns or shares, ended ones included.
     *
     * @return list<SdkSubscriptionHistoryEntryJsonEncoding>
     */
    public function getHistory(): array
    {
        return $this->history;
    }
    /**
     * Every subscription the person owns or shares, ended ones included.
     *
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