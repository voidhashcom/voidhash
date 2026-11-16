<?php

namespace Voidhash\Generated\Core\Model;

class CustomEventSettingJsonEncoding
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
     * The custom event's name, trimmed.
     *
     * @var string
     */
    protected $eventName;
    /**
     * Whether the project refuses to store the event.
     *
     * @var bool
     */
    protected $isBlocked;
    /**
     * The custom event's name, trimmed.
     *
     * @return string
     */
    public function getEventName(): string
    {
        return $this->eventName;
    }
    /**
     * The custom event's name, trimmed.
     *
     * @param string $eventName
     *
     * @return self
     */
    public function setEventName(string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
        return $this;
    }
    /**
     * Whether the project refuses to store the event.
     *
     * @return bool
     */
    public function getIsBlocked(): bool
    {
        return $this->isBlocked;
    }
    /**
     * Whether the project refuses to store the event.
     *
     * @param bool $isBlocked
     *
     * @return self
     */
    public function setIsBlocked(bool $isBlocked): self
    {
        $this->initialized['isBlocked'] = true;
        $this->isBlocked = $isBlocked;
        return $this;
    }
}