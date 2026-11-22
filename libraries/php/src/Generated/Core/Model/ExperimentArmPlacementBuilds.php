<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentArmPlacementBuilds
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
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @var ExperimentArmBuild
     */
    protected $production;
    /**
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @var ExperimentArmBuild
     */
    protected $test;
    /**
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @return ExperimentArmBuild
     */
    public function getProduction(): ExperimentArmBuild
    {
        return $this->production;
    }
    /**
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @param ExperimentArmBuild $production
     *
     * @return self
     */
    public function setProduction(ExperimentArmBuild $production): self
    {
        $this->initialized['production'] = true;
        $this->production = $production;
        return $this;
    }
    /**
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @return ExperimentArmBuild
     */
    public function getTest(): ExperimentArmBuild
    {
        return $this->test;
    }
    /**
     * The build an arm keeps at a location in one environment, beside the paywall's deployed build.
     *
     * @param ExperimentArmBuild $test
     *
     * @return self
     */
    public function setTest(ExperimentArmBuild $test): self
    {
        $this->initialized['test'] = true;
        $this->test = $test;
        return $this;
    }
}