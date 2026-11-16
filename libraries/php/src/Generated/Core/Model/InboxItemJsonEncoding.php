<?php

namespace Voidhash\Generated\Core\Model;

class InboxItemJsonEncoding
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
    protected $subjectType;
    /**
     * @var string
     */
    protected $subjectId;
    /**
     * @var string
     */
    protected $title;
    /**
     * @var string|null
     */
    protected $place;
    /**
     * @var string
     */
    protected $kind;
    /**
     * @var string
     */
    protected $actor;
    /**
     * @var array<string, mixed>
     */
    protected $data;
    /**
     * @var string|null
     */
    protected $commentId;
    /**
     * @var string|null
     */
    protected $snippet;
    /**
     * @var string
     */
    protected $occurredAt;
    /**
     * @var string|null
     */
    protected $readAt;
    /**
     * @var string|null
     */
    protected $archivedAt;
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
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPlace(): ?string
    {
        return $this->place;
    }
    /**
     * @param string|null $place
     *
     * @return self
     */
    public function setPlace(?string $place): self
    {
        $this->initialized['place'] = true;
        $this->place = $place;
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
    public function getActor(): string
    {
        return $this->actor;
    }
    /**
     * @param string $actor
     *
     * @return self
     */
    public function setActor(string $actor): self
    {
        $this->initialized['actor'] = true;
        $this->actor = $actor;
        return $this;
    }
    /**
     * @return array<string, mixed>
     */
    public function getData(): iterable
    {
        return $this->data;
    }
    /**
     * @param array<string, mixed> $data
     *
     * @return self
     */
    public function setData(iterable $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCommentId(): ?string
    {
        return $this->commentId;
    }
    /**
     * @param string|null $commentId
     *
     * @return self
     */
    public function setCommentId(?string $commentId): self
    {
        $this->initialized['commentId'] = true;
        $this->commentId = $commentId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getSnippet(): ?string
    {
        return $this->snippet;
    }
    /**
     * @param string|null $snippet
     *
     * @return self
     */
    public function setSnippet(?string $snippet): self
    {
        $this->initialized['snippet'] = true;
        $this->snippet = $snippet;
        return $this;
    }
    /**
     * @return string
     */
    public function getOccurredAt(): string
    {
        return $this->occurredAt;
    }
    /**
     * @param string $occurredAt
     *
     * @return self
     */
    public function setOccurredAt(string $occurredAt): self
    {
        $this->initialized['occurredAt'] = true;
        $this->occurredAt = $occurredAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getReadAt(): ?string
    {
        return $this->readAt;
    }
    /**
     * @param string|null $readAt
     *
     * @return self
     */
    public function setReadAt(?string $readAt): self
    {
        $this->initialized['readAt'] = true;
        $this->readAt = $readAt;
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
}