<?php

namespace Voidhash\Generated\Core\Model;

class AdsPerformanceReportBodyJsonEncodingSort
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
     * The number or name rows are sorted by.
     *
     * @var string
     */
    protected $field;
    /**
     * `asc` for lowest first, `desc` for highest first.
     *
     * @var string
     */
    protected $direction;
    /**
     * The number or name rows are sorted by.
     *
     * @return string
     */
    public function getField(): string
    {
        return $this->field;
    }
    /**
     * The number or name rows are sorted by.
     *
     * @param string $field
     *
     * @return self
     */
    public function setField(string $field): self
    {
        $this->initialized['field'] = true;
        $this->field = $field;
        return $this;
    }
    /**
     * `asc` for lowest first, `desc` for highest first.
     *
     * @return string
     */
    public function getDirection(): string
    {
        return $this->direction;
    }
    /**
     * `asc` for lowest first, `desc` for highest first.
     *
     * @param string $direction
     *
     * @return self
     */
    public function setDirection(string $direction): self
    {
        $this->initialized['direction'] = true;
        $this->direction = $direction;
        return $this;
    }
}