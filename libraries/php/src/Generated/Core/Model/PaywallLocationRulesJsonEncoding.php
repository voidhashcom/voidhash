<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationRulesJsonEncoding
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
     * The environment's rules, in the order they are read.
     *
     * @var list<PaywallLocationRuleJsonEncoding>
     */
    protected $rules;
    /**
     * The environment's rules, in the order they are read.
     *
     * @return list<PaywallLocationRuleJsonEncoding>
     */
    public function getRules(): array
    {
        return $this->rules;
    }
    /**
     * The environment's rules, in the order they are read.
     *
     * @param list<PaywallLocationRuleJsonEncoding> $rules
     *
     * @return self
     */
    public function setRules(array $rules): self
    {
        $this->initialized['rules'] = true;
        $this->rules = $rules;
        return $this;
    }
}