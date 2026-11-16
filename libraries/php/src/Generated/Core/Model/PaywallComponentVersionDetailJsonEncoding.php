<?php

namespace Voidhash\Generated\Core\Model;

class PaywallComponentVersionDetailJsonEncoding
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
     * The version's id, `cmp_ver_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The id of the component the version belongs to, `cmp_...`.
     *
     * @var string
     */
    protected $componentId;
    /**
     * The version number, counting the component's versions from 1; placed instances pin it.
     *
     * @var int
     */
    protected $version;
    /**
     * Where the version came from: `wasm` for an uploaded prebuilt module, `rust` for a crate the server builds.
     *
     * @var string
     */
    protected $sourceKind;
    /**
     * The build status. Uploaded modules are `ready` at once; Rust sources move from `queued` through `building` to `ready` or `failed`.
     *
     * @var string
     */
    protected $status;
    /**
     * The SHA-256 of the module, in hex; placed instances pin it. Null until the version is built.
     *
     * @var string|null
     */
    protected $contentHash;
    /**
     * The SHA-256 of the editor panel module, in hex; null when the definition declares no panel or it is not built yet.
     *
     * @var string|null
     */
    protected $panelHash;
    /**
     * The module's size in bytes; null until the version is built.
     *
     * @var int|null
     */
    protected $byteSize;
    /**
     * The module's `vh.manifest` JSON: an ABI 2 module's component definition, or an ABI 1 manifest. Null until the version is built.
     *
     * @var mixed|null
     */
    protected $manifest;
    /**
     * Whether the version is deprecated: it cannot be newly inserted or published.
     *
     * @var bool
     */
    protected $isDeprecated;
    /**
     * When the version was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @var string|null
     */
    protected $deprecatedAt;
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
     * Who created the version: the id of the signed-in person, or the name of the API key.
     *
     * @var string
     */
    protected $createdBy;
    /**
     * When the version was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the module was built or uploaded, as an ISO 8601 timestamp; null until then.
     *
     * @var string|null
     */
    protected $builtAt;
    /**
     * The build's output; null for uploaded modules and until a build finishes.
     *
     * @var string|null
     */
    protected $buildLog;
    /**
     * The crate's files, keyed by path such as `src/lib.rs`; null for uploaded modules.
     *
     * @var array<string, string>|null
     */
    protected $sourceFiles;
    /**
     * The version's id, `cmp_ver_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The version's id, `cmp_ver_...`.
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
     * The id of the component the version belongs to, `cmp_...`.
     *
     * @return string
     */
    public function getComponentId(): string
    {
        return $this->componentId;
    }
    /**
     * The id of the component the version belongs to, `cmp_...`.
     *
     * @param string $componentId
     *
     * @return self
     */
    public function setComponentId(string $componentId): self
    {
        $this->initialized['componentId'] = true;
        $this->componentId = $componentId;
        return $this;
    }
    /**
     * The version number, counting the component's versions from 1; placed instances pin it.
     *
     * @return int
     */
    public function getVersion(): int
    {
        return $this->version;
    }
    /**
     * The version number, counting the component's versions from 1; placed instances pin it.
     *
     * @param int $version
     *
     * @return self
     */
    public function setVersion(int $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * Where the version came from: `wasm` for an uploaded prebuilt module, `rust` for a crate the server builds.
     *
     * @return string
     */
    public function getSourceKind(): string
    {
        return $this->sourceKind;
    }
    /**
     * Where the version came from: `wasm` for an uploaded prebuilt module, `rust` for a crate the server builds.
     *
     * @param string $sourceKind
     *
     * @return self
     */
    public function setSourceKind(string $sourceKind): self
    {
        $this->initialized['sourceKind'] = true;
        $this->sourceKind = $sourceKind;
        return $this;
    }
    /**
     * The build status. Uploaded modules are `ready` at once; Rust sources move from `queued` through `building` to `ready` or `failed`.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * The build status. Uploaded modules are `ready` at once; Rust sources move from `queued` through `building` to `ready` or `failed`.
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
     * The SHA-256 of the module, in hex; placed instances pin it. Null until the version is built.
     *
     * @return string|null
     */
    public function getContentHash(): ?string
    {
        return $this->contentHash;
    }
    /**
     * The SHA-256 of the module, in hex; placed instances pin it. Null until the version is built.
     *
     * @param string|null $contentHash
     *
     * @return self
     */
    public function setContentHash(?string $contentHash): self
    {
        $this->initialized['contentHash'] = true;
        $this->contentHash = $contentHash;
        return $this;
    }
    /**
     * The SHA-256 of the editor panel module, in hex; null when the definition declares no panel or it is not built yet.
     *
     * @return string|null
     */
    public function getPanelHash(): ?string
    {
        return $this->panelHash;
    }
    /**
     * The SHA-256 of the editor panel module, in hex; null when the definition declares no panel or it is not built yet.
     *
     * @param string|null $panelHash
     *
     * @return self
     */
    public function setPanelHash(?string $panelHash): self
    {
        $this->initialized['panelHash'] = true;
        $this->panelHash = $panelHash;
        return $this;
    }
    /**
     * The module's size in bytes; null until the version is built.
     *
     * @return int|null
     */
    public function getByteSize(): ?int
    {
        return $this->byteSize;
    }
    /**
     * The module's size in bytes; null until the version is built.
     *
     * @param int|null $byteSize
     *
     * @return self
     */
    public function setByteSize(?int $byteSize): self
    {
        $this->initialized['byteSize'] = true;
        $this->byteSize = $byteSize;
        return $this;
    }
    /**
     * The module's `vh.manifest` JSON: an ABI 2 module's component definition, or an ABI 1 manifest. Null until the version is built.
     *
     * @return mixed
     */
    public function getManifest()
    {
        return $this->manifest;
    }
    /**
     * The module's `vh.manifest` JSON: an ABI 2 module's component definition, or an ABI 1 manifest. Null until the version is built.
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
     * Whether the version is deprecated: it cannot be newly inserted or published.
     *
     * @return bool
     */
    public function getIsDeprecated(): bool
    {
        return $this->isDeprecated;
    }
    /**
     * Whether the version is deprecated: it cannot be newly inserted or published.
     *
     * @param bool $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
    /**
     * When the version was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @return string|null
     */
    public function getDeprecatedAt(): ?string
    {
        return $this->deprecatedAt;
    }
    /**
     * When the version was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @param string|null $deprecatedAt
     *
     * @return self
     */
    public function setDeprecatedAt(?string $deprecatedAt): self
    {
        $this->initialized['deprecatedAt'] = true;
        $this->deprecatedAt = $deprecatedAt;
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
     * Who created the version: the id of the signed-in person, or the name of the API key.
     *
     * @return string
     */
    public function getCreatedBy(): string
    {
        return $this->createdBy;
    }
    /**
     * Who created the version: the id of the signed-in person, or the name of the API key.
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
     * When the version was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the version was created, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the module was built or uploaded, as an ISO 8601 timestamp; null until then.
     *
     * @return string|null
     */
    public function getBuiltAt(): ?string
    {
        return $this->builtAt;
    }
    /**
     * When the module was built or uploaded, as an ISO 8601 timestamp; null until then.
     *
     * @param string|null $builtAt
     *
     * @return self
     */
    public function setBuiltAt(?string $builtAt): self
    {
        $this->initialized['builtAt'] = true;
        $this->builtAt = $builtAt;
        return $this;
    }
    /**
     * The build's output; null for uploaded modules and until a build finishes.
     *
     * @return string|null
     */
    public function getBuildLog(): ?string
    {
        return $this->buildLog;
    }
    /**
     * The build's output; null for uploaded modules and until a build finishes.
     *
     * @param string|null $buildLog
     *
     * @return self
     */
    public function setBuildLog(?string $buildLog): self
    {
        $this->initialized['buildLog'] = true;
        $this->buildLog = $buildLog;
        return $this;
    }
    /**
     * The crate's files, keyed by path such as `src/lib.rs`; null for uploaded modules.
     *
     * @return array<string, string>|null
     */
    public function getSourceFiles(): ?iterable
    {
        return $this->sourceFiles;
    }
    /**
     * The crate's files, keyed by path such as `src/lib.rs`; null for uploaded modules.
     *
     * @param array<string, string>|null $sourceFiles
     *
     * @return self
     */
    public function setSourceFiles(?iterable $sourceFiles): self
    {
        $this->initialized['sourceFiles'] = true;
        $this->sourceFiles = $sourceFiles;
        return $this;
    }
}