<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentInstallConsent
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
     * The reviewed semantic version, `targetVersion` of the install review.
     *
     * @var string
     */
    protected $version;
    /**
     * Every capability the version asks for, `targetCapabilities` of the install review.
     *
     * @var list<string>
     */
    protected $capabilities;
    /**
     * The reviewed semantic version, `targetVersion` of the install review.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The reviewed semantic version, `targetVersion` of the install review.
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
     * Every capability the version asks for, `targetCapabilities` of the install review.
     *
     * @return list<string>
     */
    public function getCapabilities(): array
    {
        return $this->capabilities;
    }
    /**
     * Every capability the version asks for, `targetCapabilities` of the install review.
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
}