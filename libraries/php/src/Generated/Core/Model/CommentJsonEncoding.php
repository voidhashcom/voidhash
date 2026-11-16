<?php

namespace Voidhash\Generated\Core\Model;

class CommentJsonEncoding
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
     * @var string
     */
    protected $subjectType;
    /**
     * @var string
     */
    protected $subjectId;
    /**
     * @var string|null
     */
    protected $parentId;
    /**
     * @var string
     */
    protected $author;
    /**
     * @var string
     */
    protected $body;
    /**
     * @var list<string>
     */
    protected $mentions;
    /**
     * @var list<string>
     */
    protected $attachmentIds;
    /**
     * @var list<CommentReactionJsonEncoding>
     */
    protected $reactions;
    /**
     * @var string
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $editedAt;
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
     * @return string
     */
    public function getSubjectType(): string
    {
        return $this->subjectType;
    }
    /**
     * @param string $subjectType
     *
     * @return self
     */
    public function setSubjectType(string $subjectType): self
    {
        $this->initialized['subjectType'] = true;
        $this->subjectType = $subjectType;
        return $this;
    }
    /**
     * @return string
     */
    public function getSubjectId(): string
    {
        return $this->subjectId;
    }
    /**
     * @param string $subjectId
     *
     * @return self
     */
    public function setSubjectId(string $subjectId): self
    {
        $this->initialized['subjectId'] = true;
        $this->subjectId = $subjectId;
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
    public function getAuthor(): string
    {
        return $this->author;
    }
    /**
     * @param string $author
     *
     * @return self
     */
    public function setAuthor(string $author): self
    {
        $this->initialized['author'] = true;
        $this->author = $author;
        return $this;
    }
    /**
     * @return string
     */
    public function getBody(): string
    {
        return $this->body;
    }
    /**
     * @param string $body
     *
     * @return self
     */
    public function setBody(string $body): self
    {
        $this->initialized['body'] = true;
        $this->body = $body;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getMentions(): array
    {
        return $this->mentions;
    }
    /**
     * @param list<string> $mentions
     *
     * @return self
     */
    public function setMentions(array $mentions): self
    {
        $this->initialized['mentions'] = true;
        $this->mentions = $mentions;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getAttachmentIds(): array
    {
        return $this->attachmentIds;
    }
    /**
     * @param list<string> $attachmentIds
     *
     * @return self
     */
    public function setAttachmentIds(array $attachmentIds): self
    {
        $this->initialized['attachmentIds'] = true;
        $this->attachmentIds = $attachmentIds;
        return $this;
    }
    /**
     * @return list<CommentReactionJsonEncoding>
     */
    public function getReactions(): array
    {
        return $this->reactions;
    }
    /**
     * @param list<CommentReactionJsonEncoding> $reactions
     *
     * @return self
     */
    public function setReactions(array $reactions): self
    {
        $this->initialized['reactions'] = true;
        $this->reactions = $reactions;
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
     * @return string|null
     */
    public function getEditedAt(): ?string
    {
        return $this->editedAt;
    }
    /**
     * @param string|null $editedAt
     *
     * @return self
     */
    public function setEditedAt(?string $editedAt): self
    {
        $this->initialized['editedAt'] = true;
        $this->editedAt = $editedAt;
        return $this;
    }
}