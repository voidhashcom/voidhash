<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionDay
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
     * People whose signup was credited to a touch of this row in the range.
     *
     * @var int
     */
    protected $peopleAcquired;
    /**
     * People who signed up: the same people as `peopleAcquired`, counted by signup.
     *
     * @var int
     */
    protected $signups;
    /**
     * Web sessions that landed with a touch of this row.
     *
     * @var int
     */
    protected $visits;
    /**
     * Acquired people an iOS or Android SDK reported: installs Voidhash measured, not those an ad platform reports.
     *
     * @var int
     */
    protected $appInstalls;
    /**
     * People who started a trial.
     *
     * @var int
     */
    protected $trialStarters;
    /**
     * People whose trial converted to a paid period.
     *
     * @var int
     */
    protected $trialConversions;
    /**
     * People who paid a charge; a refunded payer still counts.
     *
     * @var int
     */
    protected $payingPeople;
    /**
     * Payers whose signup and payment surfaces differ, who signed up in an app after a web touch, or who signed up or paid on the web after a touch in an app.
     *
     * @var int
     */
    protected $crossSurfacePayers;
    /**
     * People who reached the key conversion.
     *
     * @var int
     */
    protected $keyConversions;
    /**
     * `payingPeople / peopleAcquired`, from 0 to 1; null without people.
     *
     * @var float|null
     */
    protected $signupToPayerRate;
    /**
     * People a touch of this row in the range reached only after they had signed up, such as customers reached by retargeting, and whom no touch in the range acquired. Each counts once, by their first such touch, and in no other metric.
     *
     * @var int
     */
    protected $returningPeople;
    /**
     * Returning people who bought, or whose trial converted, within the attribution window after that touch. Renewals of what they already had do not count.
     *
     * @var int
     */
    protected $returningPayers;
    /**
     * What those purchases and conversions earned, less their refunds, in integer minor units of the report currency, such as cents. The same sale can count for the touch that first acquired the person, so it is never part of `grossRevenue` or `netRevenue`.
     *
     * @var int
     */
    protected $returningRevenue;
    /**
     * Payments and renewals, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $grossRevenue;
    /**
     * Refunds and revocations, net of reversed refunds, in integer minor units of the report currency, such as cents.
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
     * The acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @var string
     */
    protected $date;
    /**
     * People whose signup was credited to a touch of this row in the range.
     *
     * @return int
     */
    public function getPeopleAcquired(): int
    {
        return $this->peopleAcquired;
    }
    /**
     * People whose signup was credited to a touch of this row in the range.
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
     * People who signed up: the same people as `peopleAcquired`, counted by signup.
     *
     * @return int
     */
    public function getSignups(): int
    {
        return $this->signups;
    }
    /**
     * People who signed up: the same people as `peopleAcquired`, counted by signup.
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
     * Web sessions that landed with a touch of this row.
     *
     * @return int
     */
    public function getVisits(): int
    {
        return $this->visits;
    }
    /**
     * Web sessions that landed with a touch of this row.
     *
     * @param int $visits
     *
     * @return self
     */
    public function setVisits(int $visits): self
    {
        $this->initialized['visits'] = true;
        $this->visits = $visits;
        return $this;
    }
    /**
     * Acquired people an iOS or Android SDK reported: installs Voidhash measured, not those an ad platform reports.
     *
     * @return int
     */
    public function getAppInstalls(): int
    {
        return $this->appInstalls;
    }
    /**
     * Acquired people an iOS or Android SDK reported: installs Voidhash measured, not those an ad platform reports.
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
     * People who started a trial.
     *
     * @return int
     */
    public function getTrialStarters(): int
    {
        return $this->trialStarters;
    }
    /**
     * People who started a trial.
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
     * People whose trial converted to a paid period.
     *
     * @return int
     */
    public function getTrialConversions(): int
    {
        return $this->trialConversions;
    }
    /**
     * People whose trial converted to a paid period.
     *
     * @param int $trialConversions
     *
     * @return self
     */
    public function setTrialConversions(int $trialConversions): self
    {
        $this->initialized['trialConversions'] = true;
        $this->trialConversions = $trialConversions;
        return $this;
    }
    /**
     * People who paid a charge; a refunded payer still counts.
     *
     * @return int
     */
    public function getPayingPeople(): int
    {
        return $this->payingPeople;
    }
    /**
     * People who paid a charge; a refunded payer still counts.
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
     * Payers whose signup and payment surfaces differ, who signed up in an app after a web touch, or who signed up or paid on the web after a touch in an app.
     *
     * @return int
     */
    public function getCrossSurfacePayers(): int
    {
        return $this->crossSurfacePayers;
    }
    /**
     * Payers whose signup and payment surfaces differ, who signed up in an app after a web touch, or who signed up or paid on the web after a touch in an app.
     *
     * @param int $crossSurfacePayers
     *
     * @return self
     */
    public function setCrossSurfacePayers(int $crossSurfacePayers): self
    {
        $this->initialized['crossSurfacePayers'] = true;
        $this->crossSurfacePayers = $crossSurfacePayers;
        return $this;
    }
    /**
     * People who reached the key conversion.
     *
     * @return int
     */
    public function getKeyConversions(): int
    {
        return $this->keyConversions;
    }
    /**
     * People who reached the key conversion.
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
     * `payingPeople / peopleAcquired`, from 0 to 1; null without people.
     *
     * @return float|null
     */
    public function getSignupToPayerRate(): ?float
    {
        return $this->signupToPayerRate;
    }
    /**
     * `payingPeople / peopleAcquired`, from 0 to 1; null without people.
     *
     * @param float|null $signupToPayerRate
     *
     * @return self
     */
    public function setSignupToPayerRate(?float $signupToPayerRate): self
    {
        $this->initialized['signupToPayerRate'] = true;
        $this->signupToPayerRate = $signupToPayerRate;
        return $this;
    }
    /**
     * People a touch of this row in the range reached only after they had signed up, such as customers reached by retargeting, and whom no touch in the range acquired. Each counts once, by their first such touch, and in no other metric.
     *
     * @return int
     */
    public function getReturningPeople(): int
    {
        return $this->returningPeople;
    }
    /**
     * People a touch of this row in the range reached only after they had signed up, such as customers reached by retargeting, and whom no touch in the range acquired. Each counts once, by their first such touch, and in no other metric.
     *
     * @param int $returningPeople
     *
     * @return self
     */
    public function setReturningPeople(int $returningPeople): self
    {
        $this->initialized['returningPeople'] = true;
        $this->returningPeople = $returningPeople;
        return $this;
    }
    /**
     * Returning people who bought, or whose trial converted, within the attribution window after that touch. Renewals of what they already had do not count.
     *
     * @return int
     */
    public function getReturningPayers(): int
    {
        return $this->returningPayers;
    }
    /**
     * Returning people who bought, or whose trial converted, within the attribution window after that touch. Renewals of what they already had do not count.
     *
     * @param int $returningPayers
     *
     * @return self
     */
    public function setReturningPayers(int $returningPayers): self
    {
        $this->initialized['returningPayers'] = true;
        $this->returningPayers = $returningPayers;
        return $this;
    }
    /**
     * What those purchases and conversions earned, less their refunds, in integer minor units of the report currency, such as cents. The same sale can count for the touch that first acquired the person, so it is never part of `grossRevenue` or `netRevenue`.
     *
     * @return int
     */
    public function getReturningRevenue(): int
    {
        return $this->returningRevenue;
    }
    /**
     * What those purchases and conversions earned, less their refunds, in integer minor units of the report currency, such as cents. The same sale can count for the touch that first acquired the person, so it is never part of `grossRevenue` or `netRevenue`.
     *
     * @param int $returningRevenue
     *
     * @return self
     */
    public function setReturningRevenue(int $returningRevenue): self
    {
        $this->initialized['returningRevenue'] = true;
        $this->returningRevenue = $returningRevenue;
        return $this;
    }
    /**
     * Payments and renewals, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getGrossRevenue(): int
    {
        return $this->grossRevenue;
    }
    /**
     * Payments and renewals, in integer minor units of the report currency, such as cents.
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
     * Refunds and revocations, net of reversed refunds, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getRefunds(): int
    {
        return $this->refunds;
    }
    /**
     * Refunds and revocations, net of reversed refunds, in integer minor units of the report currency, such as cents.
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
    /**
     * The acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @return string
     */
    public function getDate(): string
    {
        return $this->date;
    }
    /**
     * The acquisition day, `YYYY-MM-DD`, in the report time zone.
     *
     * @param string $date
     *
     * @return self
     */
    public function setDate(string $date): self
    {
        $this->initialized['date'] = true;
        $this->date = $date;
        return $this;
    }
}