<?php

namespace Voidhash\Generated\Core\Model;

class BoardJsonEncoding
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
    protected $name;
    /**
     * @var list<BoardColumnSummaryJsonEncoding>
     */
    protected $columns;
    /**
     * @var list<BoardLabelJsonEncoding>
     */
    protected $labels;
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
     * @return list<BoardColumnSummaryJsonEncoding>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * @param list<BoardColumnSummaryJsonEncoding> $columns
     *
     * @return self
     */
    public function setColumns(array $columns): self
    {
        $this->initialized['columns'] = true;
        $this->columns = $columns;
        return $this;
    }
    /**
     * @return list<BoardLabelJsonEncoding>
     */
    public function getLabels(): array
    {
        return $this->labels;
    }
    /**
     * @param list<BoardLabelJsonEncoding> $labels
     *
     * @return self
     */
    public function setLabels(array $labels): self
    {
        $this->initialized['labels'] = true;
        $this->labels = $labels;
        return $this;
    }
}