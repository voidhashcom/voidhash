<?php

namespace Voidhash\Generated\Core\Model;

class UpdateAdSettingsBodyJsonEncoding
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
     * Replaces the list. At most 20 host-and-path prefixes of up to 255 characters, such as `example.app/start`; a scheme, `www.` and a trailing slash are ignored. Left out, the list stays as it is.
     *
     * @var list<string>|null
     */
    protected $webToAppLandingPrefixes;
    /**
     * Replaces the list. At most 20 host-and-path prefixes of up to 255 characters, such as `example.app/start`; a scheme, `www.` and a trailing slash are ignored. Left out, the list stays as it is.
     *
     * @return list<string>|null
     */
    public function getWebToAppLandingPrefixes(): ?array
    {
        return $this->webToAppLandingPrefixes;
    }
    /**
     * Replaces the list. At most 20 host-and-path prefixes of up to 255 characters, such as `example.app/start`; a scheme, `www.` and a trailing slash are ignored. Left out, the list stays as it is.
     *
     * @param list<string>|null $webToAppLandingPrefixes
     *
     * @return self
     */
    public function setWebToAppLandingPrefixes(?array $webToAppLandingPrefixes): self
    {
        $this->initialized['webToAppLandingPrefixes'] = true;
        $this->webToAppLandingPrefixes = $webToAppLandingPrefixes;
        return $this;
    }
}