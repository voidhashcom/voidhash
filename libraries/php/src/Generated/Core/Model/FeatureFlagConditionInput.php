<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagConditionInput
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
     * What the condition compares: a `trait` of the end user, named by `key`, or what their app reports when it asks: its `platform` (`ios`, `android` or `web`), its `app_version`, the operating system's `os_version`, the two-letter `country` the request came from, or the end user's `locale`.
     *
     * @var string
     */
    protected $attribute;
    /**
     * The trait's key. Required for `trait`, and only allowed there.
     *
     * @var string|null
     */
    protected $key;
    /**
     * How the value is compared. `in` holds when it is one of `values`, ignoring case; `not_in` when it is not, or there is no value. `gte` and `lt` compare a version or a number with the one value given, part by part, so `2.10` is newer than `2.9`; they hold for neither when the value is missing or not a version. `is_set` and `is_not_set` ask whether there is a value at all.
     *
     * @var string
     */
    protected $op;
    /**
     * What the value is compared with: at least one for `in` and `not_in`, exactly one version or number for `gte` and `lt`, none for `is_set` and `is_not_set`. At most 100; omitted, none.
     *
     * @var list<string>|null
     */
    protected $values;
    /**
     * What the condition compares: a `trait` of the end user, named by `key`, or what their app reports when it asks: its `platform` (`ios`, `android` or `web`), its `app_version`, the operating system's `os_version`, the two-letter `country` the request came from, or the end user's `locale`.
     *
     * @return string
     */
    public function getAttribute(): string
    {
        return $this->attribute;
    }
    /**
     * What the condition compares: a `trait` of the end user, named by `key`, or what their app reports when it asks: its `platform` (`ios`, `android` or `web`), its `app_version`, the operating system's `os_version`, the two-letter `country` the request came from, or the end user's `locale`.
     *
     * @param string $attribute
     *
     * @return self
     */
    public function setAttribute(string $attribute): self
    {
        $this->initialized['attribute'] = true;
        $this->attribute = $attribute;
        return $this;
    }
    /**
     * The trait's key. Required for `trait`, and only allowed there.
     *
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
     * The trait's key. Required for `trait`, and only allowed there.
     *
     * @param string|null $key
     *
     * @return self
     */
    public function setKey(?string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * How the value is compared. `in` holds when it is one of `values`, ignoring case; `not_in` when it is not, or there is no value. `gte` and `lt` compare a version or a number with the one value given, part by part, so `2.10` is newer than `2.9`; they hold for neither when the value is missing or not a version. `is_set` and `is_not_set` ask whether there is a value at all.
     *
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * How the value is compared. `in` holds when it is one of `values`, ignoring case; `not_in` when it is not, or there is no value. `gte` and `lt` compare a version or a number with the one value given, part by part, so `2.10` is newer than `2.9`; they hold for neither when the value is missing or not a version. `is_set` and `is_not_set` ask whether there is a value at all.
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
     * What the value is compared with: at least one for `in` and `not_in`, exactly one version or number for `gte` and `lt`, none for `is_set` and `is_not_set`. At most 100; omitted, none.
     *
     * @return list<string>|null
     */
    public function getValues(): ?array
    {
        return $this->values;
    }
    /**
     * What the value is compared with: at least one for `in` and `not_in`, exactly one version or number for `gte` and `lt`, none for `is_set` and `is_not_set`. At most 100; omitted, none.
     *
     * @param list<string>|null $values
     *
     * @return self
     */
    public function setValues(?array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}