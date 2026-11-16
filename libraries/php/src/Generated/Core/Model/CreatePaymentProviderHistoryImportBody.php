<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaymentProviderHistoryImportBody
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
     * The environment to import: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @var string
     */
    protected $environment;
    /**
     * The environment to import: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment to import: `production`, or `test` (Stripe's test mode, a payment source's test payments).
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
}