<?php

namespace Voidhash\Generated\Core\Model;

class AutomationRunWithStepsJsonEncoding
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
     * The run's id, `auto_run_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the run belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The automation the run goes through.
     *
     * @var string
     */
    protected $automationId;
    /**
     * The version the run follows, the one active when it started.
     *
     * @var string
     */
    protected $versionId;
    /**
     * The person going through the automation.
     *
     * @var string
     */
    protected $personId;
    /**
     * `queued` to move on, `running`, `waiting` on a wait step, `paused` with its automation, or finished: `completed`, `failed`, `cancelled`, or `exited` early, such as on an event the automation exits on.
     *
     * @var string
     */
    protected $status;
    /**
     * The id of the step the run is at; null once it finished.
     *
     * @var string|null
     */
    protected $currentStepId;
    /**
     * The event a wait step is listening for; null when not waiting for one.
     *
     * @var string|null
     */
    protected $waitingForEvent;
    /**
     * When the run next moves unless an event wakes it first, as an ISO 8601 timestamp; null when nothing is scheduled.
     *
     * @var string|null
     */
    protected $nextAt;
    /**
     * Why the run failed, was cancelled or exited early; null when nothing went wrong.
     *
     * @var string|null
     */
    protected $lastError;
    /**
     * The event that started a run.
     *
     * @var AutomationContextEvent
     */
    protected $event;
    /**
     * The values the run keeps, by key, as `vars.<key>` reads them.
     *
     * @var array<string, mixed>
     */
    protected $variables;
    /**
     * When the run was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the run finished, as an ISO 8601 timestamp; null while it goes on.
     *
     * @var string|null
     */
    protected $finishedAt;
    /**
     * What happened at each step the run reached, in order.
     *
     * @var list<AutomationRunStepJsonEncoding>
     */
    protected $steps;
    /**
     * The run's id, `auto_run_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The run's id, `auto_run_...`.
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
     * The project the run belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the run belongs to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The automation the run goes through.
     *
     * @return string
     */
    public function getAutomationId(): string
    {
        return $this->automationId;
    }
    /**
     * The automation the run goes through.
     *
     * @param string $automationId
     *
     * @return self
     */
    public function setAutomationId(string $automationId): self
    {
        $this->initialized['automationId'] = true;
        $this->automationId = $automationId;
        return $this;
    }
    /**
     * The version the run follows, the one active when it started.
     *
     * @return string
     */
    public function getVersionId(): string
    {
        return $this->versionId;
    }
    /**
     * The version the run follows, the one active when it started.
     *
     * @param string $versionId
     *
     * @return self
     */
    public function setVersionId(string $versionId): self
    {
        $this->initialized['versionId'] = true;
        $this->versionId = $versionId;
        return $this;
    }
    /**
     * The person going through the automation.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person going through the automation.
     *
     * @param string $personId
     *
     * @return self
     */
    public function setPersonId(string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * `queued` to move on, `running`, `waiting` on a wait step, `paused` with its automation, or finished: `completed`, `failed`, `cancelled`, or `exited` early, such as on an event the automation exits on.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `queued` to move on, `running`, `waiting` on a wait step, `paused` with its automation, or finished: `completed`, `failed`, `cancelled`, or `exited` early, such as on an event the automation exits on.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * The id of the step the run is at; null once it finished.
     *
     * @return string|null
     */
    public function getCurrentStepId(): ?string
    {
        return $this->currentStepId;
    }
    /**
     * The id of the step the run is at; null once it finished.
     *
     * @param string|null $currentStepId
     *
     * @return self
     */
    public function setCurrentStepId(?string $currentStepId): self
    {
        $this->initialized['currentStepId'] = true;
        $this->currentStepId = $currentStepId;
        return $this;
    }
    /**
     * The event a wait step is listening for; null when not waiting for one.
     *
     * @return string|null
     */
    public function getWaitingForEvent(): ?string
    {
        return $this->waitingForEvent;
    }
    /**
     * The event a wait step is listening for; null when not waiting for one.
     *
     * @param string|null $waitingForEvent
     *
     * @return self
     */
    public function setWaitingForEvent(?string $waitingForEvent): self
    {
        $this->initialized['waitingForEvent'] = true;
        $this->waitingForEvent = $waitingForEvent;
        return $this;
    }
    /**
     * When the run next moves unless an event wakes it first, as an ISO 8601 timestamp; null when nothing is scheduled.
     *
     * @return string|null
     */
    public function getNextAt(): ?string
    {
        return $this->nextAt;
    }
    /**
     * When the run next moves unless an event wakes it first, as an ISO 8601 timestamp; null when nothing is scheduled.
     *
     * @param string|null $nextAt
     *
     * @return self
     */
    public function setNextAt(?string $nextAt): self
    {
        $this->initialized['nextAt'] = true;
        $this->nextAt = $nextAt;
        return $this;
    }
    /**
     * Why the run failed, was cancelled or exited early; null when nothing went wrong.
     *
     * @return string|null
     */
    public function getLastError(): ?string
    {
        return $this->lastError;
    }
    /**
     * Why the run failed, was cancelled or exited early; null when nothing went wrong.
     *
     * @param string|null $lastError
     *
     * @return self
     */
    public function setLastError(?string $lastError): self
    {
        $this->initialized['lastError'] = true;
        $this->lastError = $lastError;
        return $this;
    }
    /**
     * The event that started a run.
     *
     * @return AutomationContextEvent
     */
    public function getEvent(): AutomationContextEvent
    {
        return $this->event;
    }
    /**
     * The event that started a run.
     *
     * @param AutomationContextEvent $event
     *
     * @return self
     */
    public function setEvent(AutomationContextEvent $event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * The values the run keeps, by key, as `vars.<key>` reads them.
     *
     * @return array<string, mixed>
     */
    public function getVariables(): iterable
    {
        return $this->variables;
    }
    /**
     * The values the run keeps, by key, as `vars.<key>` reads them.
     *
     * @param array<string, mixed> $variables
     *
     * @return self
     */
    public function setVariables(iterable $variables): self
    {
        $this->initialized['variables'] = true;
        $this->variables = $variables;
        return $this;
    }
    /**
     * When the run was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the run was created, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the run finished, as an ISO 8601 timestamp; null while it goes on.
     *
     * @return string|null
     */
    public function getFinishedAt(): ?string
    {
        return $this->finishedAt;
    }
    /**
     * When the run finished, as an ISO 8601 timestamp; null while it goes on.
     *
     * @param string|null $finishedAt
     *
     * @return self
     */
    public function setFinishedAt(?string $finishedAt): self
    {
        $this->initialized['finishedAt'] = true;
        $this->finishedAt = $finishedAt;
        return $this;
    }
    /**
     * What happened at each step the run reached, in order.
     *
     * @return list<AutomationRunStepJsonEncoding>
     */
    public function getSteps(): array
    {
        return $this->steps;
    }
    /**
     * What happened at each step the run reached, in order.
     *
     * @param list<AutomationRunStepJsonEncoding> $steps
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