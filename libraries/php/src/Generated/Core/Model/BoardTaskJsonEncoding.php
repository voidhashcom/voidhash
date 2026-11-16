<?php

namespace Voidhash\Generated\Core\Model;

class BoardTaskJsonEncoding
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
    protected $boardId;
    /**
     * @var string
     */
    protected $title;
    /**
     * @var string
     */
    protected $description;
    /**
     * @var string
     */
    protected $columnId;
    /**
     * @var list<string>
     */
    protected $assignees;
    /**
     * @var list<string>
     */
    protected $labelIds;
    /**
     * @var string
     */
    protected $priority;
    /**
     * @var string|null
     */
    protected $dueDate;
    /**
     * @var int
     */
    protected $commentCount;
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
    public function getBoardId(): string
    {
        return $this->boardId;
    }
    /**
     * @param string $boardId
     *
     * @return self
     */
    public function setBoardId(string $boardId): self
    {
        $this->initialized['boardId'] = true;
        $this->boardId = $boardId;
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
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * @return string
     */
    public function getColumnId(): string
    {
        return $this->columnId;
    }
    /**
     * @param string $columnId
     *
     * @return self
     */
    public function setColumnId(string $columnId): self
    {
        $this->initialized['columnId'] = true;
        $this->columnId = $columnId;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getAssignees(): array
    {
        return $this->assignees;
    }
    /**
     * @param list<string> $assignees
     *
     * @return self
     */
    public function setAssignees(array $assignees): self
    {
        $this->initialized['assignees'] = true;
        $this->assignees = $assignees;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getLabelIds(): array
    {
        return $this->labelIds;
    }
    /**
     * @param list<string> $labelIds
     *
     * @return self
     */
    public function setLabelIds(array $labelIds): self
    {
        $this->initialized['labelIds'] = true;
        $this->labelIds = $labelIds;
        return $this;
    }
    /**
     * @return string
     */
    public function getPriority(): string
    {
        return $this->priority;
    }
    /**
     * @param string $priority
     *
     * @return self
     */
    public function setPriority(string $priority): self
    {
        $this->initialized['priority'] = true;
        $this->priority = $priority;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getDueDate(): ?string
    {
        return $this->dueDate;
    }
    /**
     * @param string|null $dueDate
     *
     * @return self
     */
    public function setDueDate(?string $dueDate): self
    {
        $this->initialized['dueDate'] = true;
        $this->dueDate = $dueDate;
        return $this;
    }
    /**
     * @return int
     */
    public function getCommentCount(): int
    {
        return $this->commentCount;
    }
    /**
     * @param int $commentCount
     *
     * @return self
     */
    public function setCommentCount(int $commentCount): self
    {
        $this->initialized['commentCount'] = true;
        $this->commentCount = $commentCount;
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