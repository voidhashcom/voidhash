<?php

namespace Voidhash\Generated\Core\Model;

class UserJsonEncoding
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
     * @var string
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $email;
    /**
     * @var bool
     */
    protected $emailVerified;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $image;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var list<UserJsonEncodingOrganizationsItem>
     */
    protected $organizations;
    /**
     * @var list<UserJsonEncodingProjectsItem>
     */
    protected $projects;
    /**
     * @var string
     */
    protected $updatedAt;
    /**
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
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
    /**
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * @param string $email
     *
     * @return self
     */
    public function setEmail(string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * @return bool
     */
    public function getEmailVerified(): bool
    {
        return $this->emailVerified;
    }
    /**
     * @param bool $emailVerified
     *
     * @return self
     */
    public function setEmailVerified(bool $emailVerified): self
    {
        $this->initialized['emailVerified'] = true;
        $this->emailVerified = $emailVerified;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return string|null
     */
    public function getImage(): ?string
    {
        return $this->image;
    }
    /**
     * @param string|null $image
     *
     * @return self
     */
    public function setImage(?string $image): self
    {
        $this->initialized['image'] = true;
        $this->image = $image;
        return $this;
    }
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
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
     * @return list<UserJsonEncodingOrganizationsItem>
     */
    public function getOrganizations(): array
    {
        return $this->organizations;
    }
    /**
     * @param list<UserJsonEncodingOrganizationsItem> $organizations
     *
     * @return self
     */
    public function setOrganizations(array $organizations): self
    {
        $this->initialized['organizations'] = true;
        $this->organizations = $organizations;
        return $this;
    }
    /**
     * @return list<UserJsonEncodingProjectsItem>
     */
    public function getProjects(): array
    {
        return $this->projects;
    }
    /**
     * @param list<UserJsonEncodingProjectsItem> $projects
     *
     * @return self
     */
    public function setProjects(array $projects): self
    {
        $this->initialized['projects'] = true;
        $this->projects = $projects;
        return $this;
    }
    /**
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}