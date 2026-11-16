<?php

namespace Voidhash\Generated\Core\Model;

class PutFeatureFlagEnvironmentBodyJsonEncoding
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
     * The environment's switch: `false` turns the flag off for everyone there, overrides included.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * End users fixed to an answer, at most 1000; omitted, none.
     *
     * @var list<PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItem>|null
     */
    protected $overrides;
    /**
     * Rules, read in order, at most 20; omitted, none.
     *
     * @var list<PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem>|null
     */
    protected $rules;
    /**
     * What every end user no rule matches gets.
     *
     * @var PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough
     */
    protected $fallthrough;
    /**
     * The environment's switch: `false` turns the flag off for everyone there, overrides included.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * The environment's switch: `false` turns the flag off for everyone there, overrides included.
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
     * End users fixed to an answer, at most 1000; omitted, none.
     *
     * @return list<PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItem>|null
     */
    public function getOverrides(): ?array
    {
        return $this->overrides;
    }
    /**
     * End users fixed to an answer, at most 1000; omitted, none.
     *
     * @param list<PutFeatureFlagEnvironmentBodyJsonEncodingOverridesItem>|null $overrides
     *
     * @return self
     */
    public function setOverrides(?array $overrides): self
    {
        $this->initialized['overrides'] = true;
        $this->overrides = $overrides;
        return $this;
    }
    /**
     * Rules, read in order, at most 20; omitted, none.
     *
     * @return list<PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem>|null
     */
    public function getRules(): ?array
    {
        return $this->rules;
    }
    /**
     * Rules, read in order, at most 20; omitted, none.
     *
     * @param list<PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem>|null $rules
     *
     * @return self
     */
    public function setRules(?array $rules): self
    {
        $this->initialized['rules'] = true;
        $this->rules = $rules;
        return $this;
    }
    /**
     * What every end user no rule matches gets.
     *
     * @return PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough
     */
    public function getFallthrough(): PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough
    {
        return $this->fallthrough;
    }
    /**
     * What every end user no rule matches gets.
     *
     * @param PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough $fallthrough
     *
     * @return self
     */
    public function setFallthrough(PutFeatureFlagEnvironmentBodyJsonEncodingFallthrough $fallthrough): self
    {
        $this->initialized['fallthrough'] = true;
        $this->fallthrough = $fallthrough;
        return $this;
    }
}