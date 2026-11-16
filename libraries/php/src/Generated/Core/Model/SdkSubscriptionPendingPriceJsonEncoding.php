<?php

namespace Voidhash\Generated\Core\Model;

class SdkSubscriptionPendingPriceJsonEncoding
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
     * @var mixed
     */
    protected $amountMicros;
    /**
     * `pending` while the store waits for the customer to agree to the new price, `accepted` once they did or when the change needs no consent; null when the store did not say.
     *
     * @var string|null
     */
    protected $consent;
    /**
     * The ISO 4217 code of the new price's currency.
     *
     * @var string
     */
    protected $currency;
    /**
     * When the new price is first charged, as an ISO 8601 timestamp; null when the store did not say, which means at the next renewal.
     *
     * @var string|null
     */
    protected $effectiveAt;
    /**
     * @return mixed
     */
    public function getAmountMicros()
    {
        return $this->amountMicros;
    }
    /**
     * @param mixed $amountMicros
     *
     * @return self
     */
    public function setAmountMicros($amountMicros): self
    {
        $this->initialized['amountMicros'] = true;
        $this->amountMicros = $amountMicros;
        return $this;
    }
    /**
     * `pending` while the store waits for the customer to agree to the new price, `accepted` once they did or when the change needs no consent; null when the store did not say.
     *
     * @return string|null
     */
    public function getConsent(): ?string
    {
        return $this->consent;
    }
    /**
     * `pending` while the store waits for the customer to agree to the new price, `accepted` once they did or when the change needs no consent; null when the store did not say.
     *
     * @param string|null $consent
     *
     * @return self
     */
    public function setConsent(?string $consent): self
    {
        $this->initialized['consent'] = true;
        $this->consent = $consent;
        return $this;
    }
    /**
     * The ISO 4217 code of the new price's currency.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code of the new price's currency.
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
     * When the new price is first charged, as an ISO 8601 timestamp; null when the store did not say, which means at the next renewal.
     *
     * @return string|null
     */
    public function getEffectiveAt(): ?string
    {
        return $this->effectiveAt;
    }
    /**
     * When the new price is first charged, as an ISO 8601 timestamp; null when the store did not say, which means at the next renewal.
     *
     * @param string|null $effectiveAt
     *
     * @return self
     */
    public function setEffectiveAt(?string $effectiveAt): self
    {
        $this->initialized['effectiveAt'] = true;
        $this->effectiveAt = $effectiveAt;
        return $this;
    }
}