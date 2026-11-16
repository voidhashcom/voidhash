<?php

namespace Voidhash\Generated\Core\Model;

class CreateCommentBodyJsonEncoding
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
    protected $subjectType;
    /**
     * @var string
     */
    protected $subjectId;
    /**
     * @var string
     */
    protected $body;
    /**
     * @var list<string>|null
     */
    protected $attachmentIds;
    /**
     * @var string|null
     */
    protected $parentId;
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
     * @return list<string>|null
     */
    public function getAttachmentIds(): ?array
    {
        return $this->attachmentIds;
    }
    /**
     * @param list<string>|null $attachmentIds
     *
     * @return self
     */
    public function setAttachmentIds(?array $attachmentIds): self
    {
        $this->initialized['attachmentIds'] = true;
        $this->attachmentIds = $attachmentIds;
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
}