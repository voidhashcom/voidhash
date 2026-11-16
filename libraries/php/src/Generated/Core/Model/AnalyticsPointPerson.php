<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsPointPerson
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
     * The person's id, `person_...`; null for a visitor never identified, and for someone no longer a person of the project (erased, deleted or archived).
     *
     * @var string|null
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
     * The distinct id they were identified with, or a visitor's own; null for someone no longer a person of the project.
     *
     * @var string|null
     */
    protected $distinctId;
    /**
     * The person's id, `person_...`; null for a visitor never identified, and for someone no longer a person of the project (erased, deleted or archived).
     *
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }
    /**
     * The person's id, `person_...`; null for a visitor never identified, and for someone no longer a person of the project (erased, deleted or archived).
     *
     * @param string|null $id
     *
     * @return self
     */
    public function setId(?string $id): self
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
     * The distinct id they were identified with, or a visitor's own; null for someone no longer a person of the project.
     *
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id they were identified with, or a visitor's own; null for someone no longer a person of the project.
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