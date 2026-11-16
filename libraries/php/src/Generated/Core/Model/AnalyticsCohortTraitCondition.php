<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortTraitCondition
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
    protected $kind;
    /**
     * The trait's key, as the app sets it on people.
     *
     * @var string
     */
    protected $key;
    /**
     * How the value compares with `values`: `in` and `not_in` exactly; `contains`, `not_contains`, `starts_with` and `ends_with` as text, ignoring case; `regex` and `not_regex` with the first value as an RE2 pattern; `is_set` and `is_not_set` take no values; `gt` and `lt` compare a number with the first value.
     *
     * @var string
     */
    protected $op;
    /**
     * What the trait is compared with.
     *
     * @var list<string>
     */
    protected $values;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The trait's key, as the app sets it on people.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The trait's key, as the app sets it on people.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
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
     * What the trait is compared with.
     *
     * @return list<string>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * What the trait is compared with.
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