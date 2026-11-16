<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortEventFilter
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
     * @var AnalyticsCohortEventProperty
     */
    protected $dimension;
    /**
     * How the value compares with `values`: `in` and `not_in` exactly; `contains`, `not_contains`, `starts_with` and `ends_with` as text, ignoring case; `regex` and `not_regex` with the first value as an RE2 pattern; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @var string
     */
    protected $op;
    /**
     * What the property is compared with.
     *
     * @var list<string>
     */
    protected $values;
    /**
     * @return AnalyticsCohortEventProperty
     */
    public function getDimension(): AnalyticsCohortEventProperty
    {
        return $this->dimension;
    }
    /**
     * @param AnalyticsCohortEventProperty $dimension
     *
     * @return self
     */
    public function setDimension(AnalyticsCohortEventProperty $dimension): self
    {
        $this->initialized['dimension'] = true;
        $this->dimension = $dimension;
        return $this;
    }
    /**
     * How the value compares with `values`: `in` and `not_in` exactly; `contains`, `not_contains`, `starts_with` and `ends_with` as text, ignoring case; `regex` and `not_regex` with the first value as an RE2 pattern; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * How the value compares with `values`: `in` and `not_in` exactly; `contains`, `not_contains`, `starts_with` and `ends_with` as text, ignoring case; `regex` and `not_regex` with the first value as an RE2 pattern; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @param string $op
     *
     * @return self
     */
    public function setOp(string $op): self
    {
        $this->initialized['op'] = true;
        $this->op = $op;
        return $this;
    }
    /**
     * What the property is compared with.
     *
     * @return list<string>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * What the property is compared with.
     *
     * @param list<string> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}