<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceRow
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
     * The platform's id of the object.
     *
     * @var string
     */
    protected $id;
    /**
     * Its name on the platform.
     *
     * @var string
     */
    protected $name;
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @var string
     */
    protected $campaignId;
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @var string|null
     */
    protected $adGroupId;
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @var string
     */
    protected $deliveryStatus;
    /**
     * Where ads send people: `website`; `app_store`; `web_to_app`, a website landing page under one of the project's web-to-app prefixes; or `mixed` for a campaign or ad group whose ads go to different places.
     *
     * @var string
     */
    protected $destination;
    /**
     * A link that opens it in the platform's own ads manager.
     *
     * @var string
     */
    protected $platformUrl;
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @var AdsReportedMetrics
     */
    protected $reported;
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @var AdsMeasuredMetrics
     */
    protected $measured;
    /**
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @var AdsModeledMetrics
     */
    protected $modeled;
    /**
     * The row sliced by the requested `breakdown`; null without one. A slice carries the source the dimension slices: `measured` for `surface`, `reported` for the rest.
     *
     * @var list<AdsPerformanceRowBreakdownItem>|null
     */
    protected $breakdown;
    /**
     * The platform's id of the object.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The platform's id of the object.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * Its name on the platform.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * Its name on the platform.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @return string
     */
    public function getCampaignId(): string
    {
        return $this->campaignId;
    }
    /**
     * The platform's id of its campaign, or its own for a campaign.
     *
     * @param string $campaignId
     *
     * @return self
     */
    public function setCampaignId(string $campaignId): self
    {
        $this->initialized['campaignId'] = true;
        $this->campaignId = $campaignId;
        return $this;
    }
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @return string|null
     */
    public function getAdGroupId(): ?string
    {
        return $this->adGroupId;
    }
    /**
     * The platform's id of its ad group, or its own for an ad group; null for campaigns.
     *
     * @param string|null $adGroupId
     *
     * @return self
     */
    public function setAdGroupId(?string $adGroupId): self
    {
        $this->initialized['adGroupId'] = true;
        $this->adGroupId = $adGroupId;
        return $this;
    }
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @return string
     */
    public function getDeliveryStatus(): string
    {
        return $this->deliveryStatus;
    }
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @param string $deliveryStatus
     *
     * @return self
     */
    public function setDeliveryStatus(string $deliveryStatus): self
    {
        $this->initialized['deliveryStatus'] = true;
        $this->deliveryStatus = $deliveryStatus;
        return $this;
    }
    /**
     * Where ads send people: `website`; `app_store`; `web_to_app`, a website landing page under one of the project's web-to-app prefixes; or `mixed` for a campaign or ad group whose ads go to different places.
     *
     * @return string
     */
    public function getDestination(): string
    {
        return $this->destination;
    }
    /**
     * Where ads send people: `website`; `app_store`; `web_to_app`, a website landing page under one of the project's web-to-app prefixes; or `mixed` for a campaign or ad group whose ads go to different places.
     *
     * @param string $destination
     *
     * @return self
     */
    public function setDestination(string $destination): self
    {
        $this->initialized['destination'] = true;
        $this->destination = $destination;
        return $this;
    }
    /**
     * A link that opens it in the platform's own ads manager.
     *
     * @return string
     */
    public function getPlatformUrl(): string
    {
        return $this->platformUrl;
    }
    /**
     * A link that opens it in the platform's own ads manager.
     *
     * @param string $platformUrl
     *
     * @return self
     */
    public function setPlatformUrl(string $platformUrl): self
    {
        $this->initialized['platformUrl'] = true;
        $this->platformUrl = $platformUrl;
        return $this;
    }
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @return AdsReportedMetrics
     */
    public function getReported(): AdsReportedMetrics
    {
        return $this->reported;
    }
    /**
     * Numbers the ad platform reports, with its own attribution.
     *
     * @param AdsReportedMetrics $reported
     *
     * @return self
     */
    public function setReported(AdsReportedMetrics $reported): self
    {
        $this->initialized['reported'] = true;
        $this->reported = $reported;
        return $this;
    }
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @return AdsMeasuredMetrics
     */
    public function getMeasured(): AdsMeasuredMetrics
    {
        return $this->measured;
    }
    /**
     * Numbers Voidhash measures from the people whose signup was credited to a touch from the row. A step the project or the destination does not have is null: a website campaign has no installs.
     *
     * @param AdsMeasuredMetrics $measured
     *
     * @return self
     */
    public function setMeasured(AdsMeasuredMetrics $measured): self
    {
        $this->initialized['measured'] = true;
        $this->measured = $measured;
        return $this;
    }
    /**
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @return AdsModeledMetrics
     */
    public function getModeled(): AdsModeledMetrics
    {
        return $this->modeled;
    }
    /**
     * An upper estimate of revenue, not a measurement: it assumes the web-bound link clicks Voidhash could not see converted like the ones it could. Each level is estimated on its own, and across a level the estimates add up to no more than the net revenue of people with no credited touch. The range's floor is `measured`.
     *
     * @param AdsModeledMetrics $modeled
     *
     * @return self
     */
    public function setModeled(AdsModeledMetrics $modeled): self
    {
        $this->initialized['modeled'] = true;
        $this->modeled = $modeled;
        return $this;
    }
    /**
     * The row sliced by the requested `breakdown`; null without one. A slice carries the source the dimension slices: `measured` for `surface`, `reported` for the rest.
     *
     * @return list<AdsPerformanceRowBreakdownItem>|null
     */
    public function getBreakdown(): ?array
    {
        return $this->breakdown;
    }
    /**
     * The row sliced by the requested `breakdown`; null without one. A slice carries the source the dimension slices: `measured` for `surface`, `reported` for the rest.
     *
     * @param list<AdsPerformanceRowBreakdownItem>|null $breakdown
     *
     * @return self
     */
    public function setBreakdown(?array $breakdown): self
    {
        $this->initialized['breakdown'] = true;
        $this->breakdown = $breakdown;
        return $this;
    }
}