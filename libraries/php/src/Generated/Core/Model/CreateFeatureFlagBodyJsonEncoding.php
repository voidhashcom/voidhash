<?php

namespace Voidhash\Generated\Core\Model;

class CreateFeatureFlagBodyJsonEncoding
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
     * @var string|null
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $slug;
    /**
     * @var string|null
     */
    protected $type;
    /**
     * @var list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null
     */
    protected $variants;
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
     * @return string|null
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }
    /**
     * @param string|null $projectId
     *
     * @return self
     */
    public function setProjectId(?string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
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
     * @return string|null
     */
    public function getType(): ?string
    {
        return $this->type;
    }
    /**
     * @param string|null $type
     *
     * @return self
     */
    public function setType(?string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * @return list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null
     */
    public function getVariants(): ?array
    {
        return $this->variants;
    }
    /**
     * @param list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null $variants
     *
     * @return self
     */
    public function setVariants(?array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
}