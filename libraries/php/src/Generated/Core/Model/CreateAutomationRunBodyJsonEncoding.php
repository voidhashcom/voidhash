<?php

namespace Voidhash\Generated\Core\Model;

class CreateAutomationRunBodyJsonEncoding
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
     * The person to enroll. Their reentry setting doesn't apply: they enter even if they went through before.
     *
     * @var string
     */
    protected $personId;
    /**
     * An event to start the run with, as the automation's steps read it.
     *
     * @var AutomationEventInput
     */
    protected $event;
    /**
     * Values for the variables the automation declares, by key; a key it doesn't declare is refused.
     *
     * @var array<string, mixed>|null
     */
    protected $inputs;
    /**
     * The person to enroll. Their reentry setting doesn't apply: they enter even if they went through before.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person to enroll. Their reentry setting doesn't apply: they enter even if they went through before.
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
     * An event to start the run with, as the automation's steps read it.
     *
     * @return AutomationEventInput
     */
    public function getEvent(): AutomationEventInput
    {
        return $this->event;
    }
    /**
     * An event to start the run with, as the automation's steps read it.
     *
     * @param AutomationEventInput $event
     *
     * @return self
     */
    public function setEvent(AutomationEventInput $event): self
    {
        $this->initialized['event'] = true;
        $this->event = $event;
        return $this;
    }
    /**
     * Values for the variables the automation declares, by key; a key it doesn't declare is refused.
     *
     * @return array<string, mixed>|null
     */
    public function getInputs(): ?iterable
    {
        return $this->inputs;
    }
    /**
     * Values for the variables the automation declares, by key; a key it doesn't declare is refused.
     *
     * @param array<string, mixed>|null $inputs
     *
     * @return self
     */
    public function setInputs(?iterable $inputs): self
    {
        $this->initialized['inputs'] = true;
        $this->inputs = $inputs;
        return $this;
    }
}