<?php

namespace Voidhash\Generated\Core\Model;

class LiveUsersResultJsonEncoding
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
     * How many minutes back counts as live, currently 15.
     *
     * @var int
     */
    protected $windowMinutes;
    /**
     * The people live on one surface.
     *
     * @var LiveUsersOnSurface
     */
    protected $app;
    /**
     * The people live on one surface.
     *
     * @var LiveUsersOnSurface
     */
    protected $web;
    /**
     * How many minutes back counts as live, currently 15.
     *
     * @return int
     */
    public function getWindowMinutes(): int
    {
        return $this->windowMinutes;
    }
    /**
     * How many minutes back counts as live, currently 15.
     *
     * @param int $windowMinutes
     *
     * @return self
     */
    public function setWindowMinutes(int $windowMinutes): self
    {
        $this->initialized['windowMinutes'] = true;
        $this->windowMinutes = $windowMinutes;
        return $this;
    }
    /**
     * The people live on one surface.
     *
     * @return LiveUsersOnSurface
     */
    public function getApp(): LiveUsersOnSurface
    {
        return $this->app;
    }
    /**
     * The people live on one surface.
     *
     * @param LiveUsersOnSurface $app
     *
     * @return self
     */
    public function setApp(LiveUsersOnSurface $app): self
    {
        $this->initialized['app'] = true;
        $this->app = $app;
        return $this;
    }
    /**
     * The people live on one surface.
     *
     * @return LiveUsersOnSurface
     */
    public function getWeb(): LiveUsersOnSurface
    {
        return $this->web;
    }
    /**
     * The people live on one surface.
     *
     * @param LiveUsersOnSurface $web
     *
     * @return self
     */
    public function setWeb(LiveUsersOnSurface $web): self
    {
        $this->initialized['web'] = true;
        $this->web = $web;
        return $this;
    }
}