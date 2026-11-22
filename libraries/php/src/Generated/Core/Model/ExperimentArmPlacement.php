<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentArmPlacement
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
     * The paywall location, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * The paywall the arm shows there, `pw_...`; its deployed build is served.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The build the arm shows in each environment. Once the experiment starts, each arm keeps the paywall's build deployed then in each environment; deploying the paywall later changes what it shows everywhere else, not the arm.
     *
     * @var ExperimentArmPlacementBuilds
     */
    protected $builds;
    /**
     * Each change to what the arm shows at this location while the experiment ran, oldest first: a build deployed to it (`experiments.deployVariant`), or, while it was paused, another paywall given to it. Results count everyone in the arm across them.
     *
     * @var list<ExperimentArmBuildChange>
     */
    protected $buildChanges;
    /**
     * The paywall location, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The paywall location, `pw_loc_...`.
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
     * The paywall the arm shows there, `pw_...`; its deployed build is served.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall the arm shows there, `pw_...`; its deployed build is served.
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
     * The build the arm shows in each environment. Once the experiment starts, each arm keeps the paywall's build deployed then in each environment; deploying the paywall later changes what it shows everywhere else, not the arm.
     *
     * @return ExperimentArmPlacementBuilds
     */
    public function getBuilds(): ExperimentArmPlacementBuilds
    {
        return $this->builds;
    }
    /**
     * The build the arm shows in each environment. Once the experiment starts, each arm keeps the paywall's build deployed then in each environment; deploying the paywall later changes what it shows everywhere else, not the arm.
     *
     * @param ExperimentArmPlacementBuilds $builds
     *
     * @return self
     */
    public function setBuilds(ExperimentArmPlacementBuilds $builds): self
    {
        $this->initialized['builds'] = true;
        $this->builds = $builds;
        return $this;
    }
    /**
     * Each change to what the arm shows at this location while the experiment ran, oldest first: a build deployed to it (`experiments.deployVariant`), or, while it was paused, another paywall given to it. Results count everyone in the arm across them.
     *
     * @return list<ExperimentArmBuildChange>
     */
    public function getBuildChanges(): array
    {
        return $this->buildChanges;
    }
    /**
     * Each change to what the arm shows at this location while the experiment ran, oldest first: a build deployed to it (`experiments.deployVariant`), or, while it was paused, another paywall given to it. Results count everyone in the arm across them.
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