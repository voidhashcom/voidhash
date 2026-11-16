<?php

namespace Voidhash\Generated\Core\Model;

class AdGroupJsonEncoding
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
     * The project whose ad account it is synced from.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The connected ad account it belongs to, `ad_acct_...`.
     *
     * @var string
     */
    protected $adAccountId;
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @var string
     */
    protected $platform;
    /**
     * Its name on the platform.
     *
     * @var string
     */
    protected $name;
    /**
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @var string
     */
    protected $status;
    /**
     * Whether an object delivers: `delivering`; `learning` or `learning_limited` (running, still learning or unable to finish learning); `not_delivering` (on, but stopped by an issue, or none of its children deliver); `in_review` or `rejected` (the platform's ad review); `paused`; `off_by_parent` (on, but a parent is off); `scheduled` or `ended` (before its start or after its end, removed objects included); `account_issue` (the ad account cannot deliver).
     *
     * @var string
     */
    protected $deliveryStatus;
    /**
     * Why it delivers the way it does, blocking reasons first; empty when nothing holds it back.
     *
     * @var list<AdDeliveryReason>
     */
    protected $deliveryReasons;
    /**
     * Where ads send people: `website`; `app_store`; `web_to_app`, a website landing page under one of the project's web-to-app prefixes; or `mixed` for a campaign or ad group whose ads go to different places.
     *
     * @var string
     */
    protected $destination;
    /**
     * The budget that funds an object: its own, or the one of the parent it shares.
     *
     * @var AdBudget
     */
    protected $budget;
    /**
     * When it is scheduled to start, as an ISO 8601 timestamp; null when not set.
     *
     * @var string|null
     */
    protected $startsAt;
    /**
     * When it is scheduled to end, as an ISO 8601 timestamp; null when it runs on.
     *
     * @var string|null
     */
    protected $endsAt;
    /**
     * A link that opens it in the platform's own ads manager.
     *
     * @var string
     */
    protected $platformUrl;
    /**
     * When the platform created it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the platform last changed it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * When Voidhash last read it from the platform, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $syncedAt;
    /**
     * The platform's id of its campaign.
     *
     * @var string
     */
    protected $campaignId;
    /**
     * The event the platform optimizes delivery for, which is also what it counts as a result, such as `purchase` or `app_install`; null when it reports none.
     *
     * @var string|null
     */
    protected $optimizationEvent;
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when its campaign sets it.
     *
     * @var string|null
     */
    protected $bidStrategy;
    /**
     * An amount set on a synced object.
     *
     * @var AdAmount
     */
    protected $bidAmount;
    /**
     * The return on ad spend it aims for under `min_roas`, such as `2.33`; null otherwise.
     *
     * @var float|null
     */
    protected $minRoas;
    /**
     * Progress through the learning phase while `deliveryStatus` is `learning`; null otherwise.
     *
     * @var AdGroupJsonEncodingLearning|null
     */
    protected $learning;
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
     * The project whose ad account it is synced from.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose ad account it is synced from.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The connected ad account it belongs to, `ad_acct_...`.
     *
     * @return string
     */
    public function getAdAccountId(): string
    {
        return $this->adAccountId;
    }
    /**
     * The connected ad account it belongs to, `ad_acct_...`.
     *
     * @param string $adAccountId
     *
     * @return self
     */
    public function setAdAccountId(string $adAccountId): self
    {
        $this->initialized['adAccountId'] = true;
        $this->adAccountId = $adAccountId;
        return $this;
    }
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * The ad platform: `meta` (Facebook and Instagram ads), the only one today.
     *
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
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
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
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
     * Why it delivers the way it does, blocking reasons first; empty when nothing holds it back.
     *
     * @return list<AdDeliveryReason>
     */
    public function getDeliveryReasons(): array
    {
        return $this->deliveryReasons;
    }
    /**
     * Why it delivers the way it does, blocking reasons first; empty when nothing holds it back.
     *
     * @param list<AdDeliveryReason> $deliveryReasons
     *
     * @return self
     */
    public function setDeliveryReasons(array $deliveryReasons): self
    {
        $this->initialized['deliveryReasons'] = true;
        $this->deliveryReasons = $deliveryReasons;
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
     * The budget that funds an object: its own, or the one of the parent it shares.
     *
     * @return AdBudget
     */
    public function getBudget(): AdBudget
    {
        return $this->budget;
    }
    /**
     * The budget that funds an object: its own, or the one of the parent it shares.
     *
     * @param AdBudget $budget
     *
     * @return self
     */
    public function setBudget(AdBudget $budget): self
    {
        $this->initialized['budget'] = true;
        $this->budget = $budget;
        return $this;
    }
    /**
     * When it is scheduled to start, as an ISO 8601 timestamp; null when not set.
     *
     * @return string|null
     */
    public function getStartsAt(): ?string
    {
        return $this->startsAt;
    }
    /**
     * When it is scheduled to start, as an ISO 8601 timestamp; null when not set.
     *
     * @param string|null $startsAt
     *
     * @return self
     */
    public function setStartsAt(?string $startsAt): self
    {
        $this->initialized['startsAt'] = true;
        $this->startsAt = $startsAt;
        return $this;
    }
    /**
     * When it is scheduled to end, as an ISO 8601 timestamp; null when it runs on.
     *
     * @return string|null
     */
    public function getEndsAt(): ?string
    {
        return $this->endsAt;
    }
    /**
     * When it is scheduled to end, as an ISO 8601 timestamp; null when it runs on.
     *
     * @param string|null $endsAt
     *
     * @return self
     */
    public function setEndsAt(?string $endsAt): self
    {
        $this->initialized['endsAt'] = true;
        $this->endsAt = $endsAt;
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
     * When the platform created it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the platform created it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the platform last changed it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the platform last changed it, as an ISO 8601 timestamp; null when the platform did not say.
     *
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
    /**
     * When Voidhash last read it from the platform, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getSyncedAt(): string
    {
        return $this->syncedAt;
    }
    /**
     * When Voidhash last read it from the platform, as an ISO 8601 timestamp.
     *
     * @param string $syncedAt
     *
     * @return self
     */
    public function setSyncedAt(string $syncedAt): self
    {
        $this->initialized['syncedAt'] = true;
        $this->syncedAt = $syncedAt;
        return $this;
    }
    /**
     * The platform's id of its campaign.
     *
     * @return string
     */
    public function getCampaignId(): string
    {
        return $this->campaignId;
    }
    /**
     * The platform's id of its campaign.
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
     * The event the platform optimizes delivery for, which is also what it counts as a result, such as `purchase` or `app_install`; null when it reports none.
     *
     * @return string|null
     */
    public function getOptimizationEvent(): ?string
    {
        return $this->optimizationEvent;
    }
    /**
     * The event the platform optimizes delivery for, which is also what it counts as a result, such as `purchase` or `app_install`; null when it reports none.
     *
     * @param string|null $optimizationEvent
     *
     * @return self
     */
    public function setOptimizationEvent(?string $optimizationEvent): self
    {
        $this->initialized['optimizationEvent'] = true;
        $this->optimizationEvent = $optimizationEvent;
        return $this;
    }
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when its campaign sets it.
     *
     * @return string|null
     */
    public function getBidStrategy(): ?string
    {
        return $this->bidStrategy;
    }
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when its campaign sets it.
     *
     * @param string|null $bidStrategy
     *
     * @return self
     */
    public function setBidStrategy(?string $bidStrategy): self
    {
        $this->initialized['bidStrategy'] = true;
        $this->bidStrategy = $bidStrategy;
        return $this;
    }
    /**
     * An amount set on a synced object.
     *
     * @return AdAmount
     */
    public function getBidAmount(): AdAmount
    {
        return $this->bidAmount;
    }
    /**
     * An amount set on a synced object.
     *
     * @param AdAmount $bidAmount
     *
     * @return self
     */
    public function setBidAmount(AdAmount $bidAmount): self
    {
        $this->initialized['bidAmount'] = true;
        $this->bidAmount = $bidAmount;
        return $this;
    }
    /**
     * The return on ad spend it aims for under `min_roas`, such as `2.33`; null otherwise.
     *
     * @return float|null
     */
    public function getMinRoas(): ?float
    {
        return $this->minRoas;
    }
    /**
     * The return on ad spend it aims for under `min_roas`, such as `2.33`; null otherwise.
     *
     * @param float|null $minRoas
     *
     * @return self
     */
    public function setMinRoas(?float $minRoas): self
    {
        $this->initialized['minRoas'] = true;
        $this->minRoas = $minRoas;
        return $this;
    }
    /**
     * Progress through the learning phase while `deliveryStatus` is `learning`; null otherwise.
     *
     * @return AdGroupJsonEncodingLearning|null
     */
    public function getLearning(): ?AdGroupJsonEncodingLearning
    {
        return $this->learning;
    }
    /**
     * Progress through the learning phase while `deliveryStatus` is `learning`; null otherwise.
     *
     * @param AdGroupJsonEncodingLearning|null $learning
     *
     * @return self
     */
    public function setLearning(?AdGroupJsonEncodingLearning $learning): self
    {
        $this->initialized['learning'] = true;
        $this->learning = $learning;
        return $this;
    }
}