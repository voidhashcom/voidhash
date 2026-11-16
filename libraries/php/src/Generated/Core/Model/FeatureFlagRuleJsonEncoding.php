<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagRuleJsonEncoding
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
     * The rule's id, unique in the environment; an evaluation names it as `ruleId`.
     *
     * @var string
     */
    protected $id;
    /**
     * A name for the rule; null when it has none.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The end users the rule names one by one.
     *
     * @var list<FeatureFlagIdentityRef>
     */
    protected $identities;
    /**
     * What the rule asks of everyone else: it also matches an end user all of these hold for. Empty, the rule matches only the end users it names.
     *
     * @var list<FeatureFlagConditionJsonEncoding>
     */
    protected $conditions;
    /**
     * @var FeatureFlagServeJsonEncoding
     */
    protected $serve;
    /**
     * The rule's id, unique in the environment; an evaluation names it as `ruleId`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The rule's id, unique in the environment; an evaluation names it as `ruleId`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * A name for the rule; null when it has none.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * A name for the rule; null when it has none.
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
     * The end users the rule names one by one.
     *
     * @return list<FeatureFlagIdentityRef>
     */
    public function getIdentities(): array
    {
        return $this->identities;
    }
    /**
     * The end users the rule names one by one.
     *
     * @param list<FeatureFlagIdentityRef> $identities
     *
     * @return self
     */
    public function setIdentities(array $identities): self
    {
        $this->initialized['identities'] = true;
        $this->identities = $identities;
        return $this;
    }
    /**
     * What the rule asks of everyone else: it also matches an end user all of these hold for. Empty, the rule matches only the end users it names.
     *
     * @return list<FeatureFlagConditionJsonEncoding>
     */
    public function getConditions(): array
    {
        return $this->conditions;
    }
    /**
     * What the rule asks of everyone else: it also matches an end user all of these hold for. Empty, the rule matches only the end users it names.
     *
     * @param list<FeatureFlagConditionJsonEncoding> $conditions
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
     * @return FeatureFlagServeJsonEncoding
     */
    public function getServe(): FeatureFlagServeJsonEncoding
    {
        return $this->serve;
    }
    /**
     * @param FeatureFlagServeJsonEncoding $serve
     *
     * @return self
     */
    public function setServe(FeatureFlagServeJsonEncoding $serve): self
    {
        $this->initialized['serve'] = true;
        $this->serve = $serve;
        return $this;
    }
}