<?php

namespace Voidhash\Generated\Core\Model;

class CreatePublishedComponentInstallBodyJsonEncoding
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
     * The id of the registry component to install, `cmp_pkg_...`.
     *
     * @var string
     */
    protected $registryComponentId;
    /**
     * The versions to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to `^` the newest ready version.
     *
     * @var string|null
     */
    protected $versionRange;
    /**
     * A person's acceptance of a reviewed version: its semantic version and every capability it asks for.
     *
     * @var PublishedComponentInstallConsent
     */
    protected $consent;
    /**
     * The id of the registry component to install, `cmp_pkg_...`.
     *
     * @return string
     */
    public function getRegistryComponentId(): string
    {
        return $this->registryComponentId;
    }
    /**
     * The id of the registry component to install, `cmp_pkg_...`.
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
     * The versions to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to `^` the newest ready version.
     *
     * @return string|null
     */
    public function getVersionRange(): ?string
    {
        return $this->versionRange;
    }
    /**
     * The versions to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to `^` the newest ready version.
     *
     * @param string|null $versionRange
     *
     * @return self
     */
    public function setVersionRange(?string $versionRange): self
    {
        $this->initialized['versionRange'] = true;
        $this->versionRange = $versionRange;
        return $this;
    }
    /**
     * A person's acceptance of a reviewed version: its semantic version and every capability it asks for.
     *
     * @return PublishedComponentInstallConsent
     */
    public function getConsent(): PublishedComponentInstallConsent
    {
        return $this->consent;
    }
    /**
     * A person's acceptance of a reviewed version: its semantic version and every capability it asks for.
     *
     * @param PublishedComponentInstallConsent $consent
     *
     * @return self
     */
    public function setConsent(PublishedComponentInstallConsent $consent): self
    {
        $this->initialized['consent'] = true;
        $this->consent = $consent;
        return $this;
    }
}