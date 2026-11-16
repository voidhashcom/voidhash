<?php

namespace Voidhash\Generated\Core\Model;

class OrganizationSettingsJsonEncoding
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
     * The BCP 47 tag of the language the organization's bots write in; null until one is chosen, when they write in the language people write to them in. The dashboard stays in English whatever this says.
     *
     * @var string|null
     */
    protected $preferredLanguage;
    /**
     * The ISO 4217 code insights, ad reports and the dashboard give money in; null until one is chosen, when insights report USD and ad reports their accounts' currency (USD when the accounts differ). Reports convert purchases at the exchange rate of the day they happened.
     *
     * @var string|null
     */
    protected $reportingCurrency;
    /**
     * The BCP 47 tag of the language the organization's bots write in; null until one is chosen, when they write in the language people write to them in. The dashboard stays in English whatever this says.
     *
     * @return string|null
     */
    public function getPreferredLanguage(): ?string
    {
        return $this->preferredLanguage;
    }
    /**
     * The BCP 47 tag of the language the organization's bots write in; null until one is chosen, when they write in the language people write to them in. The dashboard stays in English whatever this says.
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
     * The ISO 4217 code insights, ad reports and the dashboard give money in; null until one is chosen, when insights report USD and ad reports their accounts' currency (USD when the accounts differ). Reports convert purchases at the exchange rate of the day they happened.
     *
     * @return string|null
     */
    public function getReportingCurrency(): ?string
    {
        return $this->reportingCurrency;
    }
    /**
     * The ISO 4217 code insights, ad reports and the dashboard give money in; null until one is chosen, when insights report USD and ad reports their accounts' currency (USD when the accounts differ). Reports convert purchases at the exchange rate of the day they happened.
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