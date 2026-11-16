<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionSignupSurface
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
     * The surface people signed up on: `web`, `ios`, `android` or `unknown`.
     *
     * @var string
     */
    protected $surface;
    /**
     * People who signed up on the surface.
     *
     * @var int
     */
    protected $peopleAcquired;
    /**
     * Of them, people an iOS or Android SDK reported.
     *
     * @var int
     */
    protected $appInstalls;
    /**
     * Of them, people who started a trial.
     *
     * @var int
     */
    protected $trialStarters;
    /**
     * Of them, people who paid a charge.
     *
     * @var int
     */
    protected $payingPeople;
    /**
     * Their payments, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $grossRevenue;
    /**
     * Their refunds, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $refunds;
    /**
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $netRevenue;
    /**
     * The surface people signed up on: `web`, `ios`, `android` or `unknown`.
     *
     * @return string
     */
    public function getSurface(): string
    {
        return $this->surface;
    }
    /**
     * The surface people signed up on: `web`, `ios`, `android` or `unknown`.
     *
     * @param string $surface
     *
     * @return self
     */
    public function setSurface(string $surface): self
    {
        $this->initialized['surface'] = true;
        $this->surface = $surface;
        return $this;
    }
    /**
     * People who signed up on the surface.
     *
     * @return int
     */
    public function getPeopleAcquired(): int
    {
        return $this->peopleAcquired;
    }
    /**
     * People who signed up on the surface.
     *
     * @param int $peopleAcquired
     *
     * @return self
     */
    public function setPeopleAcquired(int $peopleAcquired): self
    {
        $this->initialized['peopleAcquired'] = true;
        $this->peopleAcquired = $peopleAcquired;
        return $this;
    }
    /**
     * Of them, people an iOS or Android SDK reported.
     *
     * @return int
     */
    public function getAppInstalls(): int
    {
        return $this->appInstalls;
    }
    /**
     * Of them, people an iOS or Android SDK reported.
     *
     * @param int $appInstalls
     *
     * @return self
     */
    public function setAppInstalls(int $appInstalls): self
    {
        $this->initialized['appInstalls'] = true;
        $this->appInstalls = $appInstalls;
        return $this;
    }
    /**
     * Of them, people who started a trial.
     *
     * @return int
     */
    public function getTrialStarters(): int
    {
        return $this->trialStarters;
    }
    /**
     * Of them, people who started a trial.
     *
     * @param int $trialStarters
     *
     * @return self
     */
    public function setTrialStarters(int $trialStarters): self
    {
        $this->initialized['trialStarters'] = true;
        $this->trialStarters = $trialStarters;
        return $this;
    }
    /**
     * Of them, people who paid a charge.
     *
     * @return int
     */
    public function getPayingPeople(): int
    {
        return $this->payingPeople;
    }
    /**
     * Of them, people who paid a charge.
     *
     * @param int $payingPeople
     *
     * @return self
     */
    public function setPayingPeople(int $payingPeople): self
    {
        $this->initialized['payingPeople'] = true;
        $this->payingPeople = $payingPeople;
        return $this;
    }
    /**
     * Their payments, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getGrossRevenue(): int
    {
        return $this->grossRevenue;
    }
    /**
     * Their payments, in integer minor units of the report currency, such as cents.
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
     * Their refunds, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getRefunds(): int
    {
        return $this->refunds;
    }
    /**
     * Their refunds, in integer minor units of the report currency, such as cents.
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
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getNetRevenue(): int
    {
        return $this->netRevenue;
    }
    /**
     * `grossRevenue - refunds`, in integer minor units of the report currency, such as cents.
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
}