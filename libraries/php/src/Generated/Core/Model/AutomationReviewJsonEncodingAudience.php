<?php

namespace Voidhash\Generated\Core\Model;

class AutomationReviewJsonEncodingAudience
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
     * How many people.
     *
     * @var int
     */
    protected $count;
    /**
     * Whether `count` is exact rather than an estimate.
     *
     * @var bool
     */
    protected $isExact;
    /**
     * How many people.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many people.
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
     * Whether `count` is exact rather than an estimate.
     *
     * @return bool
     */
    public function getIsExact(): bool
    {
        return $this->isExact;
    }
    /**
     * Whether `count` is exact rather than an estimate.
     *
     * @param bool $isExact
     *
     * @return self
     */
    public function setIsExact(bool $isExact): self
    {
        $this->initialized['isExact'] = true;
        $this->isExact = $isExact;
        return $this;
    }
}