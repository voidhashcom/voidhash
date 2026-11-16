<?php

namespace Voidhash\Generated\Core\Model;

class AutomationContextEvent
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
     * The event's name.
     *
     * @var string
     */
    protected $name;
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $occurredAt;
    /**
     * The event's properties, read as `event.properties.<key>`.
     *
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * The event's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The event's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getOccurredAt(): string
    {
        return $this->occurredAt;
    }
    /**
     * When the event happened, as an ISO 8601 timestamp.
     *
     * @param string $occurredAt
     *
     * @return self
     */
    public function setOccurredAt(string $occurredAt): self
    {
        $this->initialized['occurredAt'] = true;
        $this->occurredAt = $occurredAt;
        return $this;
    }
    /**
     * The event's properties, read as `event.properties.<key>`.
     *
     * @return array<string, mixed>
     */
    public function getProperties(): iterable
    {
        return $this->properties;
    }
    /**
     * The event's properties, read as `event.properties.<key>`.
     *
     * @param array<string, mixed> $properties
     *
     * @return self
     */
    public function setProperties(iterable $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
        return $this;
    }
}