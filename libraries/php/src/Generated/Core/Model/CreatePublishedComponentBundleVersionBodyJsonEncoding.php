<?php

namespace Voidhash\Generated\Core\Model;

class CreatePublishedComponentBundleVersionBodyJsonEncoding
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
     * The text of `component.json`, at most 64 KiB. Its id must be `<namespace>/<name>` in the organization's namespace and its version a semantic version.
     *
     * @var string
     */
    protected $definitionJson;
    /**
     * The component module (`module.wasm`), base64 encoded.
     *
     * @var string
     */
    protected $moduleBase64;
    /**
     * The editor panel module (`panel.wasm`), base64 encoded. Required exactly when the definition declares `"panel": true`.
     *
     * @var string|null
     */
    protected $panelBase64;
    /**
     * An image a component bundle ships, base64 encoded, with its media type.
     *
     * @var PublishedComponentBundleFile
     */
    protected $icon;
    /**
     * At most one preview image per preview state.
     *
     * @var list<PublishedComponentThumbnail>|null
     */
    protected $thumbnails;
    /**
     * Markdown documentation people read before installing, at most 128 KiB.
     *
     * @var string|null
     */
    protected $readme;
    /**
     * Markdown guidance the Voidhash agent reads before using the component, at most 32 KiB.
     *
     * @var string|null
     */
    protected $agentGuide;
    /**
     * The text of `component.json`, at most 64 KiB. Its id must be `<namespace>/<name>` in the organization's namespace and its version a semantic version.
     *
     * @return string
     */
    public function getDefinitionJson(): string
    {
        return $this->definitionJson;
    }
    /**
     * The text of `component.json`, at most 64 KiB. Its id must be `<namespace>/<name>` in the organization's namespace and its version a semantic version.
     *
     * @param string $definitionJson
     *
     * @return self
     */
    public function setDefinitionJson(string $definitionJson): self
    {
        $this->initialized['definitionJson'] = true;
        $this->definitionJson = $definitionJson;
        return $this;
    }
    /**
     * The component module (`module.wasm`), base64 encoded.
     *
     * @return string
     */
    public function getModuleBase64(): string
    {
        return $this->moduleBase64;
    }
    /**
     * The component module (`module.wasm`), base64 encoded.
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
     * The editor panel module (`panel.wasm`), base64 encoded. Required exactly when the definition declares `"panel": true`.
     *
     * @return string|null
     */
    public function getPanelBase64(): ?string
    {
        return $this->panelBase64;
    }
    /**
     * The editor panel module (`panel.wasm`), base64 encoded. Required exactly when the definition declares `"panel": true`.
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
    /**
     * An image a component bundle ships, base64 encoded, with its media type.
     *
     * @return PublishedComponentBundleFile
     */
    public function getIcon(): PublishedComponentBundleFile
    {
        return $this->icon;
    }
    /**
     * An image a component bundle ships, base64 encoded, with its media type.
     *
     * @param PublishedComponentBundleFile $icon
     *
     * @return self
     */
    public function setIcon(PublishedComponentBundleFile $icon): self
    {
        $this->initialized['icon'] = true;
        $this->icon = $icon;
        return $this;
    }
    /**
     * At most one preview image per preview state.
     *
     * @return list<PublishedComponentThumbnail>|null
     */
    public function getThumbnails(): ?array
    {
        return $this->thumbnails;
    }
    /**
     * At most one preview image per preview state.
     *
     * @param list<PublishedComponentThumbnail>|null $thumbnails
     *
     * @return self
     */
    public function setThumbnails(?array $thumbnails): self
    {
        $this->initialized['thumbnails'] = true;
        $this->thumbnails = $thumbnails;
        return $this;
    }
    /**
     * Markdown documentation people read before installing, at most 128 KiB.
     *
     * @return string|null
     */
    public function getReadme(): ?string
    {
        return $this->readme;
    }
    /**
     * Markdown documentation people read before installing, at most 128 KiB.
     *
     * @param string|null $readme
     *
     * @return self
     */
    public function setReadme(?string $readme): self
    {
        $this->initialized['readme'] = true;
        $this->readme = $readme;
        return $this;
    }
    /**
     * Markdown guidance the Voidhash agent reads before using the component, at most 32 KiB.
     *
     * @return string|null
     */
    public function getAgentGuide(): ?string
    {
        return $this->agentGuide;
    }
    /**
     * Markdown guidance the Voidhash agent reads before using the component, at most 32 KiB.
     *
     * @param string|null $agentGuide
     *
     * @return self
     */
    public function setAgentGuide(?string $agentGuide): self
    {
        $this->initialized['agentGuide'] = true;
        $this->agentGuide = $agentGuide;
        return $this;
    }
}