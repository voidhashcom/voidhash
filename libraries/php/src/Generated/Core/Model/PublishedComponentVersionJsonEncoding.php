<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentVersionJsonEncoding
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
     * The version's id, `cmp_pkg_ver_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The id of the registry component the version belongs to, `cmp_pkg_...`.
     *
     * @var string
     */
    protected $registryComponentId;
    /**
     * The semantic version, from the definition.
     *
     * @var string
     */
    protected $version;
    /**
     * The version number, counting the component's versions from 1 in publishing order; placed instances pin it.
     *
     * @var int
     */
    protected $number;
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @var string
     */
    protected $status;
    /**
     * Why the version was deprecated or yanked, for installers; null when none.
     *
     * @var string|null
     */
    protected $statusMessage;
    /**
     * The SHA-256 of the whole bundle, in hex; publishing the same bundle again returns this version.
     *
     * @var string
     */
    protected $bundleHash;
    /**
     * The SHA-256 of the module, in hex; placed instances pin it.
     *
     * @var string
     */
    protected $contentHash;
    /**
     * The module's size in bytes.
     *
     * @var int
     */
    protected $byteSize;
    /**
     * What the component can do for the person using your app: `commerce`, `links`, `analytics`, `navigation` or `haptics`. Installing asks to accept them.
     *
     * @var list<string>
     */
    protected $capabilities;
    /**
     * The version's component definition, the contents of `component.json`.
     *
     * @var mixed
     */
    protected $definition;
    /**
     * The module's `vh.manifest` JSON.
     *
     * @var mixed
     */
    protected $manifest;
    /**
     * Whether the version ships an editor panel module.
     *
     * @var bool
     */
    protected $hasPanel;
    /**
     * Whether the version ships an icon.
     *
     * @var bool
     */
    protected $hasIcon;
    /**
     * Whether the version ships a README.
     *
     * @var bool
     */
    protected $hasReadme;
    /**
     * Whether the version ships an agent guide (`agent.md`).
     *
     * @var bool
     */
    protected $hasAgentGuide;
    /**
     * The preview states the version ships a thumbnail for.
     *
     * @var list<string>
     */
    protected $thumbnailStates;
    /**
     * What the server could not check or store for the version.
     *
     * @var list<string>
     */
    protected $warnings;
    /**
     * What the component conformance suite found on a module, and the `panel` check on its editor panel module.
     *
     * @var ComponentConformanceResult
     */
    protected $conformance;
    /**
     * How many projects of the organization have their install pinned to this version.
     *
     * @var int
     */
    protected $installCount;
    /**
     * How many published paywalls of the organization embed this version.
     *
     * @var int
     */
    protected $publishedPaywallCount;
    /**
     * Who published the version: the id of the signed-in person, or the name of the API key.
     *
     * @var string
     */
    protected $createdBy;
    /**
     * When the version was published, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $publishedAt;
    /**
     * The version's id, `cmp_pkg_ver_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The version's id, `cmp_pkg_ver_...`.
     *
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
     * The id of the registry component the version belongs to, `cmp_pkg_...`.
     *
     * @return string
     */
    public function getRegistryComponentId(): string
    {
        return $this->registryComponentId;
    }
    /**
     * The id of the registry component the version belongs to, `cmp_pkg_...`.
     *
     * @param string $registryComponentId
     *
     * @return self
     */
    public function setRegistryComponentId(string $registryComponentId): self
    {
        $this->initialized['registryComponentId'] = true;
        $this->registryComponentId = $registryComponentId;
        return $this;
    }
    /**
     * The semantic version, from the definition.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The semantic version, from the definition.
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
     * The version number, counting the component's versions from 1 in publishing order; placed instances pin it.
     *
     * @return int
     */
    public function getNumber(): int
    {
        return $this->number;
    }
    /**
     * The version number, counting the component's versions from 1 in publishing order; placed instances pin it.
     *
     * @param int $number
     *
     * @return self
     */
    public function setNumber(int $number): self
    {
        $this->initialized['number'] = true;
        $this->number = $number;
        return $this;
    }
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * Why the version was deprecated or yanked, for installers; null when none.
     *
     * @return string|null
     */
    public function getStatusMessage(): ?string
    {
        return $this->statusMessage;
    }
    /**
     * Why the version was deprecated or yanked, for installers; null when none.
     *
     * @param string|null $statusMessage
     *
     * @return self
     */
    public function setStatusMessage(?string $statusMessage): self
    {
        $this->initialized['statusMessage'] = true;
        $this->statusMessage = $statusMessage;
        return $this;
    }
    /**
     * The SHA-256 of the whole bundle, in hex; publishing the same bundle again returns this version.
     *
     * @return string
     */
    public function getBundleHash(): string
    {
        return $this->bundleHash;
    }
    /**
     * The SHA-256 of the whole bundle, in hex; publishing the same bundle again returns this version.
     *
     * @param string $bundleHash
     *
     * @return self
     */
    public function setBundleHash(string $bundleHash): self
    {
        $this->initialized['bundleHash'] = true;
        $this->bundleHash = $bundleHash;
        return $this;
    }
    /**
     * The SHA-256 of the module, in hex; placed instances pin it.
     *
     * @return string
     */
    public function getContentHash(): string
    {
        return $this->contentHash;
    }
    /**
     * The SHA-256 of the module, in hex; placed instances pin it.
     *
     * @param string $contentHash
     *
     * @return self
     */
    public function setContentHash(string $contentHash): self
    {
        $this->initialized['contentHash'] = true;
        $this->contentHash = $contentHash;
        return $this;
    }
    /**
     * The module's size in bytes.
     *
     * @return int
     */
    public function getByteSize(): int
    {
        return $this->byteSize;
    }
    /**
     * The module's size in bytes.
     *
     * @param int $byteSize
     *
     * @return self
     */
    public function setByteSize(int $byteSize): self
    {
        $this->initialized['byteSize'] = true;
        $this->byteSize = $byteSize;
        return $this;
    }
    /**
     * What the component can do for the person using your app: `commerce`, `links`, `analytics`, `navigation` or `haptics`. Installing asks to accept them.
     *
     * @return list<string>
     */
    public function getCapabilities(): array
    {
        return $this->capabilities;
    }
    /**
     * What the component can do for the person using your app: `commerce`, `links`, `analytics`, `navigation` or `haptics`. Installing asks to accept them.
     *
     * @param list<string> $capabilities
     *
     * @return self
     */
    public function setCapabilities(array $capabilities): self
    {
        $this->initialized['capabilities'] = true;
        $this->capabilities = $capabilities;
        return $this;
    }
    /**
     * The version's component definition, the contents of `component.json`.
     *
     * @return mixed
     */
    public function getDefinition()
    {
        return $this->definition;
    }
    /**
     * The version's component definition, the contents of `component.json`.
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
    /**
     * The module's `vh.manifest` JSON.
     *
     * @return mixed
     */
    public function getManifest()
    {
        return $this->manifest;
    }
    /**
     * The module's `vh.manifest` JSON.
     *
     * @param mixed $manifest
     *
     * @return self
     */
    public function setManifest($manifest): self
    {
        $this->initialized['manifest'] = true;
        $this->manifest = $manifest;
        return $this;
    }
    /**
     * Whether the version ships an editor panel module.
     *
     * @return bool
     */
    public function getHasPanel(): bool
    {
        return $this->hasPanel;
    }
    /**
     * Whether the version ships an editor panel module.
     *
     * @param bool $hasPanel
     *
     * @return self
     */
    public function setHasPanel(bool $hasPanel): self
    {
        $this->initialized['hasPanel'] = true;
        $this->hasPanel = $hasPanel;
        return $this;
    }
    /**
     * Whether the version ships an icon.
     *
     * @return bool
     */
    public function getHasIcon(): bool
    {
        return $this->hasIcon;
    }
    /**
     * Whether the version ships an icon.
     *
     * @param bool $hasIcon
     *
     * @return self
     */
    public function setHasIcon(bool $hasIcon): self
    {
        $this->initialized['hasIcon'] = true;
        $this->hasIcon = $hasIcon;
        return $this;
    }
    /**
     * Whether the version ships a README.
     *
     * @return bool
     */
    public function getHasReadme(): bool
    {
        return $this->hasReadme;
    }
    /**
     * Whether the version ships a README.
     *
     * @param bool $hasReadme
     *
     * @return self
     */
    public function setHasReadme(bool $hasReadme): self
    {
        $this->initialized['hasReadme'] = true;
        $this->hasReadme = $hasReadme;
        return $this;
    }
    /**
     * Whether the version ships an agent guide (`agent.md`).
     *
     * @return bool
     */
    public function getHasAgentGuide(): bool
    {
        return $this->hasAgentGuide;
    }
    /**
     * Whether the version ships an agent guide (`agent.md`).
     *
     * @param bool $hasAgentGuide
     *
     * @return self
     */
    public function setHasAgentGuide(bool $hasAgentGuide): self
    {
        $this->initialized['hasAgentGuide'] = true;
        $this->hasAgentGuide = $hasAgentGuide;
        return $this;
    }
    /**
     * The preview states the version ships a thumbnail for.
     *
     * @return list<string>
     */
    public function getThumbnailStates(): array
    {
        return $this->thumbnailStates;
    }
    /**
     * The preview states the version ships a thumbnail for.
     *
     * @param list<string> $thumbnailStates
     *
     * @return self
     */
    public function setThumbnailStates(array $thumbnailStates): self
    {
        $this->initialized['thumbnailStates'] = true;
        $this->thumbnailStates = $thumbnailStates;
        return $this;
    }
    /**
     * What the server could not check or store for the version.
     *
     * @return list<string>
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
    /**
     * What the server could not check or store for the version.
     *
     * @param list<string> $warnings
     *
     * @return self
     */
    public function setWarnings(array $warnings): self
    {
        $this->initialized['warnings'] = true;
        $this->warnings = $warnings;
        return $this;
    }
    /**
     * What the component conformance suite found on a module, and the `panel` check on its editor panel module.
     *
     * @return ComponentConformanceResult
     */
    public function getConformance(): ComponentConformanceResult
    {
        return $this->conformance;
    }
    /**
     * What the component conformance suite found on a module, and the `panel` check on its editor panel module.
     *
     * @param ComponentConformanceResult $conformance
     *
     * @return self
     */
    public function setConformance(ComponentConformanceResult $conformance): self
    {
        $this->initialized['conformance'] = true;
        $this->conformance = $conformance;
        return $this;
    }
    /**
     * How many projects of the organization have their install pinned to this version.
     *
     * @return int
     */
    public function getInstallCount(): int
    {
        return $this->installCount;
    }
    /**
     * How many projects of the organization have their install pinned to this version.
     *
     * @param int $installCount
     *
     * @return self
     */
    public function setInstallCount(int $installCount): self
    {
        $this->initialized['installCount'] = true;
        $this->installCount = $installCount;
        return $this;
    }
    /**
     * How many published paywalls of the organization embed this version.
     *
     * @return int
     */
    public function getPublishedPaywallCount(): int
    {
        return $this->publishedPaywallCount;
    }
    /**
     * How many published paywalls of the organization embed this version.
     *
     * @param int $publishedPaywallCount
     *
     * @return self
     */
    public function setPublishedPaywallCount(int $publishedPaywallCount): self
    {
        $this->initialized['publishedPaywallCount'] = true;
        $this->publishedPaywallCount = $publishedPaywallCount;
        return $this;
    }
    /**
     * Who published the version: the id of the signed-in person, or the name of the API key.
     *
     * @return string
     */
    public function getCreatedBy(): string
    {
        return $this->createdBy;
    }
    /**
     * Who published the version: the id of the signed-in person, or the name of the API key.
     *
     * @param string $createdBy
     *
     * @return self
     */
    public function setCreatedBy(string $createdBy): self
    {
        $this->initialized['createdBy'] = true;
        $this->createdBy = $createdBy;
        return $this;
    }
    /**
     * When the version was published, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getPublishedAt(): string
    {
        return $this->publishedAt;
    }
    /**
     * When the version was published, as an ISO 8601 timestamp.
     *
     * @param string $publishedAt
     *
     * @return self
     */
    public function setPublishedAt(string $publishedAt): self
    {
        $this->initialized['publishedAt'] = true;
        $this->publishedAt = $publishedAt;
        return $this;
    }
}