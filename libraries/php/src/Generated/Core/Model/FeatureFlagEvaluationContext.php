<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEvaluationContext
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
     * The platform the app runs on: `ios`, `android` or `web`.
     *
     * @var string|null
     */
    protected $platform;
    /**
     * The app's version.
     *
     * @var string|null
     */
    protected $appVersion;
    /**
     * The operating system's version.
     *
     * @var string|null
     */
    protected $osVersion;
    /**
     * The two-letter country the end user is in.
     *
     * @var string|null
     */
    protected $country;
    /**
     * The end user's locale.
     *
     * @var string|null
     */
    protected $locale;
    /**
     * The platform the app runs on: `ios`, `android` or `web`.
     *
     * @return string|null
     */
    public function getPlatform(): ?string
    {
        return $this->platform;
    }
    /**
     * The platform the app runs on: `ios`, `android` or `web`.
     *
     * @param string|null $platform
     *
     * @return self
     */
    public function setPlatform(?string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * The app's version.
     *
     * @return string|null
     */
    public function getAppVersion(): ?string
    {
        return $this->appVersion;
    }
    /**
     * The app's version.
     *
     * @param string|null $appVersion
     *
     * @return self
     */
    public function setAppVersion(?string $appVersion): self
    {
        $this->initialized['appVersion'] = true;
        $this->appVersion = $appVersion;
        return $this;
    }
    /**
     * The operating system's version.
     *
     * @return string|null
     */
    public function getOsVersion(): ?string
    {
        return $this->osVersion;
    }
    /**
     * The operating system's version.
     *
     * @param string|null $osVersion
     *
     * @return self
     */
    public function setOsVersion(?string $osVersion): self
    {
        $this->initialized['osVersion'] = true;
        $this->osVersion = $osVersion;
        return $this;
    }
    /**
     * The two-letter country the end user is in.
     *
     * @return string|null
     */
    public function getCountry(): ?string
    {
        return $this->country;
    }
    /**
     * The two-letter country the end user is in.
     *
     * @param string|null $country
     *
     * @return self
     */
    public function setCountry(?string $country): self
    {
        $this->initialized['country'] = true;
        $this->country = $country;
        return $this;
    }
    /**
     * The end user's locale.
     *
     * @return string|null
     */
    public function getLocale(): ?string
    {
        return $this->locale;
    }
    /**
     * The end user's locale.
     *
     * @param string|null $locale
     *
     * @return self
     */
    public function setLocale(?string $locale): self
    {
        $this->initialized['locale'] = true;
        $this->locale = $locale;
        return $this;
    }
}