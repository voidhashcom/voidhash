<?php

namespace Voidhash\Generated\Core\Model;

class ReplacePaywallLocationRulesBodyJsonEncodingRulesItem
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
     * A name for the rule, up to 255 characters.
     *
     * @var string|null
     */
    protected $name;
    /**
     * What the rule asks, 1 to 10 conditions: it matches an end user all of them hold for.
     *
     * @var list<FeatureFlagConditionInput>
     */
    protected $conditions;
    /**
     * The paywall to show them, `pw_...`; it must have a deployed build.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * A name for the rule, up to 255 characters.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * A name for the rule, up to 255 characters.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the rule asks, 1 to 10 conditions: it matches an end user all of them hold for.
     *
     * @return list<FeatureFlagConditionInput>
     */
    public function getConditions(): array
    {
        return $this->conditions;
    }
    /**
     * What the rule asks, 1 to 10 conditions: it matches an end user all of them hold for.
     *
     * @param list<FeatureFlagConditionInput> $conditions
     *
     * @return self
     */
    public function setConditions(array $conditions): self
    {
        $this->initialized['conditions'] = true;
        $this->conditions = $conditions;
        return $this;
    }
    /**
     * The paywall to show them, `pw_...`; it must have a deployed build.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall to show them, `pw_...`; it must have a deployed build.
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
}