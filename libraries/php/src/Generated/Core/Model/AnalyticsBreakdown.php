<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsBreakdown
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
     * The field to split the result by.
     *
     * @var string
     */
    protected $field;
    /**
     * The most rows to return, from 1 to 100.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * Whether rows run from the smallest value (`asc`) or the largest (`desc`).
     *
     * @var string|null
     */
    protected $order;
    /**
     * The field to split the result by.
     *
     * @return string
     */
    public function getField(): string
    {
        return $this->field;
    }
    /**
     * The field to split the result by.
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
     * The most rows to return, from 1 to 100.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * The most rows to return, from 1 to 100.
     *
     * @param int|null $limit
     *
     * @return self
     */
    public function setLimit(?int $limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
    /**
     * Whether rows run from the smallest value (`asc`) or the largest (`desc`).
     *
     * @return string|null
     */
    public function getOrder(): ?string
    {
        return $this->order;
    }
    /**
     * Whether rows run from the smallest value (`asc`) or the largest (`desc`).
     *
     * @param string|null $order
     *
     * @return self
     */
    public function setOrder(?string $order): self
    {
        $this->initialized['order'] = true;
        $this->order = $order;
        return $this;
    }
}