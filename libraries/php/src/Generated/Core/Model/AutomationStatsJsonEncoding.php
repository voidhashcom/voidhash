<?php

namespace Voidhash\Generated\Core\Model;

class AutomationStatsJsonEncoding
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
     * People in the automation now, waiting or moving.
     *
     * @var int
     */
    protected $inProgress;
    /**
     * Runs that reached an end.
     *
     * @var int
     */
    protected $completed;
    /**
     * Runs that failed.
     *
     * @var int
     */
    protected $failed;
    /**
     * Runs that were cancelled.
     *
     * @var int
     */
    protected $cancelled;
    /**
     * Runs that ended early, such as on an event the automation exits on.
     *
     * @var int
     */
    protected $exited;
    /**
     * The same counts for each step.
     *
     * @var list<AutomationStatsJsonEncodingStepsItem>
     */
    protected $steps;
    /**
     * People in the automation now, waiting or moving.
     *
     * @return int
     */
    public function getInProgress(): int
    {
        return $this->inProgress;
    }
    /**
     * People in the automation now, waiting or moving.
     *
     * @param int $inProgress
     *
     * @return self
     */
    public function setInProgress(int $inProgress): self
    {
        $this->initialized['inProgress'] = true;
        $this->inProgress = $inProgress;
        return $this;
    }
    /**
     * Runs that reached an end.
     *
     * @return int
     */
    public function getCompleted(): int
    {
        return $this->completed;
    }
    /**
     * Runs that reached an end.
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
     * Runs that failed.
     *
     * @return int
     */
    public function getFailed(): int
    {
        return $this->failed;
    }
    /**
     * Runs that failed.
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
     * Runs that were cancelled.
     *
     * @return int
     */
    public function getCancelled(): int
    {
        return $this->cancelled;
    }
    /**
     * Runs that were cancelled.
     *
     * @param int $cancelled
     *
     * @return self
     */
    public function setCancelled(int $cancelled): self
    {
        $this->initialized['cancelled'] = true;
        $this->cancelled = $cancelled;
        return $this;
    }
    /**
     * Runs that ended early, such as on an event the automation exits on.
     *
     * @return int
     */
    public function getExited(): int
    {
        return $this->exited;
    }
    /**
     * Runs that ended early, such as on an event the automation exits on.
     *
     * @param int $exited
     *
     * @return self
     */
    public function setExited(int $exited): self
    {
        $this->initialized['exited'] = true;
        $this->exited = $exited;
        return $this;
    }
    /**
     * The same counts for each step.
     *
     * @return list<AutomationStatsJsonEncodingStepsItem>
     */
    public function getSteps(): array
    {
        return $this->steps;
    }
    /**
     * The same counts for each step.
     *
     * @param list<AutomationStatsJsonEncodingStepsItem> $steps
     *
     * @return self
     */
    public function setSteps(array $steps): self
    {
        $this->initialized['steps'] = true;
        $this->steps = $steps;
        return $this;
    }
}