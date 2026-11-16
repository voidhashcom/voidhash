<?php

namespace Voidhash\Generated\Core\Model;

class AdsMeasuredMetrics
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
     * Web sessions that landed with the row's touch; null where there is no website.
     *
     * @var int|null
     */
    protected $visits;
    /**
     * Acquired people an app SDK reported; null where there is no app.
     *
     * @var int|null
     */
    protected $installs;
    /**
     * People acquired: those whose signup was credited to a touch from the row.
     *
     * @var int
     */
    protected $signups;
    /**
     * Acquired people who started a trial; null when the project has no trials.
     *
     * @var int|null
     */
    protected $trials;
    /**
     * Acquired people who paid.
     *
     * @var int
     */
    protected $payers;
    /**
     * Acquired people who reached the project's key conversion, the report's `keyConversion`.
     *
     * @var int
     */
    protected $keyConversions;
    /**
     * What acquired people paid, before refunds, in minor units.
     *
     * @var int
     */
    protected $grossRevenue;
    /**
     * What was refunded to them, in minor units.
     *
     * @var int
     */
    protected $refunds;
    /**
     * `grossRevenue` less `refunds`, in minor units.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * True return on ad spend, `netRevenue / spend`, as a decimal.
     *
     * @var float|null
     */
    protected $roas;
    /**
     * `spend / signups`, in minor units; null without signups.
     *
     * @var int|null
     */
    protected $costPerSignup;
    /**
     * `spend / payers`, in minor units; null without payers.
     *
     * @var int|null
     */
    protected $costPerPayer;
    /**
     * `spend / keyConversions`, in minor units; null without key conversions.
     *
     * @var int|null
     */
    protected $costPerKeyConversion;
    /**
     * People a touch from the row reached after they had signed up, who then bought or whose trial converted within the attribution window. Null in a `surface` slice, which does not measure it.
     *
     * @var int|null
     */
    protected $returningPayers;
    /**
     * What those purchases earned, less refunds, in minor units. The same sale can count for the ad that first acquired the person, so it is never part of `netRevenue`, its totals or `roas`. Null with `returningPayers`.
     *
     * @var int|null
     */
    protected $returningRevenue;
    /**
     * Web sessions that landed with the row's touch; null where there is no website.
     *
     * @return int|null
     */
    public function getVisits(): ?int
    {
        return $this->visits;
    }
    /**
     * Web sessions that landed with the row's touch; null where there is no website.
     *
     * @param int|null $visits
     *
     * @return self
     */
    public function setVisits(?int $visits): self
    {
        $this->initialized['visits'] = true;
        $this->visits = $visits;
        return $this;
    }
    /**
     * Acquired people an app SDK reported; null where there is no app.
     *
     * @return int|null
     */
    public function getInstalls(): ?int
    {
        return $this->installs;
    }
    /**
     * Acquired people an app SDK reported; null where there is no app.
     *
     * @param int|null $installs
     *
     * @return self
     */
    public function setInstalls(?int $installs): self
    {
        $this->initialized['installs'] = true;
        $this->installs = $installs;
        return $this;
    }
    /**
     * People acquired: those whose signup was credited to a touch from the row.
     *
     * @return int
     */
    public function getSignups(): int
    {
        return $this->signups;
    }
    /**
     * People acquired: those whose signup was credited to a touch from the row.
     *
     * @param int $signups
     *
     * @return self
     */
    public function setSignups(int $signups): self
    {
        $this->initialized['signups'] = true;
        $this->signups = $signups;
        return $this;
    }
    /**
     * Acquired people who started a trial; null when the project has no trials.
     *
     * @return int|null
     */
    public function getTrials(): ?int
    {
        return $this->trials;
    }
    /**
     * Acquired people who started a trial; null when the project has no trials.
     *
     * @param int|null $trials
     *
     * @return self
     */
    public function setTrials(?int $trials): self
    {
        $this->initialized['trials'] = true;
        $this->trials = $trials;
        return $this;
    }
    /**
     * Acquired people who paid.
     *
     * @return int
     */
    public function getPayers(): int
    {
        return $this->payers;
    }
    /**
     * Acquired people who paid.
     *
     * @param int $payers
     *
     * @return self
     */
    public function setPayers(int $payers): self
    {
        $this->initialized['payers'] = true;
        $this->payers = $payers;
        return $this;
    }
    /**
     * Acquired people who reached the project's key conversion, the report's `keyConversion`.
     *
     * @return int
     */
    public function getKeyConversions(): int
    {
        return $this->keyConversions;
    }
    /**
     * Acquired people who reached the project's key conversion, the report's `keyConversion`.
     *
     * @param int $keyConversions
     *
     * @return self
     */
    public function setKeyConversions(int $keyConversions): self
    {
        $this->initialized['keyConversions'] = true;
        $this->keyConversions = $keyConversions;
        return $this;
    }
    /**
     * What acquired people paid, before refunds, in minor units.
     *
     * @return int
     */
    public function getGrossRevenue(): int
    {
        return $this->grossRevenue;
    }
    /**
     * What acquired people paid, before refunds, in minor units.
     *
     * @param int $grossRevenue
     *
     * @return self
     */
    public function setGrossRevenue(int $grossRevenue): self
    {
        $this->initialized['grossRevenue'] = true;
        $this->grossRevenue = $grossRevenue;
        return $this;
    }
    /**
     * What was refunded to them, in minor units.
     *
     * @return int
     */
    public function getRefunds(): int
    {
        return $this->refunds;
    }
    /**
     * What was refunded to them, in minor units.
     *
     * @param int $refunds
     *
     * @return self
     */
    public function setRefunds(int $refunds): self
    {
        $this->initialized['refunds'] = true;
        $this->refunds = $refunds;
        return $this;
    }
    /**
     * `grossRevenue` less `refunds`, in minor units.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * `grossRevenue` less `refunds`, in minor units.
     *
     * @param int $netRevenue
     *
     * @return self
     */
    public function setNetRevenue(int $netRevenue): self
    {
        $this->initialized['netRevenue'] = true;
        $this->netRevenue = $netRevenue;
        return $this;
    }
    /**
     * True return on ad spend, `netRevenue / spend`, as a decimal.
     *
     * @return float|null
     */
    public function getRoas(): ?float
    {
        return $this->roas;
    }
    /**
     * True return on ad spend, `netRevenue / spend`, as a decimal.
     *
     * @param float|null $roas
     *
     * @return self
     */
    public function setRoas(?float $roas): self
    {
        $this->initialized['roas'] = true;
        $this->roas = $roas;
        return $this;
    }
    /**
     * `spend / signups`, in minor units; null without signups.
     *
     * @return int|null
     */
    public function getCostPerSignup(): ?int
    {
        return $this->costPerSignup;
    }
    /**
     * `spend / signups`, in minor units; null without signups.
     *
     * @param int|null $costPerSignup
     *
     * @return self
     */
    public function setCostPerSignup(?int $costPerSignup): self
    {
        $this->initialized['costPerSignup'] = true;
        $this->costPerSignup = $costPerSignup;
        return $this;
    }
    /**
     * `spend / payers`, in minor units; null without payers.
     *
     * @return int|null
     */
    public function getCostPerPayer(): ?int
    {
        return $this->costPerPayer;
    }
    /**
     * `spend / payers`, in minor units; null without payers.
     *
     * @param int|null $costPerPayer
     *
     * @return self
     */
    public function setCostPerPayer(?int $costPerPayer): self
    {
        $this->initialized['costPerPayer'] = true;
        $this->costPerPayer = $costPerPayer;
        return $this;
    }
    /**
     * `spend / keyConversions`, in minor units; null without key conversions.
     *
     * @return int|null
     */
    public function getCostPerKeyConversion(): ?int
    {
        return $this->costPerKeyConversion;
    }
    /**
     * `spend / keyConversions`, in minor units; null without key conversions.
     *
     * @param int|null $costPerKeyConversion
     *
     * @return self
     */
    public function setCostPerKeyConversion(?int $costPerKeyConversion): self
    {
        $this->initialized['costPerKeyConversion'] = true;
        $this->costPerKeyConversion = $costPerKeyConversion;
        return $this;
    }
    /**
     * People a touch from the row reached after they had signed up, who then bought or whose trial converted within the attribution window. Null in a `surface` slice, which does not measure it.
     *
     * @return int|null
     */
    public function getReturningPayers(): ?int
    {
        return $this->returningPayers;
    }
    /**
     * People a touch from the row reached after they had signed up, who then bought or whose trial converted within the attribution window. Null in a `surface` slice, which does not measure it.
     *
     * @param int|null $returningPayers
     *
     * @return self
     */
    public function setReturningPayers(?int $returningPayers): self
    {
        $this->initialized['returningPayers'] = true;
        $this->returningPayers = $returningPayers;
        return $this;
    }
    /**
     * What those purchases earned, less refunds, in minor units. The same sale can count for the ad that first acquired the person, so it is never part of `netRevenue`, its totals or `roas`. Null with `returningPayers`.
     *
     * @return int|null
     */
    public function getReturningRevenue(): ?int
    {
        return $this->returningRevenue;
    }
    /**
     * What those purchases earned, less refunds, in minor units. The same sale can count for the ad that first acquired the person, so it is never part of `netRevenue`, its totals or `roas`. Null with `returningPayers`.
     *
     * @param int|null $returningRevenue
     *
     * @return self
     */
    public function setReturningRevenue(?int $returningRevenue): self
    {
        $this->initialized['returningRevenue'] = true;
        $this->returningRevenue = $returningRevenue;
        return $this;
    }
}