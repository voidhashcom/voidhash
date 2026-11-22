<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentRolloutDifference
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
     * The location, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * The paywall shown there, `pw_...`.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @var string
     */
    protected $environment;
    /**
     * The number of the build the winning arm ran in the experiment.
     *
     * @var int
     */
    protected $testedBuildNumber;
    /**
     * The number of the build the location went on to show: the paywall's deployed build.
     *
     * @var int
     */
    protected $shownBuildNumber;
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
     * The paywall shown there, `pw_...`.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall shown there, `pw_...`.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
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
     * The number of the build the winning arm ran in the experiment.
     *
     * @return int
     */
    public function getTestedBuildNumber(): int
    {
        return $this->testedBuildNumber;
    }
    /**
     * The number of the build the winning arm ran in the experiment.
     *
     * @param int $testedBuildNumber
     *
     * @return self
     */
    public function setTestedBuildNumber(int $testedBuildNumber): self
    {
        $this->initialized['testedBuildNumber'] = true;
        $this->testedBuildNumber = $testedBuildNumber;
        return $this;
    }
    /**
     * The number of the build the location went on to show: the paywall's deployed build.
     *
     * @return int
     */
    public function getShownBuildNumber(): int
    {
        return $this->shownBuildNumber;
    }
    /**
     * The number of the build the location went on to show: the paywall's deployed build.
     *
     * @param int $shownBuildNumber
     *
     * @return self
     */
    public function setShownBuildNumber(int $shownBuildNumber): self
    {
        $this->initialized['shownBuildNumber'] = true;
        $this->shownBuildNumber = $shownBuildNumber;
        return $this;
    }
}