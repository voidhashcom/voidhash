<?php

namespace Voidhash\Generated\Core\Model;

class SetPaywallLocationInterfaceBody
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
     * @var list<LocationInterfaceInputDraft>
     */
    protected $inputs;
    /**
     * @var list<LocationInterfaceOutputDraft>
     */
    protected $outputs;
    /**
     * @var list<LocationInterfaceOutcomeDraft>
     */
    protected $outcomes;
    /**
     * @var list<LocationInterfaceActionDraft>
     */
    protected $actions;
    /**
     * @return list<LocationInterfaceInputDraft>
     */
    public function getInputs(): array
    {
        return $this->inputs;
    }
    /**
     * @param list<LocationInterfaceInputDraft> $inputs
     *
     * @return self
     */
    public function setInputs(array $inputs): self
    {
        $this->initialized['inputs'] = true;
        $this->inputs = $inputs;
        return $this;
    }
    /**
     * @return list<LocationInterfaceOutputDraft>
     */
    public function getOutputs(): array
    {
        return $this->outputs;
    }
    /**
     * @param list<LocationInterfaceOutputDraft> $outputs
     *
     * @return self
     */
    public function setOutputs(array $outputs): self
    {
        $this->initialized['outputs'] = true;
        $this->outputs = $outputs;
        return $this;
    }
    /**
     * @return list<LocationInterfaceOutcomeDraft>
     */
    public function getOutcomes(): array
    {
        return $this->outcomes;
    }
    /**
     * @param list<LocationInterfaceOutcomeDraft> $outcomes
     *
     * @return self
     */
    public function setOutcomes(array $outcomes): self
    {
        $this->initialized['outcomes'] = true;
        $this->outcomes = $outcomes;
        return $this;
    }
    /**
     * @return list<LocationInterfaceActionDraft>
     */
    public function getActions(): array
    {
        return $this->actions;
    }
    /**
     * @param list<LocationInterfaceActionDraft> $actions
     *
     * @return self
     */
    public function setActions(array $actions): self
    {
        $this->initialized['actions'] = true;
        $this->actions = $actions;
        return $this;
    }
}