<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncoding
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
     * @var SdkSchemaProductJsonEncodingConfiguration
     */
    protected $configuration;
    /**
     * @var SdkSchemaProductJsonEncodingProperties
     */
    protected $properties;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $duration;
    /**
     * @var string
     */
    protected $slug;
    /**
     * @var string
     */
    protected $type;
    /**
     * @return SdkSchemaProductJsonEncodingConfiguration
     */
    public function getConfiguration(): SdkSchemaProductJsonEncodingConfiguration
    {
        return $this->configuration;
    }
    /**
     * @param SdkSchemaProductJsonEncodingConfiguration $configuration
     *
     * @return self
     */
    public function setConfiguration(SdkSchemaProductJsonEncodingConfiguration $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
    /**
     * @return SdkSchemaProductJsonEncodingProperties
     */
    public function getProperties(): SdkSchemaProductJsonEncodingProperties
    {
        return $this->properties;
    }
    /**
     * @param SdkSchemaProductJsonEncodingProperties $properties
     *
     * @return self
     */
    public function setProperties(SdkSchemaProductJsonEncodingProperties $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
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