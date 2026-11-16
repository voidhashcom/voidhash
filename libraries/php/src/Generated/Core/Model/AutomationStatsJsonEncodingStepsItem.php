<?php

namespace Voidhash\Generated\Core\Model;

class AutomationStatsJsonEncodingStepsItem
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
     * Runs that reached the step.
     *
     * @var int
     */
    protected $entered;
    /**
     * Runs that completed the step.
     *
     * @var int
     */
    protected $completed;
    /**
     * Runs that failed at the step.
     *
     * @var int
     */
    protected $failed;
    /**
     * Runs waiting at the step now.
     *
     * @var int
     */
    protected $waiting;
    /**
     * How many left by each exit, which is how a split or an A/B test divided people.
     *
     * @var list<AutomationStatsJsonEncodingStepsItemPortsItem>
     */
    protected $ports;
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
     * Runs that reached the step.
     *
     * @return int
     */
    public function getEntered(): int
    {
        return $this->entered;
    }
    /**
     * Runs that reached the step.
     *
     * @param int $entered
     *
     * @return self
     */
    public function setEntered(int $entered): self
    {
        $this->initialized['entered'] = true;
        $this->entered = $entered;
        return $this;
    }
    /**
     * Runs that completed the step.
     *
     * @return int
     */
    public function getCompleted(): int
    {
        return $this->completed;
    }
    /**
     * Runs that completed the step.
     *
     * @param int $completed
     *
     * @return self
     */
    public function setCompleted(int $completed): self
    {
        $this->initialized['completed'] = true;
        $this->completed = $completed;
        return $this;
    }
    /**
     * Runs that failed at the step.
     *
     * @return int
     */
    public function getFailed(): int
    {
        return $this->failed;
    }
    /**
     * Runs that failed at the step.
     *
     * @param int $failed
     *
     * @return self
     */
    public function setFailed(int $failed): self
    {
        $this->initialized['failed'] = true;
        $this->failed = $failed;
        return $this;
    }
    /**
     * Runs waiting at the step now.
     *
     * @return int
     */
    public function getWaiting(): int
    {
        return $this->waiting;
    }
    /**
     * Runs waiting at the step now.
     *
     * @param int $waiting
     *
     * @return self
     */
    public function setWaiting(int $waiting): self
    {
        $this->initialized['waiting'] = true;
        $this->waiting = $waiting;
        return $this;
    }
    /**
     * How many left by each exit, which is how a split or an A/B test divided people.
     *
     * @return list<AutomationStatsJsonEncodingStepsItemPortsItem>
     */
    public function getPorts(): array
    {
        return $this->ports;
    }
    /**
     * How many left by each exit, which is how a split or an A/B test divided people.
     *
     * @param list<AutomationStatsJsonEncodingStepsItemPortsItem> $ports
     *
     * @return self
     */
    public function setPorts(array $ports): self
    {
        $this->initialized['ports'] = true;
        $this->ports = $ports;
        return $this;
    }
}