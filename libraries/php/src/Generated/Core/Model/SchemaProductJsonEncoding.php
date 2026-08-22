<?php

namespace Voidhash\Generated\Core\Model;

class SchemaProductJsonEncoding
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
     * @var string|null
     */
    protected $duration;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var list<string>
     */
    protected $perks;
    /**
     * @var list<SchemaProductProviderJsonEncoding>
     */
    protected $providers;
    /**
     * @var string
     */
    protected $slug;
    /**
     * @var string
     */
    protected $type;
    /**
     * @return string|null
     */
    public function getDuration(): ?string
    {
        return $this->duration;
    }
    /**
     * @param string|null $duration
     *
     * @return self
     */
    public function setDuration(?string $duration): self
    {
        $this->initialized['duration'] = true;
        $this->duration = $duration;
        return $this;
    }
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getPerks(): array
    {
        return $this->perks;
    }
    /**
     * @param list<string> $perks
     *
     * @return self
     */
    public function setPerks(array $perks): self
    {
        $this->initialized['perks'] = true;
        $this->perks = $perks;
        return $this;
    }
    /**
     * @return list<SchemaProductProviderJsonEncoding>
     */
    public function getProviders(): array
    {
        return $this->providers;
    }
    /**
     * @param list<SchemaProductProviderJsonEncoding> $providers
     *
     * @return self
     */
    public function setProviders(array $providers): self
    {
        $this->initialized['providers'] = true;
        $this->providers = $providers;
        return $this;
    }
    /**
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}