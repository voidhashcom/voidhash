<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainResultJsonEncodingLimits
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
     * The longest the query may run, in seconds.
     *
     * @var int
     */
    protected $maxExecutionSeconds;
    /**
     * The most rows it may return.
     *
     * @var int
     */
    protected $maxResultRows;
    /**
     * The longest the query may run, in seconds.
     *
     * @return int
     */
    public function getMaxExecutionSeconds(): int
    {
        return $this->maxExecutionSeconds;
    }
    /**
     * The longest the query may run, in seconds.
     *
     * @param int $maxExecutionSeconds
     *
     * @return self
     */
    public function setMaxExecutionSeconds(int $maxExecutionSeconds): self
    {
        $this->initialized['maxExecutionSeconds'] = true;
        $this->maxExecutionSeconds = $maxExecutionSeconds;
        return $this;
    }
    /**
     * The most rows it may return.
     *
     * @return int
     */
    public function getMaxResultRows(): int
    {
        return $this->maxResultRows;
    }
    /**
     * The most rows it may return.
     *
     * @param int $maxResultRows
     *
     * @return self
     */
    public function setMaxResultRows(int $maxResultRows): self
    {
        $this->initialized['maxResultRows'] = true;
        $this->maxResultRows = $maxResultRows;
        return $this;
    }
}