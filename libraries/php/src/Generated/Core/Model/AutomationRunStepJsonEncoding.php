<?php

namespace Voidhash\Generated\Core\Model;

class AutomationRunStepJsonEncoding
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
     * The id of this record of the step, `auto_step_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The id of the step in the definition.
     *
     * @var string
     */
    protected $stepId;
    /**
     * The step's type, such as `send_push` or `wait_for_event`.
     *
     * @var string
     */
    protected $stepType;
    /**
     * How the step stands: `running`, `waiting`, `completed` or `failed`.
     *
     * @var string
     */
    protected $status;
    /**
     * The exit the run left the step by; null until it left.
     *
     * @var string|null
     */
    protected $port;
    /**
     * What the step found out, which later steps read as `steps.<step>.<key>`; null when it found out nothing.
     *
     * @var array<string, mixed>|null
     */
    protected $output;
    /**
     * Why the step failed; null unless it did.
     *
     * @var string|null
     */
    protected $error;
    /**
     * When the run reached the step, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startedAt;
    /**
     * When the step finished, as an ISO 8601 timestamp; null while it goes on.
     *
     * @var string|null
     */
    protected $finishedAt;
    /**
     * The id of this record of the step, `auto_step_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The id of this record of the step, `auto_step_...`.
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
     * The id of the step in the definition.
     *
     * @return string
     */
    public function getStepId(): string
    {
        return $this->stepId;
    }
    /**
     * The id of the step in the definition.
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
     * The step's type, such as `send_push` or `wait_for_event`.
     *
     * @return string
     */
    public function getStepType(): string
    {
        return $this->stepType;
    }
    /**
     * The step's type, such as `send_push` or `wait_for_event`.
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
     * How the step stands: `running`, `waiting`, `completed` or `failed`.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * How the step stands: `running`, `waiting`, `completed` or `failed`.
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
     * The exit the run left the step by; null until it left.
     *
     * @return string|null
     */
    public function getPort(): ?string
    {
        return $this->port;
    }
    /**
     * The exit the run left the step by; null until it left.
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
     * What the step found out, which later steps read as `steps.<step>.<key>`; null when it found out nothing.
     *
     * @return array<string, mixed>|null
     */
    public function getOutput(): ?iterable
    {
        return $this->output;
    }
    /**
     * What the step found out, which later steps read as `steps.<step>.<key>`; null when it found out nothing.
     *
     * @param array<string, mixed>|null $output
     *
     * @return self
     */
    public function setOutput(?iterable $output): self
    {
        $this->initialized['output'] = true;
        $this->output = $output;
        return $this;
    }
    /**
     * Why the step failed; null unless it did.
     *
     * @return string|null
     */
    public function getError(): ?string
    {
        return $this->error;
    }
    /**
     * Why the step failed; null unless it did.
     *
     * @param string|null $error
     *
     * @return self
     */
    public function setError(?string $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
    /**
     * When the run reached the step, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartedAt(): string
    {
        return $this->startedAt;
    }
    /**
     * When the run reached the step, as an ISO 8601 timestamp.
     *
     * @param string $startedAt
     *
     * @return self
     */
    public function setStartedAt(string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
        return $this;
    }
    /**
     * When the step finished, as an ISO 8601 timestamp; null while it goes on.
     *
     * @return string|null
     */
    public function getFinishedAt(): ?string
    {
        return $this->finishedAt;
    }
    /**
     * When the step finished, as an ISO 8601 timestamp; null while it goes on.
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
}