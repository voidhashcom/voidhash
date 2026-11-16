<?php

namespace Voidhash\Generated\Core\Model;

class AutomationTestResultJsonEncodingStepsItem
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
     * The step's id in the definition.
     *
     * @var string
     */
    protected $stepId;
    /**
     * The step's type.
     *
     * @var string
     */
    protected $stepType;
    /**
     * The exit the run would leave by; null when it would stop there.
     *
     * @var string|null
     */
    protected $port;
    /**
     * What the step would send or set, with templates filled in; null for steps that act on nothing.
     *
     * @var array<string, mixed>|null
     */
    protected $action;
    /**
     * How long the step would wait, in seconds; null for steps that don't wait.
     *
     * @var int|null
     */
    protected $waitSeconds;
    /**
     * The event the step would wait for; null for steps that don't.
     *
     * @var string|null
     */
    protected $waitsFor;
    /**
     * Why the step couldn't be decided; null when it could.
     *
     * @var string|null
     */
    protected $problem;
    /**
     * The step's id in the definition.
     *
     * @return string
     */
    public function getStepId(): string
    {
        return $this->stepId;
    }
    /**
     * The step's id in the definition.
     *
     * @param string $stepId
     *
     * @return self
     */
    public function setStepId(string $stepId): self
    {
        $this->initialized['stepId'] = true;
        $this->stepId = $stepId;
        return $this;
    }
    /**
     * The step's type.
     *
     * @return string
     */
    public function getStepType(): string
    {
        return $this->stepType;
    }
    /**
     * The step's type.
     *
     * @param string $stepType
     *
     * @return self
     */
    public function setStepType(string $stepType): self
    {
        $this->initialized['stepType'] = true;
        $this->stepType = $stepType;
        return $this;
    }
    /**
     * The exit the run would leave by; null when it would stop there.
     *
     * @return string|null
     */
    public function getPort(): ?string
    {
        return $this->port;
    }
    /**
     * The exit the run would leave by; null when it would stop there.
     *
     * @param string|null $port
     *
     * @return self
     */
    public function setPort(?string $port): self
    {
        $this->initialized['port'] = true;
        $this->port = $port;
        return $this;
    }
    /**
     * What the step would send or set, with templates filled in; null for steps that act on nothing.
     *
     * @return array<string, mixed>|null
     */
    public function getAction(): ?iterable
    {
        return $this->action;
    }
    /**
     * What the step would send or set, with templates filled in; null for steps that act on nothing.
     *
     * @param array<string, mixed>|null $action
     *
     * @return self
     */
    public function setAction(?iterable $action): self
    {
        $this->initialized['action'] = true;
        $this->action = $action;
        return $this;
    }
    /**
     * How long the step would wait, in seconds; null for steps that don't wait.
     *
     * @return int|null
     */
    public function getWaitSeconds(): ?int
    {
        return $this->waitSeconds;
    }
    /**
     * How long the step would wait, in seconds; null for steps that don't wait.
     *
     * @param int|null $waitSeconds
     *
     * @return self
     */
    public function setWaitSeconds(?int $waitSeconds): self
    {
        $this->initialized['waitSeconds'] = true;
        $this->waitSeconds = $waitSeconds;
        return $this;
    }
    /**
     * The event the step would wait for; null for steps that don't.
     *
     * @return string|null
     */
    public function getWaitsFor(): ?string
    {
        return $this->waitsFor;
    }
    /**
     * The event the step would wait for; null for steps that don't.
     *
     * @param string|null $waitsFor
     *
     * @return self
     */
    public function setWaitsFor(?string $waitsFor): self
    {
        $this->initialized['waitsFor'] = true;
        $this->waitsFor = $waitsFor;
        return $this;
    }
    /**
     * Why the step couldn't be decided; null when it could.
     *
     * @return string|null
     */
    public function getProblem(): ?string
    {
        return $this->problem;
    }
    /**
     * Why the step couldn't be decided; null when it could.
     *
     * @param string|null $problem
     *
     * @return self
     */
    public function setProblem(?string $problem): self
    {
        $this->initialized['problem'] = true;
        $this->problem = $problem;
        return $this;
    }
}