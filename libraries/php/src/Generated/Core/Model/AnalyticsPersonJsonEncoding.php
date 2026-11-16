<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsPersonJsonEncoding
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
}