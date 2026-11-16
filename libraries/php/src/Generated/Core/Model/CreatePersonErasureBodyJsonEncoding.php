<?php

namespace Voidhash\Generated\Core\Model;

class CreatePersonErasureBodyJsonEncoding
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
     * The person to erase, by id. Give this or `distinctId`, not both.
     *
     * @var string|null
     */
    protected $personId;
    /**
     * The person to erase, by one of their distinct ids. Give this or `personId`, not both.
     *
     * @var string|null
     */
    protected $distinctId;
    /**
     * The person to erase, by id. Give this or `distinctId`, not both.
     *
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * The person to erase, by id. Give this or `distinctId`, not both.
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
     * The person to erase, by one of their distinct ids. Give this or `personId`, not both.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * The person to erase, by one of their distinct ids. Give this or `personId`, not both.
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
}