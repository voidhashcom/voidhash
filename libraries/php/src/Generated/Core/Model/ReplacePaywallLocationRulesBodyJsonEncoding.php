<?php

namespace Voidhash\Generated\Core\Model;

class ReplacePaywallLocationRulesBodyJsonEncoding
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
     * Every rule the environment has from now on, in the order they are read, at most 20; an empty list removes them all.
     *
     * @var list<ReplacePaywallLocationRulesBodyJsonEncodingRulesItem>
     */
    protected $rules;
    /**
     * Every rule the environment has from now on, in the order they are read, at most 20; an empty list removes them all.
     *
     * @return list<ReplacePaywallLocationRulesBodyJsonEncodingRulesItem>
     */
    public function getRules(): array
    {
        return $this->rules;
    }
    /**
     * Every rule the environment has from now on, in the order they are read, at most 20; an empty list removes them all.
     *
     * @param list<ReplacePaywallLocationRulesBodyJsonEncodingRulesItem> $rules
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