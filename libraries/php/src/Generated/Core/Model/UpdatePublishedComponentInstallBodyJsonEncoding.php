<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePublishedComponentInstallBodyJsonEncoding
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
     * A new range to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to the install's range.
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
     * A new range to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to the install's range.
     *
     * @return string|null
     */
    public function getVersionRange(): ?string
    {
        return $this->versionRange;
    }
    /**
     * A new range to follow: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version). Defaults to the install's range.
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