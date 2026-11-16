<?php

namespace Voidhash\Generated\Core\Model;

class AutomationEventInput
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