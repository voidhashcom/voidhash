<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingConvertedOnJourneysItem
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
     * Where the credited touch happened; null for a person no touch acquired.
     *
     * @var string|null
     */
    protected $touch;
    /**
     * The surface the person signed up on.
     *
     * @var string
     */
    protected $signup;
    /**
     * The surface of their first charge.
     *
     * @var string
     */
    protected $payment;
    /**
     * Payers who took this path.
     *
     * @var int
     */
    protected $payingPeople;
    /**
     * Where the credited touch happened; null for a person no touch acquired.
     *
     * @return string|null
     */
    public function getTouch(): ?string
    {
        return $this->touch;
    }
    /**
     * Where the credited touch happened; null for a person no touch acquired.
     *
     * @param string|null $touch
     *
     * @return self
     */
    public function setTouch(?string $touch): self
    {
        $this->initialized['touch'] = true;
        $this->touch = $touch;
        return $this;
    }
    /**
     * The surface the person signed up on.
     *
     * @return string
     */
    public function getSignup(): string
    {
        return $this->signup;
    }
    /**
     * The surface the person signed up on.
     *
     * @param string $signup
     *
     * @return self
     */
    public function setSignup(string $signup): self
    {
        $this->initialized['signup'] = true;
        $this->signup = $signup;
        return $this;
    }
    /**
     * The surface of their first charge.
     *
     * @return string
     */
    public function getPayment(): string
    {
        return $this->payment;
    }
    /**
     * The surface of their first charge.
     *
     * @param string $payment
     *
     * @return self
     */
    public function setPayment(string $payment): self
    {
        $this->initialized['payment'] = true;
        $this->payment = $payment;
        return $this;
    }
    /**
     * Payers who took this path.
     *
     * @return int
     */
    public function getPayingPeople(): int
    {
        return $this->payingPeople;
    }
    /**
     * Payers who took this path.
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
}