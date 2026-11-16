<?php

namespace Voidhash\Generated\Core\Model;

class CreateBoardTaskBodyJsonEncoding
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
    protected $title;
    /**
     * @var string|null
     */
    protected $description;
    /**
     * @var string|null
     */
    protected $columnId;
    /**
     * @var list<string>|null
     */
    protected $assignees;
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
}