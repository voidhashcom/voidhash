<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterface
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
     * @var int
     */
    protected $revision;
    /**
     * @var list<LocationInterfaceInput>
     */
    protected $inputs;
    /**
     * @var list<LocationInterfaceOutput>
     */
    protected $outputs;
    /**
     * @var list<LocationInterfaceOutcome>
     */
    protected $outcomes;
    /**
     * @var list<LocationInterfaceAction>
     */
    protected $actions;
    /**
     * @return int
     */
    public function getRevision(): int
    {
        return $this->revision;
    }
    /**
     * @param int $revision
     *
     * @return self
     */
    public function setRevision(int $revision): self
    {
        $this->initialized['revision'] = true;
        $this->revision = $revision;
        return $this;
    }
    /**
     * @return list<LocationInterfaceInput>
     */
    public function getInputs(): array
    {
        return $this->inputs;
    }
    /**
     * @param list<LocationInterfaceInput> $inputs
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
     * @return list<LocationInterfaceOutput>
     */
    public function getOutputs(): array
    {
        return $this->outputs;
    }
    /**
     * @param list<LocationInterfaceOutput> $outputs
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
     * @return list<LocationInterfaceOutcome>
     */
    public function getOutcomes(): array
    {
        return $this->outcomes;
    }
    /**
     * @param list<LocationInterfaceOutcome> $outcomes
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
     * @return list<LocationInterfaceAction>
     */
    public function getActions(): array
    {
        return $this->actions;
    }
    /**
     * @param list<LocationInterfaceAction> $actions
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