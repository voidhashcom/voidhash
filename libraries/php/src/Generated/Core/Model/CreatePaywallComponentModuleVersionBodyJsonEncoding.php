<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallComponentModuleVersionBodyJsonEncoding
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
     * The slug of the component to add the version to, created when the project has none; defaults to the manifest's name.
     *
     * @var string|null
     */
    protected $slug;
    /**
     * The component's title; defaults to the manifest's title, and renames an existing component when it differs.
     *
     * @var string|null
     */
    protected $title;
    /**
     * The prebuilt WebAssembly module, base64 encoded, at most 2 MiB, carrying a valid `vh.manifest` section.
     *
     * @var string
     */
    protected $moduleBase64;
    /**
     * The editor panel module (the crate built with its `panel` feature), base64 encoded. Required when the definition declares a panel.
     *
     * @var string|null
     */
    protected $panelBase64;
    /**
     * The slug of the component to add the version to, created when the project has none; defaults to the manifest's name.
     *
     * @return string|null
     */
    public function getSlug(): ?string
    {
        return $this->slug;
    }
    /**
     * The slug of the component to add the version to, created when the project has none; defaults to the manifest's name.
     *
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
    /**
     * The component's title; defaults to the manifest's title, and renames an existing component when it differs.
     *
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * The component's title; defaults to the manifest's title, and renames an existing component when it differs.
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
     * The prebuilt WebAssembly module, base64 encoded, at most 2 MiB, carrying a valid `vh.manifest` section.
     *
     * @return string
     */
    public function getModuleBase64(): string
    {
        return $this->moduleBase64;
    }
    /**
     * The prebuilt WebAssembly module, base64 encoded, at most 2 MiB, carrying a valid `vh.manifest` section.
     *
     * @param string $moduleBase64
     *
     * @return self
     */
    public function setModuleBase64(string $moduleBase64): self
    {
        $this->initialized['moduleBase64'] = true;
        $this->moduleBase64 = $moduleBase64;
        return $this;
    }
    /**
     * The editor panel module (the crate built with its `panel` feature), base64 encoded. Required when the definition declares a panel.
     *
     * @return string|null
     */
    public function getPanelBase64(): ?string
    {
        return $this->panelBase64;
    }
    /**
     * The editor panel module (the crate built with its `panel` feature), base64 encoded. Required when the definition declares a panel.
     *
     * @param string|null $panelBase64
     *
     * @return self
     */
    public function setPanelBase64(?string $panelBase64): self
    {
        $this->initialized['panelBase64'] = true;
        $this->panelBase64 = $panelBase64;
        return $this;
    }
}