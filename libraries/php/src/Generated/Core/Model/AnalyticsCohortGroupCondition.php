<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortGroupCondition
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
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
     *
     * @var string
     */
    protected $groupType;
    /**
     * The group property compared, such as `plan`.
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
     * What the group property is compared with.
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
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
     *
     * @return string
     */
    public function getGroupType(): string
    {
        return $this->groupType;
    }
    /**
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
     *
     * @param string $groupType
     *
     * @return self
     */
    public function setGroupType(string $groupType): self
    {
        $this->initialized['groupType'] = true;
        $this->groupType = $groupType;
        return $this;
    }
    /**
     * The group property compared, such as `plan`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The group property compared, such as `plan`.
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
     * What the group property is compared with.
     *
     * @return list<string>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * What the group property is compared with.
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