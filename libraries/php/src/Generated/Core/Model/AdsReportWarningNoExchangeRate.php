<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningNoExchangeRate
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
     * What the warning is about.
     *
     * @var string
     */
    protected $code;
    /**
     * ISO 4217 codes with no current rate.
     *
     * @var list<string>
     */
    protected $currencies;
    /**
     * What the warning is about.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * What the warning is about.
     *
     * @param string $code
     *
     * @return self
     */
    public function setCode(string $code): self
    {
        $this->initialized['code'] = true;
        $this->code = $code;
        return $this;
    }
    /**
     * ISO 4217 codes with no current rate.
     *
     * @return list<string>
     */
    public function getCurrencies(): array
    {
        return $this->currencies;
    }
    /**
     * ISO 4217 codes with no current rate.
     *
     * @param list<string> $currencies
     *
     * @return self
     */
    public function setCurrencies(array $currencies): self
    {
        $this->initialized['currencies'] = true;
        $this->currencies = $currencies;
        return $this;
    }
}