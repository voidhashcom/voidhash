<?php

namespace Voidhash\Generated\Core\Model;

class UpdateBoardTaskBodyJsonEncoding
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
     * @var string|null
     */
    protected $title;
    /**
     * @var string|null
     */
    protected $description;
    /**
     * @var list<string>|null
     */
    protected $assignees;
    /**
     * @var list<string>|null
     */
    protected $addAssignees;
    /**
     * @var list<string>|null
     */
    protected $removeAssignees;
    /**
     * @var list<string>|null
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
     * @var string|null
     */
    protected $columnId;
    /**
     * @var string|null
     */
    protected $afterTaskId;
    /**
     * @var string|null
     */
    protected $beforeTaskId;
    /**
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * @param string|null $title
     *
     * @return self
     */
    public function setTitle(?string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getAssignees(): ?array
    {
        return $this->assignees;
    }
    /**
     * @param list<string>|null $assignees
     *
     * @return self
     */
    public function setAssignees(?array $assignees): self
    {
        $this->initialized['assignees'] = true;
        $this->assignees = $assignees;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getAddAssignees(): ?array
    {
        return $this->addAssignees;
    }
    /**
     * @param list<string>|null $addAssignees
     *
     * @return self
     */
    public function setAddAssignees(?array $addAssignees): self
    {
        $this->initialized['addAssignees'] = true;
        $this->addAssignees = $addAssignees;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getRemoveAssignees(): ?array
    {
        return $this->removeAssignees;
    }
    /**
     * @param list<string>|null $removeAssignees
     *
     * @return self
     */
    public function setRemoveAssignees(?array $removeAssignees): self
    {
        $this->initialized['removeAssignees'] = true;
        $this->removeAssignees = $removeAssignees;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getLabelIds(): ?array
    {
        return $this->labelIds;
    }
    /**
     * @param list<string>|null $labelIds
     *
     * @return self
     */
    public function setLabelIds(?array $labelIds): self
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
     * @return string|null
     */
    public function getColumnId(): ?string
    {
        return $this->columnId;
    }
    /**
     * @param string|null $columnId
     *
     * @return self
     */
    public function setColumnId(?string $columnId): self
    {
        $this->initialized['columnId'] = true;
        $this->columnId = $columnId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getAfterTaskId(): ?string
    {
        return $this->afterTaskId;
    }
    /**
     * @param string|null $afterTaskId
     *
     * @return self
     */
    public function setAfterTaskId(?string $afterTaskId): self
    {
        $this->initialized['afterTaskId'] = true;
        $this->afterTaskId = $afterTaskId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getBeforeTaskId(): ?string
    {
        return $this->beforeTaskId;
    }
    /**
     * @param string|null $beforeTaskId
     *
     * @return self
     */
    public function setBeforeTaskId(?string $beforeTaskId): self
    {
        $this->initialized['beforeTaskId'] = true;
        $this->beforeTaskId = $beforeTaskId;
        return $this;
    }
}