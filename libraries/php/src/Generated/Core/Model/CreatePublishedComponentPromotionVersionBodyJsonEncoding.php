<?php

namespace Voidhash\Generated\Core\Model;

class CreatePublishedComponentPromotionVersionBodyJsonEncoding
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
     * The id of the project component version to publish, `cmp_ver_...`; it must be ready.
     *
     * @var string
     */
    protected $componentVersionId;
    /**
     * The semantic version to publish it as.
     *
     * @var string
     */
    protected $version;
    /**
     * The registry name, the second part of `<publisher>/<name>`; defaults to the component's slug.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The name people see; defaults to the project component's title.
     *
     * @var string|null
     */
    protected $title;
    /**
     * What the component does; defaults to the module definition's description.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The editor group; defaults to the project component's category.
     *
     * @var string|null
     */
    protected $category;
    /**
     * Words people can search for the component by; defaults to none.
     *
     * @var list<string>|null
     */
    protected $keywords;
    /**
     * The id of the project component version to publish, `cmp_ver_...`; it must be ready.
     *
     * @return string
     */
    public function getComponentVersionId(): string
    {
        return $this->componentVersionId;
    }
    /**
     * The id of the project component version to publish, `cmp_ver_...`; it must be ready.
     *
     * @param string $componentVersionId
     *
     * @return self
     */
    public function setComponentVersionId(string $componentVersionId): self
    {
        $this->initialized['componentVersionId'] = true;
        $this->componentVersionId = $componentVersionId;
        return $this;
    }
    /**
     * The semantic version to publish it as.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The semantic version to publish it as.
     *
     * @param string $version
     *
     * @return self
     */
    public function setVersion(string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * The registry name, the second part of `<publisher>/<name>`; defaults to the component's slug.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The registry name, the second part of `<publisher>/<name>`; defaults to the component's slug.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The name people see; defaults to the project component's title.
     *
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * The name people see; defaults to the project component's title.
     *
     * @param string|null $title
     *
     * @return self
     */
    public function setTitle(?string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * What the component does; defaults to the module definition's description.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the component does; defaults to the module definition's description.
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
    /**
     * The editor group; defaults to the project component's category.
     *
     * @return string|null
     */
    public function getCategory(): ?string
    {
        return $this->category;
    }
    /**
     * The editor group; defaults to the project component's category.
     *
     * @param string|null $category
     *
     * @return self
     */
    public function setCategory(?string $category): self
    {
        $this->initialized['category'] = true;
        $this->category = $category;
        return $this;
    }
    /**
     * Words people can search for the component by; defaults to none.
     *
     * @return list<string>|null
     */
    public function getKeywords(): ?array
    {
        return $this->keywords;
    }
    /**
     * Words people can search for the component by; defaults to none.
     *
     * @param list<string>|null $keywords
     *
     * @return self
     */
    public function setKeywords(?array $keywords): self
    {
        $this->initialized['keywords'] = true;
        $this->keywords = $keywords;
        return $this;
    }
}