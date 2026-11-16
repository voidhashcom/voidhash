<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsGroupPersonJsonEncoding
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
     * The person's id, `person_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * Their name; null without one.
     *
     * @var string|null
     */
    protected $name;
    /**
     * Their email; null without one.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The distinct id they were identified with; null while anonymous.
     *
     * @var string|null
     */
    protected $distinctId;
    /**
     * How many of their events named the group in those days.
     *
     * @var int
     */
    protected $eventCount;
    /**
     * Their latest event with the group, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $lastSeenAt;
    /**
     * The person's id, `person_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The person's id, `person_...`.
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
     * Their name; null without one.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * Their name; null without one.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Their email; null without one.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * Their email; null without one.
     *
     * @param string|null $email
     *
     * @return self
     */
    public function setEmail(?string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * The distinct id they were identified with; null while anonymous.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id they were identified with; null while anonymous.
     *
     * @param string|null $distinctId
     *
     * @return self
     */
    public function setDistinctId(?string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * How many of their events named the group in those days.
     *
     * @return int
     */
    public function getEventCount(): int
    {
        return $this->eventCount;
    }
    /**
     * How many of their events named the group in those days.
     *
     * @param int $eventCount
     *
     * @return self
     */
    public function setEventCount(int $eventCount): self
    {
        $this->initialized['eventCount'] = true;
        $this->eventCount = $eventCount;
        return $this;
    }
    /**
     * Their latest event with the group, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getLastSeenAt(): string
    {
        return $this->lastSeenAt;
    }
    /**
     * Their latest event with the group, as an ISO 8601 timestamp.
     *
     * @param string $lastSeenAt
     *
     * @return self
     */
    public function setLastSeenAt(string $lastSeenAt): self
    {
        $this->initialized['lastSeenAt'] = true;
        $this->lastSeenAt = $lastSeenAt;
        return $this;
    }
}