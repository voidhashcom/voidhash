<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagJsonEncoding1
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
    protected $archivedAt;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $description;
    /**
     * @var bool
     */
    protected $enabled;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var list<FeatureFlagOverrideJsonEncoding>
     */
    protected $overrides;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var mixed
     */
    protected $rolloutBps;
    /**
     * @var string
     */
    protected $slug;
    /**
     * @var list<FeatureFlagTargetJsonEncoding>
     */
    protected $targets;
    /**
     * @var string
     */
    protected $type;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @var list<FeatureFlagVariantJsonEncoding>
     */
    protected $variants;
    /**
     * @var mixed
     */
    protected $version;
    /**
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
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
     * @return bool
     */
    public function getEnabled(): bool
    {
        return $this->enabled;
    }
    /**
     * @param bool $enabled
     *
     * @return self
     */
    public function setEnabled(bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * @return list<FeatureFlagOverrideJsonEncoding>
     */
    public function getOverrides(): array
    {
        return $this->overrides;
    }
    /**
     * @param list<FeatureFlagOverrideJsonEncoding> $overrides
     *
     * @return self
     */
    public function setOverrides(array $overrides): self
    {
        $this->initialized['overrides'] = true;
        $this->overrides = $overrides;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
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
     * @return list<FeatureFlagTargetJsonEncoding>
     */
    public function getTargets(): array
    {
        return $this->targets;
    }
    /**
     * @param list<FeatureFlagTargetJsonEncoding> $targets
     *
     * @return self
     */
    public function setTargets(array $targets): self
    {
        $this->initialized['targets'] = true;
        $this->targets = $targets;
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
    /**
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
    /**
     * @return list<FeatureFlagVariantJsonEncoding>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * @param list<FeatureFlagVariantJsonEncoding> $variants
     *
     * @return self
     */
    public function setVariants(array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getVersion()
    {
        return $this->version;
    }
    /**
     * @param mixed $version
     *
     * @return self
     */
    public function setVersion($version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
}