<?php

namespace Voidhash\Generated\Core\Model;

class LiveUsersLocation
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
     * Latitude in whole degrees.
     *
     * @var float
     */
    protected $latitude;
    /**
     * Longitude in whole degrees.
     *
     * @var float
     */
    protected $longitude;
    /**
     * People live at this location.
     *
     * @var int
     */
    protected $users;
    /**
     * Latitude in whole degrees.
     *
     * @return float
     */
    public function getLatitude(): float
    {
        return $this->latitude;
    }
    /**
     * Latitude in whole degrees.
     *
     * @param float $latitude
     *
     * @return self
     */
    public function setLatitude(float $latitude): self
    {
        $this->initialized['latitude'] = true;
        $this->latitude = $latitude;
        return $this;
    }
    /**
     * Longitude in whole degrees.
     *
     * @return float
     */
    public function getLongitude(): float
    {
        return $this->longitude;
    }
    /**
     * Longitude in whole degrees.
     *
     * @param float $longitude
     *
     * @return self
     */
    public function setLongitude(float $longitude): self
    {
        $this->initialized['longitude'] = true;
        $this->longitude = $longitude;
        return $this;
    }
    /**
     * People live at this location.
     *
     * @return int
     */
    public function getUsers(): int
    {
        return $this->users;
    }
    /**
     * People live at this location.
     *
     * @param int $users
     *
     * @return self
     */
    public function setUsers(int $users): self
    {
        $this->initialized['users'] = true;
        $this->users = $users;
        return $this;
    }
}