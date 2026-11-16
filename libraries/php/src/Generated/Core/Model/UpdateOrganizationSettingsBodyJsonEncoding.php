<?php

namespace Voidhash\Generated\Core\Model;

class UpdateOrganizationSettingsBodyJsonEncoding
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
     * The BCP 47 tag of a language Voidhash offers, such as `cs` or `pt-BR`. It applies to a bot's next message.
     *
     * @var string|null
     */
    protected $preferredLanguage;
    /**
     * An uppercase ISO 4217 code Voidhash keeps daily exchange rates for since 2010, such as `EUR`. It applies to every report from then on, past ranges included.
     *
     * @var string|null
     */
    protected $reportingCurrency;
    /**
     * The BCP 47 tag of a language Voidhash offers, such as `cs` or `pt-BR`. It applies to a bot's next message.
     *
     * @return string|null
     */
    public function getPreferredLanguage(): ?string
    {
        return $this->preferredLanguage;
    }
    /**
     * The BCP 47 tag of a language Voidhash offers, such as `cs` or `pt-BR`. It applies to a bot's next message.
     *
     * @param string|null $preferredLanguage
     *
     * @return self
     */
    public function setPreferredLanguage(?string $preferredLanguage): self
    {
        $this->initialized['preferredLanguage'] = true;
        $this->preferredLanguage = $preferredLanguage;
        return $this;
    }
    /**
     * An uppercase ISO 4217 code Voidhash keeps daily exchange rates for since 2010, such as `EUR`. It applies to every report from then on, past ranges included.
     *
     * @return string|null
     */
    public function getReportingCurrency(): ?string
    {
        return $this->reportingCurrency;
    }
    /**
     * An uppercase ISO 4217 code Voidhash keeps daily exchange rates for since 2010, such as `EUR`. It applies to every report from then on, past ranges included.
     *
     * @param string|null $reportingCurrency
     *
     * @return self
     */
    public function setReportingCurrency(?string $reportingCurrency): self
    {
        $this->initialized['reportingCurrency'] = true;
        $this->reportingCurrency = $reportingCurrency;
        return $this;
    }
}