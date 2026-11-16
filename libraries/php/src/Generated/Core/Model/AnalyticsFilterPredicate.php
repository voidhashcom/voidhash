<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsFilterPredicate
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
     * The field compared: `product.id` or `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight.
     *
     * @var string
     */
    protected $field;
    /**
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on `project.id`; another operator fails with `unsupported_filter`.
     *
     * @var string
     */
    protected $op;
    /**
     * Always `predicate`: a single comparison.
     *
     * @var string
     */
    protected $type;
    /**
     * The value compared with, or a list of values for `in` and `not_in`. Ids are strings and `provider.environment` is a number; a missing or null value matches nothing.
     *
     * @var mixed|null
     */
    protected $value;
    /**
     * The field compared: `product.id` or `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight.
     *
     * @return string
     */
    public function getField(): string
    {
        return $this->field;
    }
    /**
     * The field compared: `product.id` or `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight.
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
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on `project.id`; another operator fails with `unsupported_filter`.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on `project.id`; another operator fails with `unsupported_filter`.
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
     * Always `predicate`: a single comparison.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Always `predicate`: a single comparison.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The value compared with, or a list of values for `in` and `not_in`. Ids are strings and `provider.environment` is a number; a missing or null value matches nothing.
     *
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
     * The value compared with, or a list of values for `in` and `not_in`. Ids are strings and `provider.environment` is a number; a missing or null value matches nothing.
     *
     * @param mixed $value
     *
     * @return self
     */
    public function setValue($value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}