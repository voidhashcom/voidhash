<?php

namespace Voidhash\Generated\Core\Model;

class SdkVersionSeen
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
     * The SDK that sent events; null when events did not name one.
     *
     * @var string|null
     */
    protected $sdk;
    /**
     * The SDK version; null when events did not report one.
     *
     * @var string|null
     */
    protected $version;
    /**
     * Events it sent in the last seven days.
     *
     * @var int
     */
    protected $events;
    /**
     * When it last sent an event, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $lastEventAt;
    /**
     * The SDK that sent events; null when events did not name one.
     *
     * @return string|null
     */
    public function getSdk(): ?string
    {
        return $this->sdk;
    }
    /**
     * The SDK that sent events; null when events did not name one.
     *
     * @param string|null $sdk
     *
     * @return self
     */
    public function setSdk(?string $sdk): self
    {
        $this->initialized['sdk'] = true;
        $this->sdk = $sdk;
        return $this;
    }
    /**
     * The SDK version; null when events did not report one.
     *
     * @return string|null
     */
    public function getVersion(): ?string
    {
        return $this->version;
    }
    /**
     * The SDK version; null when events did not report one.
     *
     * @param string|null $version
     *
     * @return self
     */
    public function setVersion(?string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * Events it sent in the last seven days.
     *
     * @return int
     */
    public function getEvents(): int
    {
        return $this->events;
    }
    /**
     * Events it sent in the last seven days.
     *
     * @param int $events
     *
     * @return self
     */
    public function setEvents(int $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * When it last sent an event, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getLastEventAt(): string
    {
        return $this->lastEventAt;
    }
    /**
     * When it last sent an event, as an ISO 8601 timestamp.
     *
     * @param string $lastEventAt
     *
     * @return self
     */
    public function setLastEventAt(string $lastEventAt): self
    {
        $this->initialized['lastEventAt'] = true;
        $this->lastEventAt = $lastEventAt;
        return $this;
    }
}