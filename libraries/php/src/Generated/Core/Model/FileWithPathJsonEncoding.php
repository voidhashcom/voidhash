<?php

namespace Voidhash\Generated\Core\Model;

class FileWithPathJsonEncoding
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
    protected $id;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string|null
     */
    protected $parentId;
    /**
     * @var string
     */
    protected $kind;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string|null
     */
    protected $ownerBot;
    /**
     * @var string|null
     */
    protected $ownerUser;
    /**
     * @var string
     */
    protected $createdBy;
    /**
     * @var string
     */
    protected $updatedBy;
    /**
     * @var string
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $updatedAt;
    /**
     * @var string|null
     */
    protected $archivedAt;
    /**
     * @var string
     */
    protected $role;
    /**
     * @var list<FilePathEntryJsonEncoding>
     */
    protected $path;
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
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
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
     * @return string|null
     */
    public function getParentId(): ?string
    {
        return $this->parentId;
    }
    /**
     * @param string|null $parentId
     *
     * @return self
     */
    public function setParentId(?string $parentId): self
    {
        $this->initialized['parentId'] = true;
        $this->parentId = $parentId;
        return $this;
    }
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
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
     * @return string|null
     */
    public function getOwnerBot(): ?string
    {
        return $this->ownerBot;
    }
    /**
     * @param string|null $ownerBot
     *
     * @return self
     */
    public function setOwnerBot(?string $ownerBot): self
    {
        $this->initialized['ownerBot'] = true;
        $this->ownerBot = $ownerBot;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getOwnerUser(): ?string
    {
        return $this->ownerUser;
    }
    /**
     * @param string|null $ownerUser
     *
     * @return self
     */
    public function setOwnerUser(?string $ownerUser): self
    {
        $this->initialized['ownerUser'] = true;
        $this->ownerUser = $ownerUser;
        return $this;
    }
    /**
     * @return string
     */
    public function getCreatedBy(): string
    {
        return $this->createdBy;
    }
    /**
     * @param string $createdBy
     *
     * @return self
     */
    public function setCreatedBy(string $createdBy): self
    {
        $this->initialized['createdBy'] = true;
        $this->createdBy = $createdBy;
        return $this;
    }
    /**
     * @return string
     */
    public function getUpdatedBy(): string
    {
        return $this->updatedBy;
    }
    /**
     * @param string $updatedBy
     *
     * @return self
     */
    public function setUpdatedBy(string $updatedBy): self
    {
        $this->initialized['updatedBy'] = true;
        $this->updatedBy = $updatedBy;
        return $this;
    }
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
    /**
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getRole(): string
    {
        return $this->role;
    }
    /**
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
     * @return list<FilePathEntryJsonEncoding>
     */
    public function getPath(): array
    {
        return $this->path;
    }
    /**
     * @param list<FilePathEntryJsonEncoding> $path
     *
     * @return self
     */
    public function setPath(array $path): self
    {
        $this->initialized['path'] = true;
        $this->path = $path;
        return $this;
    }
}