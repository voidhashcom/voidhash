<?php

namespace Voidhash\Generated\Core\Model;

class PersonJsonEncoding
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
     * The project the person belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The distinct id the person is known by: their identified one when they have one, such as your own user id.
     *
     * @var string
     */
    protected $distinctId;
    /**
     * The person's email address; null when unknown.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The person's name; null when unknown.
     *
     * @var string|null
     */
    protected $name;
    /**
     * Whether the app identified the person, rather than only seeing them anonymously.
     *
     * @var bool
     */
    protected $isIdentified;
    /**
     * When the person was first recorded, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
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
     * The project the person belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the person belongs to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The distinct id the person is known by: their identified one when they have one, such as your own user id.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id the person is known by: their identified one when they have one, such as your own user id.
     *
     * @param string $distinctId
     *
     * @return self
     */
    public function setDistinctId(string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * The person's email address; null when unknown.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * The person's email address; null when unknown.
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
     * The person's name; null when unknown.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The person's name; null when unknown.
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
     * Whether the app identified the person, rather than only seeing them anonymously.
     *
     * @return bool
     */
    public function getIsIdentified(): bool
    {
        return $this->isIdentified;
    }
    /**
     * Whether the app identified the person, rather than only seeing them anonymously.
     *
     * @param bool $isIdentified
     *
     * @return self
     */
    public function setIsIdentified(bool $isIdentified): self
    {
        $this->initialized['isIdentified'] = true;
        $this->isIdentified = $isIdentified;
        return $this;
    }
    /**
     * When the person was first recorded, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the person was first recorded, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}