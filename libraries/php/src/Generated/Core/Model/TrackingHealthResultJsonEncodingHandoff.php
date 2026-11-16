<?php

namespace Voidhash\Generated\Core\Model;

class TrackingHealthResultJsonEncodingHandoff
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
     * Identified people an app reported.
     *
     * @var int
     */
    protected $appPeople;
    /**
     * Of them, people first identified on the web or who arrived through a web first touch.
     *
     * @var int
     */
    protected $webFirstPeople;
    /**
     * `webFirstPeople / appPeople`, from 0 to 1; null without app people.
     *
     * @var float|null
     */
    protected $share;
    /**
     * Identified people an app reported.
     *
     * @return int
     */
    public function getAppPeople(): int
    {
        return $this->appPeople;
    }
    /**
     * Identified people an app reported.
     *
     * @param int $appPeople
     *
     * @return self
     */
    public function setAppPeople(int $appPeople): self
    {
        $this->initialized['appPeople'] = true;
        $this->appPeople = $appPeople;
        return $this;
    }
    /**
     * Of them, people first identified on the web or who arrived through a web first touch.
     *
     * @return int
     */
    public function getWebFirstPeople(): int
    {
        return $this->webFirstPeople;
    }
    /**
     * Of them, people first identified on the web or who arrived through a web first touch.
     *
     * @param int $webFirstPeople
     *
     * @return self
     */
    public function setWebFirstPeople(int $webFirstPeople): self
    {
        $this->initialized['webFirstPeople'] = true;
        $this->webFirstPeople = $webFirstPeople;
        return $this;
    }
    /**
     * `webFirstPeople / appPeople`, from 0 to 1; null without app people.
     *
     * @return float|null
     */
    public function getShare(): ?float
    {
        return $this->share;
    }
    /**
     * `webFirstPeople / appPeople`, from 0 to 1; null without app people.
     *
     * @param float|null $share
     *
     * @return self
     */
    public function setShare(?float $share): self
    {
        $this->initialized['share'] = true;
        $this->share = $share;
        return $this;
    }
}