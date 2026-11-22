<?php

namespace Voidhash\Generated\Core\Model;

class SetPaywallEnvironmentBodyJsonEncoding
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
     * The ready build to deploy there, `pw_build_...`.
     *
     * @var string
     */
    protected $buildId;
    /**
     * The ready build to deploy there, `pw_build_...`.
     *
     * @return string
     */
    public function getBuildId(): string
    {
        return $this->buildId;
    }
    /**
     * The ready build to deploy there, `pw_build_...`.
     *
     * @param string $buildId
     *
     * @return self
     */
    public function setBuildId(string $buildId): self
    {
        $this->initialized['buildId'] = true;
        $this->buildId = $buildId;
        return $this;
    }
}