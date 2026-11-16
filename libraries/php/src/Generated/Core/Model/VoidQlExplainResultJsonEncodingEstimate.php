<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainResultJsonEncodingEstimate
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
     * The rows it would scan.
     *
     * @var int
     */
    protected $rows;
    /**
     * The data parts it would read.
     *
     * @var int
     */
    protected $parts;
    /**
     * The index marks it would read.
     *
     * @var int
     */
    protected $marks;
    /**
     * The rows it would scan.
     *
     * @return int
     */
    public function getRows(): int
    {
        return $this->rows;
    }
    /**
     * The rows it would scan.
     *
     * @param int $rows
     *
     * @return self
     */
    public function setRows(int $rows): self
    {
        $this->initialized['rows'] = true;
        $this->rows = $rows;
        return $this;
    }
    /**
     * The data parts it would read.
     *
     * @return int
     */
    public function getParts(): int
    {
        return $this->parts;
    }
    /**
     * The data parts it would read.
     *
     * @param int $parts
     *
     * @return self
     */
    public function setParts(int $parts): self
    {
        $this->initialized['parts'] = true;
        $this->parts = $parts;
        return $this;
    }
    /**
     * The index marks it would read.
     *
     * @return int
     */
    public function getMarks(): int
    {
        return $this->marks;
    }
    /**
     * The index marks it would read.
     *
     * @param int $marks
     *
     * @return self
     */
    public function setMarks(int $marks): self
    {
        $this->initialized['marks'] = true;
        $this->marks = $marks;
        return $this;
    }
}