<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionPaymentSurface
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
     * Where people paid: `web` (Stripe and other web payments), `ios` (App Store), `android` (Google Play) or `unknown`.
     *
     * @var string
     */
    protected $surface;
    /**
     * Payers whose first charge was on the surface.
     *
     * @var int
     */
    protected $payingPeople;
    /**
     * Charges made on the surface, in integer minor units of the report currency, such as cents.
     *
     * @var int
     */
    protected $grossRevenue;
    /**
     * Refunds of charges made on the surface, in integer minor units of the report currency, such as cents.
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
     * Where people paid: `web` (Stripe and other web payments), `ios` (App Store), `android` (Google Play) or `unknown`.
     *
     * @return string
     */
    public function getSurface(): string
    {
        return $this->surface;
    }
    /**
     * Where people paid: `web` (Stripe and other web payments), `ios` (App Store), `android` (Google Play) or `unknown`.
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
     * Payers whose first charge was on the surface.
     *
     * @return int
     */
    public function getPayingPeople(): int
    {
        return $this->payingPeople;
    }
    /**
     * Payers whose first charge was on the surface.
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
     * Charges made on the surface, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getGrossRevenue(): int
    {
        return $this->grossRevenue;
    }
    /**
     * Charges made on the surface, in integer minor units of the report currency, such as cents.
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
     * Refunds of charges made on the surface, in integer minor units of the report currency, such as cents.
     *
     * @return int
     */
    public function getRefunds(): int
    {
        return $this->refunds;
    }
    /**
     * Refunds of charges made on the surface, in integer minor units of the report currency, such as cents.
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