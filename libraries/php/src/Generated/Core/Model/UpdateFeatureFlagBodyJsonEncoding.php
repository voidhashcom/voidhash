<?php

namespace Voidhash\Generated\Core\Model;

class UpdateFeatureFlagBodyJsonEncoding
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
     * The new key; apps asking for the old one stop receiving the flag.
     *
     * @var string|null
     */
    protected $key;
    /**
     * The new description; null clears it.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The new key; apps asking for the old one stop receiving the flag.
     *
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
     * The new key; apps asking for the old one stop receiving the flag.
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
     * The new description; null clears it.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new description; null clears it.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
}