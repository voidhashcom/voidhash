<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentJsonEncoding
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
     * The experiment's id, `exp_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the experiment belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The experiment's name.
     *
     * @var string
     */
    protected $name;
    /**
     * What the experiment is about; null when it has none.
     *
     * @var string|null
     */
    protected $description;
    /**
     * What you expect to happen, and why; null when it has none.
     *
     * @var string|null
     */
    protected $hypothesis;
    /**
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
     *
     * @var string
     */
    protected $status;
    /**
     * The event that counts as a conversion. Null counts `purchase_completed`, which Voidhash itself never sends, so set the goal explicitly: `$subscription.created` for a new subscription, trial starts included, or `$purchase.completed` for any purchase, one-time and consumable ones included. It cannot change once the experiment leaves `draft`.
     *
     * @var string|null
     */
    protected $primaryMetricEventName;
    /**
     * Further events to watch alongside the primary one; results do not count them. They cannot change once the experiment leaves `draft`.
     *
     * @var list<string>
     */
    protected $secondaryMetricEventNames;
    /**
     * The paywall locations whose traffic the experiment splits, `pw_loc_...`.
     *
     * @var list<string>
     */
    protected $paywallLocationIds;
    /**
     * The feature flags the experiment's arms give a value, `ff_...`. While it runs, each takes the value of the end user's arm, after the flag's switch and overrides and before its rules. Not `featureFlagId`, which assigns the arms.
     *
     * @var list<string>
     */
    protected $testedFeatureFlagIds;
    /**
     * The arm promoted when the experiment concluded, `exp_var_...`: the winner named, or else the control. Null until then.
     *
     * @var string|null
     */
    protected $winningVariantId;
    /**
     * The feature flag that assigns end users to arms, `ff_...`. An override on it with `variantKey` set to an arm's id puts a tester in that arm.
     *
     * @var string
     */
    protected $featureFlagId;
    /**
     * Whether the experiment is archived.
     *
     * @var bool
     */
    protected $isArchived;
    /**
     * When the experiment last started or resumed, as an ISO 8601 timestamp; null while it is a draft. Results count from then.
     *
     * @var string|null
     */
    protected $startedAt;
    /**
     * When the experiment concluded, as an ISO 8601 timestamp; null until then.
     *
     * @var string|null
     */
    protected $endedAt;
    /**
     * When the experiment was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the experiment was last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The experiment's id, `exp_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The experiment's id, `exp_...`.
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
     * The project the experiment belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the experiment belongs to.
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
     * The experiment's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The experiment's name.
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
     * What the experiment is about; null when it has none.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the experiment is about; null when it has none.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * What you expect to happen, and why; null when it has none.
     *
     * @return string|null
     */
    public function getHypothesis(): ?string
    {
        return $this->hypothesis;
    }
    /**
     * What you expect to happen, and why; null when it has none.
     *
     * @param string|null $hypothesis
     *
     * @return self
     */
    public function setHypothesis(?string $hypothesis): self
    {
        $this->initialized['hypothesis'] = true;
        $this->hypothesis = $hypothesis;
        return $this;
    }
    /**
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where the experiment is in its life: a `draft` assigns no traffic, a `running` one splits it between the arms, a `paused` one shows every end user the control arm, and a `concluded` one has promoted a winner and never runs again.
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
     * The event that counts as a conversion. Null counts `purchase_completed`, which Voidhash itself never sends, so set the goal explicitly: `$subscription.created` for a new subscription, trial starts included, or `$purchase.completed` for any purchase, one-time and consumable ones included. It cannot change once the experiment leaves `draft`.
     *
     * @return string|null
     */
    public function getPrimaryMetricEventName(): ?string
    {
        return $this->primaryMetricEventName;
    }
    /**
     * The event that counts as a conversion. Null counts `purchase_completed`, which Voidhash itself never sends, so set the goal explicitly: `$subscription.created` for a new subscription, trial starts included, or `$purchase.completed` for any purchase, one-time and consumable ones included. It cannot change once the experiment leaves `draft`.
     *
     * @param string|null $primaryMetricEventName
     *
     * @return self
     */
    public function setPrimaryMetricEventName(?string $primaryMetricEventName): self
    {
        $this->initialized['primaryMetricEventName'] = true;
        $this->primaryMetricEventName = $primaryMetricEventName;
        return $this;
    }
    /**
     * Further events to watch alongside the primary one; results do not count them. They cannot change once the experiment leaves `draft`.
     *
     * @return list<string>
     */
    public function getSecondaryMetricEventNames(): array
    {
        return $this->secondaryMetricEventNames;
    }
    /**
     * Further events to watch alongside the primary one; results do not count them. They cannot change once the experiment leaves `draft`.
     *
     * @param list<string> $secondaryMetricEventNames
     *
     * @return self
     */
    public function setSecondaryMetricEventNames(array $secondaryMetricEventNames): self
    {
        $this->initialized['secondaryMetricEventNames'] = true;
        $this->secondaryMetricEventNames = $secondaryMetricEventNames;
        return $this;
    }
    /**
     * The paywall locations whose traffic the experiment splits, `pw_loc_...`.
     *
     * @return list<string>
     */
    public function getPaywallLocationIds(): array
    {
        return $this->paywallLocationIds;
    }
    /**
     * The paywall locations whose traffic the experiment splits, `pw_loc_...`.
     *
     * @param list<string> $paywallLocationIds
     *
     * @return self
     */
    public function setPaywallLocationIds(array $paywallLocationIds): self
    {
        $this->initialized['paywallLocationIds'] = true;
        $this->paywallLocationIds = $paywallLocationIds;
        return $this;
    }
    /**
     * The feature flags the experiment's arms give a value, `ff_...`. While it runs, each takes the value of the end user's arm, after the flag's switch and overrides and before its rules. Not `featureFlagId`, which assigns the arms.
     *
     * @return list<string>
     */
    public function getTestedFeatureFlagIds(): array
    {
        return $this->testedFeatureFlagIds;
    }
    /**
     * The feature flags the experiment's arms give a value, `ff_...`. While it runs, each takes the value of the end user's arm, after the flag's switch and overrides and before its rules. Not `featureFlagId`, which assigns the arms.
     *
     * @param list<string> $testedFeatureFlagIds
     *
     * @return self
     */
    public function setTestedFeatureFlagIds(array $testedFeatureFlagIds): self
    {
        $this->initialized['testedFeatureFlagIds'] = true;
        $this->testedFeatureFlagIds = $testedFeatureFlagIds;
        return $this;
    }
    /**
     * The arm promoted when the experiment concluded, `exp_var_...`: the winner named, or else the control. Null until then.
     *
     * @return string|null
     */
    public function getWinningVariantId(): ?string
    {
        return $this->winningVariantId;
    }
    /**
     * The arm promoted when the experiment concluded, `exp_var_...`: the winner named, or else the control. Null until then.
     *
     * @param string|null $winningVariantId
     *
     * @return self
     */
    public function setWinningVariantId(?string $winningVariantId): self
    {
        $this->initialized['winningVariantId'] = true;
        $this->winningVariantId = $winningVariantId;
        return $this;
    }
    /**
     * The feature flag that assigns end users to arms, `ff_...`. An override on it with `variantKey` set to an arm's id puts a tester in that arm.
     *
     * @return string
     */
    public function getFeatureFlagId(): string
    {
        return $this->featureFlagId;
    }
    /**
     * The feature flag that assigns end users to arms, `ff_...`. An override on it with `variantKey` set to an arm's id puts a tester in that arm.
     *
     * @param string $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * Whether the experiment is archived.
     *
     * @return bool
     */
    public function getIsArchived(): bool
    {
        return $this->isArchived;
    }
    /**
     * Whether the experiment is archived.
     *
     * @param bool $isArchived
     *
     * @return self
     */
    public function setIsArchived(bool $isArchived): self
    {
        $this->initialized['isArchived'] = true;
        $this->isArchived = $isArchived;
        return $this;
    }
    /**
     * When the experiment last started or resumed, as an ISO 8601 timestamp; null while it is a draft. Results count from then.
     *
     * @return string|null
     */
    public function getStartedAt(): ?string
    {
        return $this->startedAt;
    }
    /**
     * When the experiment last started or resumed, as an ISO 8601 timestamp; null while it is a draft. Results count from then.
     *
     * @param string|null $startedAt
     *
     * @return self
     */
    public function setStartedAt(?string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
        return $this;
    }
    /**
     * When the experiment concluded, as an ISO 8601 timestamp; null until then.
     *
     * @return string|null
     */
    public function getEndedAt(): ?string
    {
        return $this->endedAt;
    }
    /**
     * When the experiment concluded, as an ISO 8601 timestamp; null until then.
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
     * When the experiment was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the experiment was created, as an ISO 8601 timestamp.
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
     * When the experiment was last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the experiment was last changed, as an ISO 8601 timestamp.
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
}