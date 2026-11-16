<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEnvironmentJsonEncoding
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
     * The environment's switch. While false, the flag is off for everyone there, overrides included.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * End users fixed to an answer, read before the rules.
     *
     * @var list<FeatureFlagEnvironmentOverrideJsonEncoding>
     */
    protected $overrides;
    /**
     * Rules, read in order; the first that matches an end user decides.
     *
     * @var list<FeatureFlagRuleJsonEncoding>
     */
    protected $rules;
    /**
     * @var FeatureFlagServeJsonEncoding
     */
    protected $fallthrough;
    /**
     * The environment's switch. While false, the flag is off for everyone there, overrides included.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * The environment's switch. While false, the flag is off for everyone there, overrides included.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * End users fixed to an answer, read before the rules.
     *
     * @return list<FeatureFlagEnvironmentOverrideJsonEncoding>
     */
    public function getOverrides(): array
    {
        return $this->overrides;
    }
    /**
     * End users fixed to an answer, read before the rules.
     *
     * @param list<FeatureFlagEnvironmentOverrideJsonEncoding> $overrides
     *
     * @return self
     */
    public function setOverrides(array $overrides): self
    {
        $this->initialized['overrides'] = true;
        $this->overrides = $overrides;
        return $this;
    }
    /**
     * Rules, read in order; the first that matches an end user decides.
     *
     * @return list<FeatureFlagRuleJsonEncoding>
     */
    public function getRules(): array
    {
        return $this->rules;
    }
    /**
     * Rules, read in order; the first that matches an end user decides.
     *
     * @param list<FeatureFlagRuleJsonEncoding> $rules
     *
     * @return self
     */
    public function setRules(array $rules): self
    {
        $this->initialized['rules'] = true;
        $this->rules = $rules;
        return $this;
    }
    /**
     * @return FeatureFlagServeJsonEncoding
     */
    public function getFallthrough(): FeatureFlagServeJsonEncoding
    {
        return $this->fallthrough;
    }
    /**
     * @param FeatureFlagServeJsonEncoding $fallthrough
     *
     * @return self
     */
    public function setFallthrough(FeatureFlagServeJsonEncoding $fallthrough): self
    {
        $this->initialized['fallthrough'] = true;
        $this->fallthrough = $fallthrough;
        return $this;
    }
}