<?php

namespace Voidhash\Generated\Core\Model;

class AdsChangesReportJsonEncoding
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
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $since;
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $until;
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @var string
     */
    protected $level;
    /**
     * The connected ad accounts the changes come from.
     *
     * @var list<AdsChangesReportJsonEncodingAccountsItem>
     */
    protected $accounts;
    /**
     * Decisions made in the period, oldest first.
     *
     * @var list<AdsDecision>
     */
    protected $decisions;
    /**
     * What was delivered between syncs, oldest read first.
     *
     * @var list<AdsDeliveryChange>
     */
    protected $delivery;
    /**
     * The platform's corrections to days that had already ended, oldest read first.
     *
     * @var list<AdsRevision>
     */
    protected $revisions;
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @var list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects>
     */
    protected $warnings;
    /**
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getSince(): string
    {
        return $this->since;
    }
    /**
     * Start of the period, inclusive, as an ISO 8601 timestamp.
     *
     * @param string $since
     *
     * @return self
     */
    public function setSince(string $since): self
    {
        $this->initialized['since'] = true;
        $this->since = $since;
        return $this;
    }
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUntil(): string
    {
        return $this->until;
    }
    /**
     * End of the period, exclusive, as an ISO 8601 timestamp.
     *
     * @param string $until
     *
     * @return self
     */
    public function setUntil(string $until): self
    {
        $this->initialized['until'] = true;
        $this->until = $until;
        return $this;
    }
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @return string
     */
    public function getLevel(): string
    {
        return $this->level;
    }
    /**
     * The level of the ad hierarchy: `campaign`, `ad_group` (Meta: ad set) or `ad`.
     *
     * @param string $level
     *
     * @return self
     */
    public function setLevel(string $level): self
    {
        $this->initialized['level'] = true;
        $this->level = $level;
        return $this;
    }
    /**
     * The connected ad accounts the changes come from.
     *
     * @return list<AdsChangesReportJsonEncodingAccountsItem>
     */
    public function getAccounts(): array
    {
        return $this->accounts;
    }
    /**
     * The connected ad accounts the changes come from.
     *
     * @param list<AdsChangesReportJsonEncodingAccountsItem> $accounts
     *
     * @return self
     */
    public function setAccounts(array $accounts): self
    {
        $this->initialized['accounts'] = true;
        $this->accounts = $accounts;
        return $this;
    }
    /**
     * Decisions made in the period, oldest first.
     *
     * @return list<AdsDecision>
     */
    public function getDecisions(): array
    {
        return $this->decisions;
    }
    /**
     * Decisions made in the period, oldest first.
     *
     * @param list<AdsDecision> $decisions
     *
     * @return self
     */
    public function setDecisions(array $decisions): self
    {
        $this->initialized['decisions'] = true;
        $this->decisions = $decisions;
        return $this;
    }
    /**
     * What was delivered between syncs, oldest read first.
     *
     * @return list<AdsDeliveryChange>
     */
    public function getDelivery(): array
    {
        return $this->delivery;
    }
    /**
     * What was delivered between syncs, oldest read first.
     *
     * @param list<AdsDeliveryChange> $delivery
     *
     * @return self
     */
    public function setDelivery(array $delivery): self
    {
        $this->initialized['delivery'] = true;
        $this->delivery = $delivery;
        return $this;
    }
    /**
     * The platform's corrections to days that had already ended, oldest read first.
     *
     * @return list<AdsRevision>
     */
    public function getRevisions(): array
    {
        return $this->revisions;
    }
    /**
     * The platform's corrections to days that had already ended, oldest read first.
     *
     * @param list<AdsRevision> $revisions
     *
     * @return self
     */
    public function setRevisions(array $revisions): self
    {
        $this->initialized['revisions'] = true;
        $this->revisions = $revisions;
        return $this;
    }
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @return list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects>
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
    /**
     * Caveats about how complete or comparable the numbers are; empty when there are none.
     *
     * @param list<AdsReportWarningCurrencyConverted>|list<AdsReportWarningNoExchangeRate>|list<AdsReportWarningTimezoneDiffers>|list<AdsReportWarningSyncPending>|list<AdsReportWarningSyncStopped>|list<AdsReportWarningSyncFailed>|list<AdsReportWarningRangeIncludesToday>|list<AdsReportWarningBreakdownsNotKept>|list<AdsReportWarningReachLimited>|list<AdsReportWarningReachUnavailable>|list<AdsReportWarningTooManyObjects> $warnings
     *
     * @return self
     */
    public function setWarnings(array $warnings): self
    {
        $this->initialized['warnings'] = true;
        $this->warnings = $warnings;
        return $this;
    }
}