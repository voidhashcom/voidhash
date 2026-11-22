<?php

namespace Voidhash\Generated\Core\Model;

class PaywallBuildTestArm
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
     * The experiment, `exp_...`.
     *
     * @var string
     */
    protected $experimentId;
    /**
     * The experiment's name.
     *
     * @var string
     */
    protected $experimentName;
    /**
     * Whether the experiment is paused, showing everyone its control arm.
     *
     * @var bool
     */
    protected $isPaused;
    /**
     * The arm, `exp_var_...`.
     *
     * @var string
     */
    protected $variantId;
    /**
     * The arm's name.
     *
     * @var string
     */
    protected $variantName;
    /**
     * The location the arm shows the paywall at, `pw_loc_...`.
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
     * The environment: `production`, or `test`, which a test key reads.
     *
     * @var string
     */
    protected $environment;
    /**
     * The number of the build the arm keeps there whatever is deployed; null for an arm of an experiment started before arms kept their build, which shows the paywall's deployed build.
     *
     * @var int|null
     */
    protected $keptBuildNumber;
    /**
     * The experiment, `exp_...`.
     *
     * @return string
     */
    public function getExperimentId(): string
    {
        return $this->experimentId;
    }
    /**
     * The experiment, `exp_...`.
     *
     * @param string $experimentId
     *
     * @return self
     */
    public function setExperimentId(string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * The experiment's name.
     *
     * @return string
     */
    public function getExperimentName(): string
    {
        return $this->experimentName;
    }
    /**
     * The experiment's name.
     *
     * @param string $experimentName
     *
     * @return self
     */
    public function setExperimentName(string $experimentName): self
    {
        $this->initialized['experimentName'] = true;
        $this->experimentName = $experimentName;
        return $this;
    }
    /**
     * Whether the experiment is paused, showing everyone its control arm.
     *
     * @return bool
     */
    public function getIsPaused(): bool
    {
        return $this->isPaused;
    }
    /**
     * Whether the experiment is paused, showing everyone its control arm.
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
     * The arm, `exp_var_...`.
     *
     * @return string
     */
    public function getVariantId(): string
    {
        return $this->variantId;
    }
    /**
     * The arm, `exp_var_...`.
     *
     * @param string $variantId
     *
     * @return self
     */
    public function setVariantId(string $variantId): self
    {
        $this->initialized['variantId'] = true;
        $this->variantId = $variantId;
        return $this;
    }
    /**
     * The arm's name.
     *
     * @return string
     */
    public function getVariantName(): string
    {
        return $this->variantName;
    }
    /**
     * The arm's name.
     *
     * @param string $variantName
     *
     * @return self
     */
    public function setVariantName(string $variantName): self
    {
        $this->initialized['variantName'] = true;
        $this->variantName = $variantName;
        return $this;
    }
    /**
     * The location the arm shows the paywall at, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location the arm shows the paywall at, `pw_loc_...`.
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
     * The environment: `production`, or `test`, which a test key reads.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads.
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
     * The number of the build the arm keeps there whatever is deployed; null for an arm of an experiment started before arms kept their build, which shows the paywall's deployed build.
     *
     * @return int|null
     */
    public function getKeptBuildNumber(): ?int
    {
        return $this->keptBuildNumber;
    }
    /**
     * The number of the build the arm keeps there whatever is deployed; null for an arm of an experiment started before arms kept their build, which shows the paywall's deployed build.
     *
     * @param int|null $keptBuildNumber
     *
     * @return self
     */
    public function setKeptBuildNumber(?int $keptBuildNumber): self
    {
        $this->initialized['keptBuildNumber'] = true;
        $this->keptBuildNumber = $keptBuildNumber;
        return $this;
    }
}