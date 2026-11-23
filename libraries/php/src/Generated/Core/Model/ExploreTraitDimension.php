<?php

namespace Voidhash\Generated\Core\Model;

class ExploreTraitDimension
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
     * @var string
     */
    protected $key;
    /**
     * @var list<float>|null
     */
    protected $bins;
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
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
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
     * @return list<float>|null
     */
    public function getBins(): ?array
    {
        return $this->bins;
    }
    /**
     * @param list<float>|null $bins
     *
     * @return self
     */
    public function setBins(?array $bins): self
    {
        $this->initialized['bins'] = true;
        $this->bins = $bins;
        return $this;
    }
}