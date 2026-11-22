<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentArmStoppedPlacement
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
     * The paywall the arm last showed there, `pw_...`.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * Each change to what the arm showed there while the experiment ran, oldest first, the last one to no paywall.
     *
     * @var list<ExperimentArmBuildChange>
     */
    protected $buildChanges;
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
     * The paywall the arm last showed there, `pw_...`.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall the arm last showed there, `pw_...`.
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
     * Each change to what the arm showed there while the experiment ran, oldest first, the last one to no paywall.
     *
     * @return list<ExperimentArmBuildChange>
     */
    public function getBuildChanges(): array
    {
        return $this->buildChanges;
    }
    /**
     * Each change to what the arm showed there while the experiment ran, oldest first, the last one to no paywall.
     *
     * @param list<ExperimentArmBuildChange> $buildChanges
     *
     * @return self
     */
    public function setBuildChanges(array $buildChanges): self
    {
        $this->initialized['buildChanges'] = true;
        $this->buildChanges = $buildChanges;
        return $this;
    }
}