<?php

namespace Voidhash\Generated\Core\Model;

class PutFeatureFlagEnvironmentBodyJsonEncodingRulesItem
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
     * The rule's id, unique in the environment.
     *
     * @var string
     */
    protected $id;
    /**
     * A name for the rule.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The end users the rule names one by one, at most 1000; omitted, none.
     *
     * @var list<FeatureFlagIdentityRef>|null
     */
    protected $identities;
    /**
     * What the rule asks of everyone it does not name, at most 10: it also matches an end user all of these hold for. Omitted or empty, the rule matches only the end users it names.
     *
     * @var list<FeatureFlagConditionInput>|null
     */
    protected $conditions;
    /**
     * @var PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe
     */
    protected $serve;
    /**
     * The rule's id, unique in the environment.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The rule's id, unique in the environment.
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
     * A name for the rule.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * A name for the rule.
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
     * The end users the rule names one by one, at most 1000; omitted, none.
     *
     * @return list<FeatureFlagIdentityRef>|null
     */
    public function getIdentities(): ?array
    {
        return $this->identities;
    }
    /**
     * The end users the rule names one by one, at most 1000; omitted, none.
     *
     * @param list<FeatureFlagIdentityRef>|null $identities
     *
     * @return self
     */
    public function setIdentities(?array $identities): self
    {
        $this->initialized['identities'] = true;
        $this->identities = $identities;
        return $this;
    }
    /**
     * What the rule asks of everyone it does not name, at most 10: it also matches an end user all of these hold for. Omitted or empty, the rule matches only the end users it names.
     *
     * @return list<FeatureFlagConditionInput>|null
     */
    public function getConditions(): ?array
    {
        return $this->conditions;
    }
    /**
     * What the rule asks of everyone it does not name, at most 10: it also matches an end user all of these hold for. Omitted or empty, the rule matches only the end users it names.
     *
     * @param list<FeatureFlagConditionInput>|null $conditions
     *
     * @return self
     */
    public function setConditions(?array $conditions): self
    {
        $this->initialized['conditions'] = true;
        $this->conditions = $conditions;
        return $this;
    }
    /**
     * @return PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe
     */
    public function getServe(): PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe
    {
        return $this->serve;
    }
    /**
     * @param PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe $serve
     *
     * @return self
     */
    public function setServe(PutFeatureFlagEnvironmentBodyJsonEncodingRulesItemServe $serve): self
    {
        $this->initialized['serve'] = true;
        $this->serve = $serve;
        return $this;
    }
}