<?php

namespace Voidhash\Generated\Core\Model;

class AutomationTestResultJsonEncoding
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
     * Whether the person passes the trigger's filter; the walk happens either way.
     *
     * @var bool
     */
    protected $isMatch;
    /**
     * Whether every step could be decided and the walk reached an end; false when a step was invalid or missing.
     *
     * @var bool
     */
    protected $isComplete;
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @var list<AutomationIssue>
     */
    protected $issues;
    /**
     * The steps the run would take, in order.
     *
     * @var list<AutomationTestResultJsonEncodingStepsItem>
     */
    protected $steps;
    /**
     * Whether the person passes the trigger's filter; the walk happens either way.
     *
     * @return bool
     */
    public function getIsMatch(): bool
    {
        return $this->isMatch;
    }
    /**
     * Whether the person passes the trigger's filter; the walk happens either way.
     *
     * @param bool $isMatch
     *
     * @return self
     */
    public function setIsMatch(bool $isMatch): self
    {
        $this->initialized['isMatch'] = true;
        $this->isMatch = $isMatch;
        return $this;
    }
    /**
     * Whether every step could be decided and the walk reached an end; false when a step was invalid or missing.
     *
     * @return bool
     */
    public function getIsComplete(): bool
    {
        return $this->isComplete;
    }
    /**
     * Whether every step could be decided and the walk reached an end; false when a step was invalid or missing.
     *
     * @param bool $isComplete
     *
     * @return self
     */
    public function setIsComplete(bool $isComplete): self
    {
        $this->initialized['isComplete'] = true;
        $this->isComplete = $isComplete;
        return $this;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @return list<AutomationIssue>
     */
    public function getIssues(): array
    {
        return $this->issues;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @param list<AutomationIssue> $issues
     *
     * @return self
     */
    public function setIssues(array $issues): self
    {
        $this->initialized['issues'] = true;
        $this->issues = $issues;
        return $this;
    }
    /**
     * The steps the run would take, in order.
     *
     * @return list<AutomationTestResultJsonEncodingStepsItem>
     */
    public function getSteps(): array
    {
        return $this->steps;
    }
    /**
     * The steps the run would take, in order.
     *
     * @param list<AutomationTestResultJsonEncodingStepsItem> $steps
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