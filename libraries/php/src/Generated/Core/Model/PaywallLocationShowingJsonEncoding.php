<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationShowingJsonEncoding
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
     * The showing's id, `pw_loc_show_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The location that showed it, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * What a showing serves: a `paywall`'s deployed build, or a `feature_flag` whose variants decide the paywall, as a running A/B test does.
     *
     * @var string
     */
    protected $type;
    /**
     * Whose apps it reaches: `production` for every app, test keys' included while test has no showing of its own; `test` for apps using a test key only.
     *
     * @var string
     */
    protected $environment;
    /**
     * The paywall served, `pw_...`; null for a `feature_flag` showing.
     *
     * @var string|null
     */
    protected $paywallId;
    /**
     * The number of the paywall's build served; null for a `feature_flag` showing. Deploying another build starts a new showing.
     *
     * @var int|null
     */
    protected $buildNumber;
    /**
     * The feature flag deciding what is served, `ff_...`; null for a `paywall` showing.
     *
     * @var string|null
     */
    protected $featureFlagId;
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startedAt;
    /**
     * When the location stopped showing it, as an ISO 8601 timestamp; null for the current showing of its environment.
     *
     * @var string|null
     */
    protected $endedAt;
    /**
     * The team member who set it, or whose deploy started it, `user_...`; null when a project key did, or they no longer exist.
     *
     * @var string|null
     */
    protected $createdByUserId;
    /**
     * The showing's id, `pw_loc_show_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The showing's id, `pw_loc_show_...`.
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
     * The location that showed it, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location that showed it, `pw_loc_...`.
     *
     * @param string $paywallLocationId
     *
     * @return self
     */
    public function setPaywallLocationId(string $paywallLocationId): self
    {
        $this->initialized['paywallLocationId'] = true;
        $this->paywallLocationId = $paywallLocationId;
        return $this;
    }
    /**
     * What a showing serves: a `paywall`'s deployed build, or a `feature_flag` whose variants decide the paywall, as a running A/B test does.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What a showing serves: a `paywall`'s deployed build, or a `feature_flag` whose variants decide the paywall, as a running A/B test does.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * Whose apps it reaches: `production` for every app, test keys' included while test has no showing of its own; `test` for apps using a test key only.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Whose apps it reaches: `production` for every app, test keys' included while test has no showing of its own; `test` for apps using a test key only.
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
    /**
     * The paywall served, `pw_...`; null for a `feature_flag` showing.
     *
     * @return string|null
     */
    public function getPaywallId(): ?string
    {
        return $this->paywallId;
    }
    /**
     * The paywall served, `pw_...`; null for a `feature_flag` showing.
     *
     * @param string|null $paywallId
     *
     * @return self
     */
    public function setPaywallId(?string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * The number of the paywall's build served; null for a `feature_flag` showing. Deploying another build starts a new showing.
     *
     * @return int|null
     */
    public function getBuildNumber(): ?int
    {
        return $this->buildNumber;
    }
    /**
     * The number of the paywall's build served; null for a `feature_flag` showing. Deploying another build starts a new showing.
     *
     * @param int|null $buildNumber
     *
     * @return self
     */
    public function setBuildNumber(?int $buildNumber): self
    {
        $this->initialized['buildNumber'] = true;
        $this->buildNumber = $buildNumber;
        return $this;
    }
    /**
     * The feature flag deciding what is served, `ff_...`; null for a `paywall` showing.
     *
     * @return string|null
     */
    public function getFeatureFlagId(): ?string
    {
        return $this->featureFlagId;
    }
    /**
     * The feature flag deciding what is served, `ff_...`; null for a `paywall` showing.
     *
     * @param string|null $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(?string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartedAt(): string
    {
        return $this->startedAt;
    }
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @param string $startedAt
     *
     * @return self
     */
    public function setStartedAt(string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
        return $this;
    }
    /**
     * When the location stopped showing it, as an ISO 8601 timestamp; null for the current showing of its environment.
     *
     * @return string|null
     */
    public function getEndedAt(): ?string
    {
        return $this->endedAt;
    }
    /**
     * When the location stopped showing it, as an ISO 8601 timestamp; null for the current showing of its environment.
     *
     * @param string|null $endedAt
     *
     * @return self
     */
    public function setEndedAt(?string $endedAt): self
    {
        $this->initialized['endedAt'] = true;
        $this->endedAt = $endedAt;
        return $this;
    }
    /**
     * The team member who set it, or whose deploy started it, `user_...`; null when a project key did, or they no longer exist.
     *
     * @return string|null
     */
    public function getCreatedByUserId(): ?string
    {
        return $this->createdByUserId;
    }
    /**
     * The team member who set it, or whose deploy started it, `user_...`; null when a project key did, or they no longer exist.
     *
     * @param string|null $createdByUserId
     *
     * @return self
     */
    public function setCreatedByUserId(?string $createdByUserId): self
    {
        $this->initialized['createdByUserId'] = true;
        $this->createdByUserId = $createdByUserId;
        return $this;
    }
}