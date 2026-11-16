<?php

namespace Voidhash\Generated\Core\Model;

class AdSettingsJsonEncoding
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
     * The project the settings belong to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * Host-and-path prefixes, such as `example.app/start`, that give website ads landing on or under them the `web_to_app` destination.
     *
     * @var list<string>
     */
    protected $webToAppLandingPrefixes;
    /**
     * The project the settings belong to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the settings belong to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * Host-and-path prefixes, such as `example.app/start`, that give website ads landing on or under them the `web_to_app` destination.
     *
     * @return list<string>
     */
    public function getWebToAppLandingPrefixes(): array
    {
        return $this->webToAppLandingPrefixes;
    }
    /**
     * Host-and-path prefixes, such as `example.app/start`, that give website ads landing on or under them the `web_to_app` destination.
     *
     * @param list<string> $webToAppLandingPrefixes
     *
     * @return self
     */
    public function setWebToAppLandingPrefixes(array $webToAppLandingPrefixes): self
    {
        $this->initialized['webToAppLandingPrefixes'] = true;
        $this->webToAppLandingPrefixes = $webToAppLandingPrefixes;
        return $this;
    }
}