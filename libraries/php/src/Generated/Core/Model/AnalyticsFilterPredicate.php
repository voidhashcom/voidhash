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
     * The field compared: `store` (the store's provider id, such as `apple-app-store`), `product.id`, `country` (the store's storefront country, an ISO 3166 alpha-2 code such as `US`) and `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight. A subscription insight narrows subscription by subscription: by its product at each change, so a subscription that moves to a product left out ends there, and by the storefront it was first charged in.
     *
     * @var string
     */
    protected $field;
    /**
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on every field but `provider.environment`, to leave values out; another operator fails with `unsupported_filter`. Filters on different fields combine with `and`; `or` joins values to keep of one field, and `not` wraps one comparison.
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
     * The value compared with, or a list of up to 100 values, each text of at most 256 characters, for `in` and `not_in`. Ids, stores and countries are strings and `provider.environment` is a number; a missing or null value matches nothing.
     *
     * @var mixed|null
     */
    protected $value;
    /**
     * The field compared: `store` (the store's provider id, such as `apple-app-store`), `product.id`, `country` (the store's storefront country, an ISO 3166 alpha-2 code such as `US`) and `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight. A subscription insight narrows subscription by subscription: by its product at each change, so a subscription that moves to a product left out ends there, and by the storefront it was first charged in.
     *
     * @return string
     */
    public function getField(): string
    {
        return $this->field;
    }
    /**
     * The field compared: `store` (the store's provider id, such as `apple-app-store`), `product.id`, `country` (the store's storefront country, an ISO 3166 alpha-2 code such as `US`) and `provider.environment` (store environment: 1 production, 2 sandbox, 3 test) on revenue and subscription insights, `project.id` on every insight. A subscription insight narrows subscription by subscription: by its product at each change, so a subscription that moves to a product left out ends there, and by the storefront it was first charged in.
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
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on every field but `provider.environment`, to leave values out; another operator fails with `unsupported_filter`. Filters on different fields combine with `and`; `or` joins values to keep of one field, and `not` wraps one comparison.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * How `field` is compared with `value`. Insights support `eq` and `in` on every field, and `neq` and `not_in` on every field but `provider.environment`, to leave values out; another operator fails with `unsupported_filter`. Filters on different fields combine with `and`; `or` joins values to keep of one field, and `not` wraps one comparison.
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
     * The value compared with, or a list of up to 100 values, each text of at most 256 characters, for `in` and `not_in`. Ids, stores and countries are strings and `provider.environment` is a number; a missing or null value matches nothing.
     *
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
     * The value compared with, or a list of up to 100 values, each text of at most 256 characters, for `in` and `not_in`. Ids, stores and countries are strings and `provider.environment` is a number; a missing or null value matches nothing.
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