<?php

namespace Voidhash\Generated\Core\Model;

class TestAutomationBodyJsonEncoding
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
     * The person to test with; without one, a person with nothing known about them.
     *
     * @var string|null
     */
    protected $personId;
    /**
     * An event to start the run with, as the automation's steps read it.
     *
     * @var AutomationEventInput
     */
    protected $event;
    /**
     * Events to assume happen during waits; a wait for any other event times out.
     *
     * @var list<string>|null
     */
    protected $receivedEvents;
    /**
     * Values for the variables the automation declares, by key: text, numbers or booleans.
     *
     * @var array<string, mixed>|null
     */
    protected $inputs;
    /**
     * Answers to assume, to try a path this person wouldn't take: by a flag's key or an A/B test's id, a variant, an arm, or `on` or `off` for a flag.
     *
     * @var array<string, string>|null
     */
    protected $assumedVariants;
    /**
     * The person to test with; without one, a person with nothing known about them.
     *
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * The person to test with; without one, a person with nothing known about them.
     *
     * @param string|null $personId
     *
     * @return self
     */
    public function setPersonId(?string $personId): self
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
     * Events to assume happen during waits; a wait for any other event times out.
     *
     * @return list<string>|null
     */
    public function getReceivedEvents(): ?array
    {
        return $this->receivedEvents;
    }
    /**
     * Events to assume happen during waits; a wait for any other event times out.
     *
     * @param list<string>|null $receivedEvents
     *
     * @return self
     */
    public function setReceivedEvents(?array $receivedEvents): self
    {
        $this->initialized['receivedEvents'] = true;
        $this->receivedEvents = $receivedEvents;
        return $this;
    }
    /**
     * Values for the variables the automation declares, by key: text, numbers or booleans.
     *
     * @return array<string, mixed>|null
     */
    public function getInputs(): ?iterable
    {
        return $this->inputs;
    }
    /**
     * Values for the variables the automation declares, by key: text, numbers or booleans.
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
    /**
     * Answers to assume, to try a path this person wouldn't take: by a flag's key or an A/B test's id, a variant, an arm, or `on` or `off` for a flag.
     *
     * @return array<string, string>|null
     */
    public function getAssumedVariants(): ?iterable
    {
        return $this->assumedVariants;
    }
    /**
     * Answers to assume, to try a path this person wouldn't take: by a flag's key or an A/B test's id, a variant, an arm, or `on` or `off` for a flag.
     *
     * @param array<string, string>|null $assumedVariants
     *
     * @return self
     */
    public function setAssumedVariants(?iterable $assumedVariants): self
    {
        $this->initialized['assumedVariants'] = true;
        $this->assumedVariants = $assumedVariants;
        return $this;
    }
}