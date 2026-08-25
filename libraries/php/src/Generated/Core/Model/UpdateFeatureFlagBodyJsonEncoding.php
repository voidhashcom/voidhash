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
     * @var string|null
     */
    protected $description;
    /**
     * @var bool|null
     */
    protected $enabled;
    /**
     * @var mixed|null
     */
    protected $rolloutBps;
    /**
     * @var string|null
     */
    protected $slug;
    /**
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
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
    /**
     * @return bool|null
     */
    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }
    /**
     * @param bool|null $enabled
     *
     * @return self
     */
    public function setEnabled(?bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getRolloutBps()
    {
        return $this->rolloutBps;
    }
    /**
     * @param mixed $rolloutBps
     *
     * @return self
     */
    public function setRolloutBps($rolloutBps): self
    {
        $this->initialized['rolloutBps'] = true;
        $this->rolloutBps = $rolloutBps;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getSlug(): ?string
    {
        return $this->slug;
    }
    /**
     * @param string|null $slug
     *
     * @return self
     */
    public function setSlug(?string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
}