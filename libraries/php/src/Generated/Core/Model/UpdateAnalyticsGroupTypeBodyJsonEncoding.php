<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAnalyticsGroupTypeBodyJsonEncoding
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
     * What one group is called; null reads from the key again.
     *
     * @var string|null
     */
    protected $nameSingular;
    /**
     * What several groups are called; null reads from the key again.
     *
     * @var string|null
     */
    protected $namePlural;
    /**
     * What one group is called; null reads from the key again.
     *
     * @return string|null
     */
    public function getNameSingular(): ?string
    {
        return $this->nameSingular;
    }
    /**
     * What one group is called; null reads from the key again.
     *
     * @param string|null $nameSingular
     *
     * @return self
     */
    public function setNameSingular(?string $nameSingular): self
    {
        $this->initialized['nameSingular'] = true;
        $this->nameSingular = $nameSingular;
        return $this;
    }
    /**
     * What several groups are called; null reads from the key again.
     *
     * @return string|null
     */
    public function getNamePlural(): ?string
    {
        return $this->namePlural;
    }
    /**
     * What several groups are called; null reads from the key again.
     *
     * @param string|null $namePlural
     *
     * @return self
     */
    public function setNamePlural(?string $namePlural): self
    {
        $this->initialized['namePlural'] = true;
        $this->namePlural = $namePlural;
        return $this;
    }
}