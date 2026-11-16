<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationRuleJsonEncoding
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
     * The rule's id, `pw_loc_rule_...`. Replacing the rules gives each a new one.
     *
     * @var string
     */
    protected $id;
    /**
     * The location the rule is at, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @var string
     */
    protected $environment;
    /**
     * Where the rule is read among its environment's rules, from 0.
     *
     * @var int
     */
    protected $position;
    /**
     * A name for the rule; null when it has none.
     *
     * @var string|null
     */
    protected $name;
    /**
     * What the rule asks of an end user and their app, as a feature flag's rule does: it matches when all of these hold.
     *
     * @var list<FeatureFlagConditionJsonEncoding>
     */
    protected $conditions;
    /**
     * The paywall the end users it matches are shown, `pw_...`: its deployed build.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The rule's id, `pw_loc_rule_...`. Replacing the rules gives each a new one.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The rule's id, `pw_loc_rule_...`. Replacing the rules gives each a new one.
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
     * The location the rule is at, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location the rule is at, `pw_loc_...`.
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
    /**
     * Where the rule is read among its environment's rules, from 0.
     *
     * @return int
     */
    public function getPosition(): int
    {
        return $this->position;
    }
    /**
     * Where the rule is read among its environment's rules, from 0.
     *
     * @param int $position
     *
     * @return self
     */
    public function setPosition(int $position): self
    {
        $this->initialized['position'] = true;
        $this->position = $position;
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
     * What the rule asks of an end user and their app, as a feature flag's rule does: it matches when all of these hold.
     *
     * @return list<FeatureFlagConditionJsonEncoding>
     */
    public function getConditions(): array
    {
        return $this->conditions;
    }
    /**
     * What the rule asks of an end user and their app, as a feature flag's rule does: it matches when all of these hold.
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
     * The paywall the end users it matches are shown, `pw_...`: its deployed build.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall the end users it matches are shown, `pw_...`: its deployed build.
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