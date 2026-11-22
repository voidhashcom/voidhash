<?php

namespace Voidhash\Generated\Core\Model;

class DeployExperimentVariantBodyJsonEncoding
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
     * The location the arm shows the paywall at, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * A ready build of the paywall the arm shows there, `pw_build_...`, deployed to each environment named before; normally the paywall's deployed build.
     *
     * @var string
     */
    protected $buildId;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @var string
     */
    protected $environment;
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
     * A ready build of the paywall the arm shows there, `pw_build_...`, deployed to each environment named before; normally the paywall's deployed build.
     *
     * @return string
     */
    public function getBuildId(): string
    {
        return $this->buildId;
    }
    /**
     * A ready build of the paywall the arm shows there, `pw_build_...`, deployed to each environment named before; normally the paywall's deployed build.
     *
     * @param string $buildId
     *
     * @return self
     */
    public function setBuildId(string $buildId): self
    {
        $this->initialized['buildId'] = true;
        $this->buildId = $buildId;
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
}