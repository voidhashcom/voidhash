<?php

namespace Voidhash\Generated\Core\Model;

class UpsertCustomEventBodyJsonEncoding
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
     * Whether the project refuses to store the event.
     *
     * @var bool
     */
    protected $isBlocked;
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