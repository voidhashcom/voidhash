<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionCohortsResultJsonEncoding
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
     * The project's id.
     *
     * @var string
     */
    protected $projectId;
    /**
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @var string
     */
    protected $groupBy;
    /**
     * The ISO 4217 code money is reported in, in integer minor units.
     *
     * @var string
     */
    protected $currency;
    /**
     * The IANA time zone that set day boundaries.
     *
     * @var string
     */
    protected $timezone;
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * How many days before a signup a touch could be credited with it.
     *
     * @var int
     */
    protected $attributionWindowDays;
    /**
     * The first acquisition day, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $from;
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $to;
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $start;
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $end;
    /**
     * The instant cells are measured up to, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $asOf;
    /**
     * The days after each person's touch that cells report: 0, 1, 3, 7, 14, 30, 60, 90, 180, 365 and 730.
     *
     * @var list<int>
     */
    protected $days;
    /**
     * The weekly cohorts of each group.
     *
     * @var list<AcquisitionCohortsResultJsonEncodingGroupsItem>
     */
    protected $groups;
    /**
     * The weekly cohorts of every group together.
     *
     * @var list<AcquisitionCohort>
     */
    protected $total;
    /**
     * What revenue projections are learned from.
     *
     * @var AcquisitionProjectionModel
     */
    protected $projection;
    /**
     * The project's id.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project's id.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @return string
     */
    public function getGroupBy(): string
    {
        return $this->groupBy;
    }
    /**
     * What cohorts group by: the surface people signed up on (`surface`), or the credited touch's `network`, `campaign` or `adset`.
     *
     * @param string $groupBy
     *
     * @return self
     */
    public function setGroupBy(string $groupBy): self
    {
        $this->initialized['groupBy'] = true;
        $this->groupBy = $groupBy;
        return $this;
    }
    /**
     * The ISO 4217 code money is reported in, in integer minor units.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code money is reported in, in integer minor units.
     *
     * @param string $currency
     *
     * @return self
     */
    public function setCurrency(string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * The IANA time zone that set day boundaries.
     *
     * @return string
     */
    public function getTimezone(): string
    {
        return $this->timezone;
    }
    /**
     * The IANA time zone that set day boundaries.
     *
     * @param string $timezone
     *
     * @return self
     */
    public function setTimezone(string $timezone): self
    {
        $this->initialized['timezone'] = true;
        $this->timezone = $timezone;
        return $this;
    }
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment whose revenue counted: `production`, `sandbox` or `test`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * How many days before a signup a touch could be credited with it.
     *
     * @return int
     */
    public function getAttributionWindowDays(): int
    {
        return $this->attributionWindowDays;
    }
    /**
     * How many days before a signup a touch could be credited with it.
     *
     * @param int $attributionWindowDays
     *
     * @return self
     */
    public function setAttributionWindowDays(int $attributionWindowDays): self
    {
        $this->initialized['attributionWindowDays'] = true;
        $this->attributionWindowDays = $attributionWindowDays;
        return $this;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getFrom(): string
    {
        return $this->from;
    }
    /**
     * The first acquisition day, `YYYY-MM-DD`.
     *
     * @param string $from
     *
     * @return self
     */
    public function setFrom(string $from): self
    {
        $this->initialized['from'] = true;
        $this->from = $from;
        return $this;
    }
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getTo(): string
    {
        return $this->to;
    }
    /**
     * The last acquisition day, inclusive, `YYYY-MM-DD`.
     *
     * @param string $to
     *
     * @return self
     */
    public function setTo(string $to): self
    {
        $this->initialized['to'] = true;
        $this->to = $to;
        return $this;
    }
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of `from` in the report time zone, as an ISO 8601 timestamp.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The start of the day after `to`, as an ISO 8601 timestamp.
     *
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * The instant cells are measured up to, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getAsOf(): string
    {
        return $this->asOf;
    }
    /**
     * The instant cells are measured up to, as an ISO 8601 timestamp.
     *
     * @param string $asOf
     *
     * @return self
     */
    public function setAsOf(string $asOf): self
    {
        $this->initialized['asOf'] = true;
        $this->asOf = $asOf;
        return $this;
    }
    /**
     * The days after each person's touch that cells report: 0, 1, 3, 7, 14, 30, 60, 90, 180, 365 and 730.
     *
     * @return list<int>
     */
    public function getDays(): array
    {
        return $this->days;
    }
    /**
     * The days after each person's touch that cells report: 0, 1, 3, 7, 14, 30, 60, 90, 180, 365 and 730.
     *
     * @param list<int> $days
     *
     * @return self
     */
    public function setDays(array $days): self
    {
        $this->initialized['days'] = true;
        $this->days = $days;
        return $this;
    }
    /**
     * The weekly cohorts of each group.
     *
     * @return list<AcquisitionCohortsResultJsonEncodingGroupsItem>
     */
    public function getGroups(): array
    {
        return $this->groups;
    }
    /**
     * The weekly cohorts of each group.
     *
     * @param list<AcquisitionCohortsResultJsonEncodingGroupsItem> $groups
     *
     * @return self
     */
    public function setGroups(array $groups): self
    {
        $this->initialized['groups'] = true;
        $this->groups = $groups;
        return $this;
    }
    /**
     * The weekly cohorts of every group together.
     *
     * @return list<AcquisitionCohort>
     */
    public function getTotal(): array
    {
        return $this->total;
    }
    /**
     * The weekly cohorts of every group together.
     *
     * @param list<AcquisitionCohort> $total
     *
     * @return self
     */
    public function setTotal(array $total): self
    {
        $this->initialized['total'] = true;
        $this->total = $total;
        return $this;
    }
    /**
     * What revenue projections are learned from.
     *
     * @return AcquisitionProjectionModel
     */
    public function getProjection(): AcquisitionProjectionModel
    {
        return $this->projection;
    }
    /**
     * What revenue projections are learned from.
     *
     * @param AcquisitionProjectionModel $projection
     *
     * @return self
     */
    public function setProjection(AcquisitionProjectionModel $projection): self
    {
        $this->initialized['projection'] = true;
        $this->projection = $projection;
        return $this;
    }
}