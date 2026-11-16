<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsTraitDimension
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
     * Ascending bounds that group a numeric trait, such as `[18, 25, 35]` for under 18, 18–24, 25–34 and 35 and over.
     *
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
     * Ascending bounds that group a numeric trait, such as `[18, 25, 35]` for under 18, 18–24, 25–34 and 35 and over.
     *
     * @return list<float>|null
     */
    public function getBins(): ?array
    {
        return $this->bins;
    }
    /**
     * Ascending bounds that group a numeric trait, such as `[18, 25, 35]` for under 18, 18–24, 25–34 and 35 and over.
     *
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