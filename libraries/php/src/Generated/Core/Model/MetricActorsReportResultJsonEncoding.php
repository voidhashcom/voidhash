<?php

namespace Voidhash\Generated\Core\Model;

class MetricActorsReportResultJsonEncoding
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
     * What the point counts: `person` (a metric's people), `group` (the groups `unique_groups` counts), `session` or `property` (an event property's values).
     *
     * @var string
     */
    protected $actorKind;
    /**
     * The type of the groups a `group` point counts; null otherwise.
     *
     * @var string|null
     */
    protected $groupType;
    /**
     * What each actor's `value` is: their `events` in the point; `sessions`; `money` they paid, or their MRR at the bucket's end, in integer minor units of `currency`; a `property` statistic of their numbers; `seconds` to convert; or retention `periods` returned in.
     *
     * @var string
     */
    protected $valueKind;
    /**
     * The ISO 4217 code `money` values are in; null for others.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * How many actors the point holds, of those `search` keeps: for a count of people or groups, its value.
     *
     * @var int
     */
    protected $total;
    /**
     * The items on this page, in list order.
     *
     * @var list<AnalyticsPointActor>
     */
    protected $data;
    /**
     * Where this page ends.
     *
     * @var PageInfo
     */
    protected $pageInfo;
    /**
     * What the point counts: `person` (a metric's people), `group` (the groups `unique_groups` counts), `session` or `property` (an event property's values).
     *
     * @return string
     */
    public function getActorKind(): string
    {
        return $this->actorKind;
    }
    /**
     * What the point counts: `person` (a metric's people), `group` (the groups `unique_groups` counts), `session` or `property` (an event property's values).
     *
     * @param string $actorKind
     *
     * @return self
     */
    public function setActorKind(string $actorKind): self
    {
        $this->initialized['actorKind'] = true;
        $this->actorKind = $actorKind;
        return $this;
    }
    /**
     * The type of the groups a `group` point counts; null otherwise.
     *
     * @return string|null
     */
    public function getGroupType(): ?string
    {
        return $this->groupType;
    }
    /**
     * The type of the groups a `group` point counts; null otherwise.
     *
     * @param string|null $groupType
     *
     * @return self
     */
    public function setGroupType(?string $groupType): self
    {
        $this->initialized['groupType'] = true;
        $this->groupType = $groupType;
        return $this;
    }
    /**
     * What each actor's `value` is: their `events` in the point; `sessions`; `money` they paid, or their MRR at the bucket's end, in integer minor units of `currency`; a `property` statistic of their numbers; `seconds` to convert; or retention `periods` returned in.
     *
     * @return string
     */
    public function getValueKind(): string
    {
        return $this->valueKind;
    }
    /**
     * What each actor's `value` is: their `events` in the point; `sessions`; `money` they paid, or their MRR at the bucket's end, in integer minor units of `currency`; a `property` statistic of their numbers; `seconds` to convert; or retention `periods` returned in.
     *
     * @param string $valueKind
     *
     * @return self
     */
    public function setValueKind(string $valueKind): self
    {
        $this->initialized['valueKind'] = true;
        $this->valueKind = $valueKind;
        return $this;
    }
    /**
     * The ISO 4217 code `money` values are in; null for others.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code `money` values are in; null for others.
     *
     * @param string|null $currency
     *
     * @return self
     */
    public function setCurrency(?string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * How many actors the point holds, of those `search` keeps: for a count of people or groups, its value.
     *
     * @return int
     */
    public function getTotal(): int
    {
        return $this->total;
    }
    /**
     * How many actors the point holds, of those `search` keeps: for a count of people or groups, its value.
     *
     * @param int $total
     *
     * @return self
     */
    public function setTotal(int $total): self
    {
        $this->initialized['total'] = true;
        $this->total = $total;
        return $this;
    }
    /**
     * The items on this page, in list order.
     *
     * @return list<AnalyticsPointActor>
     */
    public function getData(): array
    {
        return $this->data;
    }
    /**
     * The items on this page, in list order.
     *
     * @param list<AnalyticsPointActor> $data
     *
     * @return self
     */
    public function setData(array $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * Where this page ends.
     *
     * @return PageInfo
     */
    public function getPageInfo(): PageInfo
    {
        return $this->pageInfo;
    }
    /**
     * Where this page ends.
     *
     * @param PageInfo $pageInfo
     *
     * @return self
     */
    public function setPageInfo(PageInfo $pageInfo): self
    {
        $this->initialized['pageInfo'] = true;
        $this->pageInfo = $pageInfo;
        return $this;
    }
}