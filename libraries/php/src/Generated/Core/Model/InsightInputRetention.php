<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputRetention
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
     * The period people start and come back in: day, week or month; `week` unless given.
     *
     * @var string
     */
    protected $period;
    /**
     * How many periods are followed, the first included, from 1 to 24; 8 unless given.
     *
     * @var int
     */
    protected $intervals;
    /**
     * Who starts: anyone doing the start event (`recurring`) or people doing it for the first time (`first_time`).
     *
     * @var string
     */
    protected $type;
    /**
     * Whether a period counts people who came back in it or in any period after.
     *
     * @var bool
     */
    protected $cumulative;
    /**
     * What a period's rate is a share of: the starting cohort or the period before.
     *
     * @var string
     */
    protected $reference;
    /**
     * The period people start and come back in: day, week or month; `week` unless given.
     *
     * @return string
     */
    public function getPeriod(): string
    {
        return $this->period;
    }
    /**
     * The period people start and come back in: day, week or month; `week` unless given.
     *
     * @param string $period
     *
     * @return self
     */
    public function setPeriod(string $period): self
    {
        $this->initialized['period'] = true;
        $this->period = $period;
        return $this;
    }
    /**
     * How many periods are followed, the first included, from 1 to 24; 8 unless given.
     *
     * @return int
     */
    public function getIntervals(): int
    {
        return $this->intervals;
    }
    /**
     * How many periods are followed, the first included, from 1 to 24; 8 unless given.
     *
     * @param int $intervals
     *
     * @return self
     */
    public function setIntervals(int $intervals): self
    {
        $this->initialized['intervals'] = true;
        $this->intervals = $intervals;
        return $this;
    }
    /**
     * Who starts: anyone doing the start event (`recurring`) or people doing it for the first time (`first_time`).
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Who starts: anyone doing the start event (`recurring`) or people doing it for the first time (`first_time`).
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * Whether a period counts people who came back in it or in any period after.
     *
     * @return bool
     */
    public function getCumulative(): bool
    {
        return $this->cumulative;
    }
    /**
     * Whether a period counts people who came back in it or in any period after.
     *
     * @param bool $cumulative
     *
     * @return self
     */
    public function setCumulative(bool $cumulative): self
    {
        $this->initialized['cumulative'] = true;
        $this->cumulative = $cumulative;
        return $this;
    }
    /**
     * What a period's rate is a share of: the starting cohort or the period before.
     *
     * @return string
     */
    public function getReference(): string
    {
        return $this->reference;
    }
    /**
     * What a period's rate is a share of: the starting cohort or the period before.
     *
     * @param string $reference
     *
     * @return self
     */
    public function setReference(string $reference): self
    {
        $this->initialized['reference'] = true;
        $this->reference = $reference;
        return $this;
    }
}