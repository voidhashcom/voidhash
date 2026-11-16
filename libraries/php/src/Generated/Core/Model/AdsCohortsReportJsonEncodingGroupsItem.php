<?php

namespace Voidhash\Generated\Core\Model;

class AdsCohortsReportJsonEncodingGroupsItem
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
     * A surface, a platform, or a campaign or ad group id.
     *
     * @var string
     */
    protected $key;
    /**
     * The campaign or ad group name; null for surfaces and platforms.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The surface of a `surface` group, or `cross_surface` for journeys that crossed them; null for other groupings.
     *
     * @var string|null
     */
    protected $surface;
    /**
     * People acquired in the group.
     *
     * @var int
     */
    protected $people;
    /**
     * The group's cumulative metric by day since acquisition, over all its cohorts.
     *
     * @var list<AdsCohortValue>
     */
    protected $values;
    /**
     * The first day the group's ROAS reaches 1; null when it has not.
     *
     * @var int|null
     */
    protected $paybackDay;
    /**
     * The probability that the group's ROAS reaches 1 by day 365: projected while some of its cohorts have not completed that day, 1 or 0 once all have; null while some have not and there is no projection for them.
     *
     * @var float|null
     */
    protected $paybackProbability;
    /**
     * A surface, a platform, or a campaign or ad group id.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * A surface, a platform, or a campaign or ad group id.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The campaign or ad group name; null for surfaces and platforms.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The campaign or ad group name; null for surfaces and platforms.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The surface of a `surface` group, or `cross_surface` for journeys that crossed them; null for other groupings.
     *
     * @return string|null
     */
    public function getSurface(): ?string
    {
        return $this->surface;
    }
    /**
     * The surface of a `surface` group, or `cross_surface` for journeys that crossed them; null for other groupings.
     *
     * @param string|null $surface
     *
     * @return self
     */
    public function setSurface(?string $surface): self
    {
        $this->initialized['surface'] = true;
        $this->surface = $surface;
        return $this;
    }
    /**
     * People acquired in the group.
     *
     * @return int
     */
    public function getPeople(): int
    {
        return $this->people;
    }
    /**
     * People acquired in the group.
     *
     * @param int $people
     *
     * @return self
     */
    public function setPeople(int $people): self
    {
        $this->initialized['people'] = true;
        $this->people = $people;
        return $this;
    }
    /**
     * The group's cumulative metric by day since acquisition, over all its cohorts.
     *
     * @return list<AdsCohortValue>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * The group's cumulative metric by day since acquisition, over all its cohorts.
     *
     * @param list<AdsCohortValue> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
    /**
     * The first day the group's ROAS reaches 1; null when it has not.
     *
     * @return int|null
     */
    public function getPaybackDay(): ?int
    {
        return $this->paybackDay;
    }
    /**
     * The first day the group's ROAS reaches 1; null when it has not.
     *
     * @param int|null $paybackDay
     *
     * @return self
     */
    public function setPaybackDay(?int $paybackDay): self
    {
        $this->initialized['paybackDay'] = true;
        $this->paybackDay = $paybackDay;
        return $this;
    }
    /**
     * The probability that the group's ROAS reaches 1 by day 365: projected while some of its cohorts have not completed that day, 1 or 0 once all have; null while some have not and there is no projection for them.
     *
     * @return float|null
     */
    public function getPaybackProbability(): ?float
    {
        return $this->paybackProbability;
    }
    /**
     * The probability that the group's ROAS reaches 1 by day 365: projected while some of its cohorts have not completed that day, 1 or 0 once all have; null while some have not and there is no projection for them.
     *
     * @param float|null $paybackProbability
     *
     * @return self
     */
    public function setPaybackProbability(?float $paybackProbability): self
    {
        $this->initialized['paybackProbability'] = true;
        $this->paybackProbability = $paybackProbability;
        return $this;
    }
}