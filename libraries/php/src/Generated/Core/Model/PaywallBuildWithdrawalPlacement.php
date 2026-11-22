<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildWithdrawalPlacement
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
     * How the place serves the build: `location`, through the location's own showing, rules or pins naming the paywall while the build is deployed; or `test_arm`, an arm of a running or paused A/B test that keeps the build there.
     *
     * @var string
     */
    protected $kind;
    /**
     * The keys served there: `production`, or `test`, which a test key reads.
     *
     * @var string
     */
    protected $environment;
    /**
     * The location, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * The location's name.
     *
     * @var string
     */
    protected $paywallLocationName;
    /**
     * For a `location`, whether its own showing serves the paywall to those keys; false for a `test_arm`.
     *
     * @var bool
     */
    protected $hasShowing;
    /**
     * For a `location`, whether rules there show the paywall to some of those keys; false for a `test_arm`.
     *
     * @var bool
     */
    protected $hasRules;
    /**
     * For a `location`, whether people pinned there are shown the paywall; false for a `test_arm`.
     *
     * @var bool
     */
    protected $hasPins;
    /**
     * For a `test_arm`, the experiment, `exp_...`; null otherwise.
     *
     * @var string|null
     */
    protected $experimentId;
    /**
     * For a `test_arm`, the experiment's name; null otherwise.
     *
     * @var string|null
     */
    protected $experimentName;
    /**
     * For a `test_arm`, the arm, `exp_var_...`; null otherwise.
     *
     * @var string|null
     */
    protected $variantId;
    /**
     * For a `test_arm`, the arm's name; null otherwise.
     *
     * @var string|null
     */
    protected $variantName;
    /**
     * For a `test_arm`, whether its experiment is paused, showing everyone its control arm; false otherwise.
     *
     * @var bool
     */
    protected $isPaused;
    /**
     * The build apps that can show every build are served there instead while this one is withdrawn: the most recent earlier build deployed there that is not withdrawn and fits the location, preferring for an arm the builds it kept before. Null when there is none, so they are shown no paywall there.
     *
     * @var int|null
     */
    protected $servedBuildNumber;
    /**
     * How the place serves the build: `location`, through the location's own showing, rules or pins naming the paywall while the build is deployed; or `test_arm`, an arm of a running or paused A/B test that keeps the build there.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * How the place serves the build: `location`, through the location's own showing, rules or pins naming the paywall while the build is deployed; or `test_arm`, an arm of a running or paused A/B test that keeps the build there.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The keys served there: `production`, or `test`, which a test key reads.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The keys served there: `production`, or `test`, which a test key reads.
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
     * The location, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location, `pw_loc_...`.
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
     * The location's name.
     *
     * @return string
     */
    public function getPaywallLocationName(): string
    {
        return $this->paywallLocationName;
    }
    /**
     * The location's name.
     *
     * @param string $paywallLocationName
     *
     * @return self
     */
    public function setPaywallLocationName(string $paywallLocationName): self
    {
        $this->initialized['paywallLocationName'] = true;
        $this->paywallLocationName = $paywallLocationName;
        return $this;
    }
    /**
     * For a `location`, whether its own showing serves the paywall to those keys; false for a `test_arm`.
     *
     * @return bool
     */
    public function getHasShowing(): bool
    {
        return $this->hasShowing;
    }
    /**
     * For a `location`, whether its own showing serves the paywall to those keys; false for a `test_arm`.
     *
     * @param bool $hasShowing
     *
     * @return self
     */
    public function setHasShowing(bool $hasShowing): self
    {
        $this->initialized['hasShowing'] = true;
        $this->hasShowing = $hasShowing;
        return $this;
    }
    /**
     * For a `location`, whether rules there show the paywall to some of those keys; false for a `test_arm`.
     *
     * @return bool
     */
    public function getHasRules(): bool
    {
        return $this->hasRules;
    }
    /**
     * For a `location`, whether rules there show the paywall to some of those keys; false for a `test_arm`.
     *
     * @param bool $hasRules
     *
     * @return self
     */
    public function setHasRules(bool $hasRules): self
    {
        $this->initialized['hasRules'] = true;
        $this->hasRules = $hasRules;
        return $this;
    }
    /**
     * For a `location`, whether people pinned there are shown the paywall; false for a `test_arm`.
     *
     * @return bool
     */
    public function getHasPins(): bool
    {
        return $this->hasPins;
    }
    /**
     * For a `location`, whether people pinned there are shown the paywall; false for a `test_arm`.
     *
     * @param bool $hasPins
     *
     * @return self
     */
    public function setHasPins(bool $hasPins): self
    {
        $this->initialized['hasPins'] = true;
        $this->hasPins = $hasPins;
        return $this;
    }
    /**
     * For a `test_arm`, the experiment, `exp_...`; null otherwise.
     *
     * @return string|null
     */
    public function getExperimentId(): ?string
    {
        return $this->experimentId;
    }
    /**
     * For a `test_arm`, the experiment, `exp_...`; null otherwise.
     *
     * @param string|null $experimentId
     *
     * @return self
     */
    public function setExperimentId(?string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * For a `test_arm`, the experiment's name; null otherwise.
     *
     * @return string|null
     */
    public function getExperimentName(): ?string
    {
        return $this->experimentName;
    }
    /**
     * For a `test_arm`, the experiment's name; null otherwise.
     *
     * @param string|null $experimentName
     *
     * @return self
     */
    public function setExperimentName(?string $experimentName): self
    {
        $this->initialized['experimentName'] = true;
        $this->experimentName = $experimentName;
        return $this;
    }
    /**
     * For a `test_arm`, the arm, `exp_var_...`; null otherwise.
     *
     * @return string|null
     */
    public function getVariantId(): ?string
    {
        return $this->variantId;
    }
    /**
     * For a `test_arm`, the arm, `exp_var_...`; null otherwise.
     *
     * @param string|null $variantId
     *
     * @return self
     */
    public function setVariantId(?string $variantId): self
    {
        $this->initialized['variantId'] = true;
        $this->variantId = $variantId;
        return $this;
    }
    /**
     * For a `test_arm`, the arm's name; null otherwise.
     *
     * @return string|null
     */
    public function getVariantName(): ?string
    {
        return $this->variantName;
    }
    /**
     * For a `test_arm`, the arm's name; null otherwise.
     *
     * @param string|null $variantName
     *
     * @return self
     */
    public function setVariantName(?string $variantName): self
    {
        $this->initialized['variantName'] = true;
        $this->variantName = $variantName;
        return $this;
    }
    /**
     * For a `test_arm`, whether its experiment is paused, showing everyone its control arm; false otherwise.
     *
     * @return bool
     */
    public function getIsPaused(): bool
    {
        return $this->isPaused;
    }
    /**
     * For a `test_arm`, whether its experiment is paused, showing everyone its control arm; false otherwise.
     *
     * @param bool $isPaused
     *
     * @return self
     */
    public function setIsPaused(bool $isPaused): self
    {
        $this->initialized['isPaused'] = true;
        $this->isPaused = $isPaused;
        return $this;
    }
    /**
     * The build apps that can show every build are served there instead while this one is withdrawn: the most recent earlier build deployed there that is not withdrawn and fits the location, preferring for an arm the builds it kept before. Null when there is none, so they are shown no paywall there.
     *
     * @return int|null
     */
    public function getServedBuildNumber(): ?int
    {
        return $this->servedBuildNumber;
    }
    /**
     * The build apps that can show every build are served there instead while this one is withdrawn: the most recent earlier build deployed there that is not withdrawn and fits the location, preferring for an arm the builds it kept before. Null when there is none, so they are shown no paywall there.
     *
     * @param int|null $servedBuildNumber
     *
     * @return self
     */
    public function setServedBuildNumber(?int $servedBuildNumber): self
    {
        $this->initialized['servedBuildNumber'] = true;
        $this->servedBuildNumber = $servedBuildNumber;
        return $this;
    }
}