<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAnalyticsGroupBodyJsonEncoding
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
     * @var array<string, mixed>
     */
    protected $set;
    /**
     * @var array<string, mixed>
     */
    protected $setOnce;
    /**
     * Properties to remove, by key.
     *
     * @var list<string>|null
     */
    protected $unset;
    /**
     * @return array<string, mixed>
     */
    public function getSet(): iterable
    {
        return $this->set;
    }
    /**
     * @param array<string, mixed> $set
     *
     * @return self
     */
    public function setSet(iterable $set): self
    {
        $this->initialized['set'] = true;
        $this->set = $set;
        return $this;
    }
    /**
     * @return array<string, mixed>
     */
    public function getSetOnce(): iterable
    {
        return $this->setOnce;
    }
    /**
     * @param array<string, mixed> $setOnce
     *
     * @return self
     */
    public function setSetOnce(iterable $setOnce): self
    {
        $this->initialized['setOnce'] = true;
        $this->setOnce = $setOnce;
        return $this;
    }
    /**
     * Properties to remove, by key.
     *
     * @return list<string>|null
     */
    public function getUnset(): ?array
    {
        return $this->unset;
    }
    /**
     * Properties to remove, by key.
     *
     * @param list<string>|null $unset
     *
     * @return self
     */
    public function setUnset(?array $unset): self
    {
        $this->initialized['unset'] = true;
        $this->unset = $unset;
        return $this;
    }
}