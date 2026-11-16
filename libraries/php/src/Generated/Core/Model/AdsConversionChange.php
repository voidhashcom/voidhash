<?php

namespace Voidhash\Generated\Core\Model;

class AdsConversionChange
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
     * A kind of conversion the platform reports, such as `purchase` or `app_install`.
     *
     * @var string
     */
    protected $kind;
    /**
     * How many more conversions the platform counts; negative when fewer.
     *
     * @var int
     */
    protected $count;
    /**
     * How their value changed, in minor units of the change's `currency`; null when the platform reported no value.
     *
     * @var int|null
     */
    protected $value;
    /**
     * A kind of conversion the platform reports, such as `purchase` or `app_install`.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * A kind of conversion the platform reports, such as `purchase` or `app_install`.
     *
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
     * How many more conversions the platform counts; negative when fewer.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many more conversions the platform counts; negative when fewer.
     *
     * @param int $count
     *
     * @return self
     */
    public function setCount(int $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
    /**
     * How their value changed, in minor units of the change's `currency`; null when the platform reported no value.
     *
     * @return int|null
     */
    public function getValue(): ?int
    {
        return $this->value;
    }
    /**
     * How their value changed, in minor units of the change's `currency`; null when the platform reported no value.
     *
     * @param int|null $value
     *
     * @return self
     */
    public function setValue(?int $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}