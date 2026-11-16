<?php

namespace Voidhash\Generated\Core\Model;

class RegistryPublisherJsonEncoding
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
     * The publisher's id, `cmp_pub_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization (team) the publisher belongs to.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The namespace the organization's registry component slugs start with: lowercase letters, digits and dashes, at most 39 characters.
     *
     * @var string
     */
    protected $namespace;
    /**
     * When the namespace was claimed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The publisher's id, `cmp_pub_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The publisher's id, `cmp_pub_...`.
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
     * The organization (team) the publisher belongs to.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization (team) the publisher belongs to.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * The namespace the organization's registry component slugs start with: lowercase letters, digits and dashes, at most 39 characters.
     *
     * @return string
     */
    public function getNamespace(): string
    {
        return $this->namespace;
    }
    /**
     * The namespace the organization's registry component slugs start with: lowercase letters, digits and dashes, at most 39 characters.
     *
     * @param string $namespace
     *
     * @return self
     */
    public function setNamespace(string $namespace): self
    {
        $this->initialized['namespace'] = true;
        $this->namespace = $namespace;
        return $this;
    }
    /**
     * When the namespace was claimed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the namespace was claimed, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}