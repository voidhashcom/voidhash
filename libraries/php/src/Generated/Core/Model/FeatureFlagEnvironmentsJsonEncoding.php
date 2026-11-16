<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEnvironmentsJsonEncoding
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
     * @var FeatureFlagEnvironmentJsonEncoding
     */
    protected $production;
    /**
     * @var FeatureFlagEnvironmentJsonEncoding
     */
    protected $test;
    /**
     * @return FeatureFlagEnvironmentJsonEncoding
     */
    public function getProduction(): FeatureFlagEnvironmentJsonEncoding
    {
        return $this->production;
    }
    /**
     * @param FeatureFlagEnvironmentJsonEncoding $production
     *
     * @return self
     */
    public function setProduction(FeatureFlagEnvironmentJsonEncoding $production): self
    {
        $this->initialized['production'] = true;
        $this->production = $production;
        return $this;
    }
    /**
     * @return FeatureFlagEnvironmentJsonEncoding
     */
    public function getTest(): FeatureFlagEnvironmentJsonEncoding
    {
        return $this->test;
    }
    /**
     * @param FeatureFlagEnvironmentJsonEncoding $test
     *
     * @return self
     */
    public function setTest(FeatureFlagEnvironmentJsonEncoding $test): self
    {
        $this->initialized['test'] = true;
        $this->test = $test;
        return $this;
    }
}