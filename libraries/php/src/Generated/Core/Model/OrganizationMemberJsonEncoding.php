<?php

namespace Voidhash\Generated\Core\Model;

class OrganizationMemberJsonEncoding
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
     * The membership's id, `member_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization the person belongs to, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The member's role in every project of the organization: `owner`, the one person who can delete the organization and transfer ownership; `admin`, who manages the organization, its projects and members; or `member`, who can see its projects' data and settings but not change them.
     *
     * @var string
     */
    protected $role;
    /**
     * The person's id, `user_...`.
     *
     * @var string
     */
    protected $userId;
    /**
     * The email address the person signs in with.
     *
     * @var string
     */
    protected $email;
    /**
     * The person's name.
     *
     * @var string
     */
    protected $name;
    /**
     * How the person became a member: `creator` created the organization, `manual` was added by an administrator, `invitation` accepted an invitation, `directory` is managed by directory sync and cannot be changed or removed here, and `sso_jit` joined on first single sign-on.
     *
     * @var string
     */
    protected $source;
    /**
     * When the person joined the organization, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The membership's id, `member_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The membership's id, `member_...`.
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
     * The organization the person belongs to, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization the person belongs to, `org_...`.
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
     * The member's role in every project of the organization: `owner`, the one person who can delete the organization and transfer ownership; `admin`, who manages the organization, its projects and members; or `member`, who can see its projects' data and settings but not change them.
     *
     * @return string
     */
    public function getRole(): string
    {
        return $this->role;
    }
    /**
     * The member's role in every project of the organization: `owner`, the one person who can delete the organization and transfer ownership; `admin`, who manages the organization, its projects and members; or `member`, who can see its projects' data and settings but not change them.
     *
     * @param string $role
     *
     * @return self
     */
    public function setRole(string $role): self
    {
        $this->initialized['role'] = true;
        $this->role = $role;
        return $this;
    }
    /**
     * The person's id, `user_...`.
     *
     * @return string
     */
    public function getUserId(): string
    {
        return $this->userId;
    }
    /**
     * The person's id, `user_...`.
     *
     * @param string $userId
     *
     * @return self
     */
    public function setUserId(string $userId): self
    {
        $this->initialized['userId'] = true;
        $this->userId = $userId;
        return $this;
    }
    /**
     * The email address the person signs in with.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The email address the person signs in with.
     *
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
     * The person's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The person's name.
     *
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
     * How the person became a member: `creator` created the organization, `manual` was added by an administrator, `invitation` accepted an invitation, `directory` is managed by directory sync and cannot be changed or removed here, and `sso_jit` joined on first single sign-on.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * How the person became a member: `creator` created the organization, `manual` was added by an administrator, `invitation` accepted an invitation, `directory` is managed by directory sync and cannot be changed or removed here, and `sso_jit` joined on first single sign-on.
     *
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * When the person joined the organization, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the person joined the organization, as an ISO 8601 timestamp.
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