<?php

namespace Voidhash\Generated\Core\Model;

class DevSessionComponentJsonEncoding
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
     * The component's slug in the project.
     *
     * @var string
     */
    protected $slug;
    /**
     * The id placed instances name the component by, `project/<slug>`.
     *
     * @var string
     */
    protected $definitionId;
    /**
     * The name the editor shows.
     *
     * @var string
     */
    protected $title;
    /**
     * `server` for a component pulled from the project, `local` for one only the run's working copy has.
     *
     * @var string
     */
    protected $origin;
    /**
     * The project version the local source is based on.
     *
     * @var int
     */
    protected $baseVersion;
    /**
     * The newest project version `voidhash-cli publish` created from the local source.
     *
     * @var int
     */
    protected $publishedVersion;
    /**
     * Whether the local source differs from `baseVersion`.
     *
     * @var bool
     */
    protected $isModified;
    /**
     * Whether merging a newer project version left conflict markers in the local source.
     *
     * @var bool
     */
    protected $isConflicted;
    /**
     * The run's newest build of the component.
     *
     * @var DevSessionBuild
     */
    protected $build;
    /**
     * The SHA-256 of the last successfully built module, in hex.
     *
     * @var string
     */
    protected $moduleHash;
    /**
     * The SHA-256 of the last successfully built editor panel module, in hex.
     *
     * @var string
     */
    protected $panelHash;
    /**
     * The component definition of the last successful build.
     *
     * @var mixed
     */
    protected $definition;
    /**
     * The component's slug in the project.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The component's slug in the project.
     *
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
     * The id placed instances name the component by, `project/<slug>`.
     *
     * @return string
     */
    public function getDefinitionId(): string
    {
        return $this->definitionId;
    }
    /**
     * The id placed instances name the component by, `project/<slug>`.
     *
     * @param string $definitionId
     *
     * @return self
     */
    public function setDefinitionId(string $definitionId): self
    {
        $this->initialized['definitionId'] = true;
        $this->definitionId = $definitionId;
        return $this;
    }
    /**
     * The name the editor shows.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The name the editor shows.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * `server` for a component pulled from the project, `local` for one only the run's working copy has.
     *
     * @return string
     */
    public function getOrigin(): string
    {
        return $this->origin;
    }
    /**
     * `server` for a component pulled from the project, `local` for one only the run's working copy has.
     *
     * @param string $origin
     *
     * @return self
     */
    public function setOrigin(string $origin): self
    {
        $this->initialized['origin'] = true;
        $this->origin = $origin;
        return $this;
    }
    /**
     * The project version the local source is based on.
     *
     * @return int
     */
    public function getBaseVersion(): int
    {
        return $this->baseVersion;
    }
    /**
     * The project version the local source is based on.
     *
     * @param int $baseVersion
     *
     * @return self
     */
    public function setBaseVersion(int $baseVersion): self
    {
        $this->initialized['baseVersion'] = true;
        $this->baseVersion = $baseVersion;
        return $this;
    }
    /**
     * The newest project version `voidhash-cli publish` created from the local source.
     *
     * @return int
     */
    public function getPublishedVersion(): int
    {
        return $this->publishedVersion;
    }
    /**
     * The newest project version `voidhash-cli publish` created from the local source.
     *
     * @param int $publishedVersion
     *
     * @return self
     */
    public function setPublishedVersion(int $publishedVersion): self
    {
        $this->initialized['publishedVersion'] = true;
        $this->publishedVersion = $publishedVersion;
        return $this;
    }
    /**
     * Whether the local source differs from `baseVersion`.
     *
     * @return bool
     */
    public function getIsModified(): bool
    {
        return $this->isModified;
    }
    /**
     * Whether the local source differs from `baseVersion`.
     *
     * @param bool $isModified
     *
     * @return self
     */
    public function setIsModified(bool $isModified): self
    {
        $this->initialized['isModified'] = true;
        $this->isModified = $isModified;
        return $this;
    }
    /**
     * Whether merging a newer project version left conflict markers in the local source.
     *
     * @return bool
     */
    public function getIsConflicted(): bool
    {
        return $this->isConflicted;
    }
    /**
     * Whether merging a newer project version left conflict markers in the local source.
     *
     * @param bool $isConflicted
     *
     * @return self
     */
    public function setIsConflicted(bool $isConflicted): self
    {
        $this->initialized['isConflicted'] = true;
        $this->isConflicted = $isConflicted;
        return $this;
    }
    /**
     * The run's newest build of the component.
     *
     * @return DevSessionBuild
     */
    public function getBuild(): DevSessionBuild
    {
        return $this->build;
    }
    /**
     * The run's newest build of the component.
     *
     * @param DevSessionBuild $build
     *
     * @return self
     */
    public function setBuild(DevSessionBuild $build): self
    {
        $this->initialized['build'] = true;
        $this->build = $build;
        return $this;
    }
    /**
     * The SHA-256 of the last successfully built module, in hex.
     *
     * @return string
     */
    public function getModuleHash(): string
    {
        return $this->moduleHash;
    }
    /**
     * The SHA-256 of the last successfully built module, in hex.
     *
     * @param string $moduleHash
     *
     * @return self
     */
    public function setModuleHash(string $moduleHash): self
    {
        $this->initialized['moduleHash'] = true;
        $this->moduleHash = $moduleHash;
        return $this;
    }
    /**
     * The SHA-256 of the last successfully built editor panel module, in hex.
     *
     * @return string
     */
    public function getPanelHash(): string
    {
        return $this->panelHash;
    }
    /**
     * The SHA-256 of the last successfully built editor panel module, in hex.
     *
     * @param string $panelHash
     *
     * @return self
     */
    public function setPanelHash(string $panelHash): self
    {
        $this->initialized['panelHash'] = true;
        $this->panelHash = $panelHash;
        return $this;
    }
    /**
     * The component definition of the last successful build.
     *
     * @return mixed
     */
    public function getDefinition()
    {
        return $this->definition;
    }
    /**
     * The component definition of the last successful build.
     *
     * @param mixed $definition
     *
     * @return self
     */
    public function setDefinition($definition): self
    {
        $this->initialized['definition'] = true;
        $this->definition = $definition;
        return $this;
    }
}