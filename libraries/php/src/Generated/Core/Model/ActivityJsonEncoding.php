<?php

namespace Voidhash\Generated\Core\Model;

class ActivityJsonEncoding
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
    protected $actor;
    /**
     * @var string
     */
    protected $kind;
    /**
     * @var array<string, mixed>
     */
    protected $data;
    /**
     * @var string
     */
    protected $createdAt;
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
}