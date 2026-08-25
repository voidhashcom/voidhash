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
     * @var string
     */
    protected $field;
    /**
     * @var mixed|null
     */
    protected $limit;
    /**
     * @var string|null
     */
    protected $order;
    /**
     * @return string
     */
    public function getField(): string
    {
        return $this->field;
    }
    /**
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
     * @return mixed
     */
    public function getLimit()
    {
        return $this->limit;
    }
    /**
     * @param mixed $limit
     *
     * @return self
     */
    public function setLimit($limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getOrder(): ?string
    {
        return $this->order;
    }
    /**
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