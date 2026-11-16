<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionGroup
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
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
     *
     * @var string|null
     */
    protected $network;
    /**
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @var string|null
     */
    protected $campaignId;
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @var string|null
     */
    protected $campaignName;
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @var string|null
     */
    protected $adsetId;
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @var string|null
     */
    protected $adsetName;
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @var string|null
     */
    protected $adId;
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @var string|null
     */
    protected $adName;
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
     *
     * @var string|null
     */
    protected $surface;
    /**
     * The row per acquisition day, with `hasDailyRows`.
     *
     * @var list<AcquisitionDay>|null
     */
    protected $days;
    /**
     * The row by signup surface, with `hasSurfaceBreakdown`.
     *
     * @var list<AcquisitionSignupSurface>|null
     */
    protected $signupSurfaces;
    /**
     * The row's payers and revenue by payment surface, with `hasSurfaceBreakdown`.
     *
     * @var list<AcquisitionPaymentSurface>|null
     */
    protected $paymentSurfaces;
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
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
     *
     * @return string|null
     */
    public function getNetwork(): ?string
    {
        return $this->network;
    }
    /**
     * The credited touch's ad network, such as `meta`, `google` or the lowercased `utm_source`; null for a touch without one, such as a newsletter link, and at `surface` level.
     *
     * @param string|null $network
     *
     * @return self
     */
    public function setNetwork(?string $network): self
    {
        $this->initialized['network'] = true;
        $this->network = $network;
        return $this;
    }
    /**
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @return string|null
     */
    public function getCampaignId(): ?string
    {
        return $this->campaignId;
    }
    /**
     * The ad platform's campaign id; null above `campaign` level or when the touch had none.
     *
     * @param string|null $campaignId
     *
     * @return self
     */
    public function setCampaignId(?string $campaignId): self
    {
        $this->initialized['campaignId'] = true;
        $this->campaignId = $campaignId;
        return $this;
    }
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @return string|null
     */
    public function getCampaignName(): ?string
    {
        return $this->campaignName;
    }
    /**
     * The campaign's latest name, or `utm_campaign` when the id is missing.
     *
     * @param string|null $campaignName
     *
     * @return self
     */
    public function setCampaignName(?string $campaignName): self
    {
        $this->initialized['campaignName'] = true;
        $this->campaignName = $campaignName;
        return $this;
    }
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @return string|null
     */
    public function getAdsetId(): ?string
    {
        return $this->adsetId;
    }
    /**
     * The ad platform's ad set id; null above `adset` level or when the touch had none.
     *
     * @param string|null $adsetId
     *
     * @return self
     */
    public function setAdsetId(?string $adsetId): self
    {
        $this->initialized['adsetId'] = true;
        $this->adsetId = $adsetId;
        return $this;
    }
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @return string|null
     */
    public function getAdsetName(): ?string
    {
        return $this->adsetName;
    }
    /**
     * The ad set's latest name, or `utm_term` when the id is missing.
     *
     * @param string|null $adsetName
     *
     * @return self
     */
    public function setAdsetName(?string $adsetName): self
    {
        $this->initialized['adsetName'] = true;
        $this->adsetName = $adsetName;
        return $this;
    }
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @return string|null
     */
    public function getAdId(): ?string
    {
        return $this->adId;
    }
    /**
     * The ad platform's ad id; null above `ad` level or when the touch had none.
     *
     * @param string|null $adId
     *
     * @return self
     */
    public function setAdId(?string $adId): self
    {
        $this->initialized['adId'] = true;
        $this->adId = $adId;
        return $this;
    }
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @return string|null
     */
    public function getAdName(): ?string
    {
        return $this->adName;
    }
    /**
     * The ad's latest name, or `utm_content` when the id is missing.
     *
     * @param string|null $adName
     *
     * @return self
     */
    public function setAdName(?string $adName): self
    {
        $this->initialized['adName'] = true;
        $this->adName = $adName;
        return $this;
    }
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
     *
     * @return string|null
     */
    public function getSurface(): ?string
    {
        return $this->surface;
    }
    /**
     * At `surface` level, `cross_surface` for people whose journey crossed surfaces, else the surface they signed up on; null at the other levels.
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
     * The row per acquisition day, with `hasDailyRows`.
     *
     * @return list<AcquisitionDay>|null
     */
    public function getDays(): ?array
    {
        return $this->days;
    }
    /**
     * The row per acquisition day, with `hasDailyRows`.
     *
     * @param list<AcquisitionDay>|null $days
     *
     * @return self
     */
    public function setDays(?array $days): self
    {
        $this->initialized['days'] = true;
        $this->days = $days;
        return $this;
    }
    /**
     * The row by signup surface, with `hasSurfaceBreakdown`.
     *
     * @return list<AcquisitionSignupSurface>|null
     */
    public function getSignupSurfaces(): ?array
    {
        return $this->signupSurfaces;
    }
    /**
     * The row by signup surface, with `hasSurfaceBreakdown`.
     *
     * @param list<AcquisitionSignupSurface>|null $signupSurfaces
     *
     * @return self
     */
    public function setSignupSurfaces(?array $signupSurfaces): self
    {
        $this->initialized['signupSurfaces'] = true;
        $this->signupSurfaces = $signupSurfaces;
        return $this;
    }
    /**
     * The row's payers and revenue by payment surface, with `hasSurfaceBreakdown`.
     *
     * @return list<AcquisitionPaymentSurface>|null
     */
    public function getPaymentSurfaces(): ?array
    {
        return $this->paymentSurfaces;
    }
    /**
     * The row's payers and revenue by payment surface, with `hasSurfaceBreakdown`.
     *
     * @param list<AcquisitionPaymentSurface>|null $paymentSurfaces
     *
     * @return self
     */
    public function setPaymentSurfaces(?array $paymentSurfaces): self
    {
        $this->initialized['paymentSurfaces'] = true;
        $this->paymentSurfaces = $paymentSurfaces;
        return $this;
    }
}