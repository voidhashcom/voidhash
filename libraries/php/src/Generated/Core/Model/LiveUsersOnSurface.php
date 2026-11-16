<?php

namespace Voidhash\Generated\Core\Model;

class LiveUsersOnSurface
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
     * Everyone live, located or not.
     *
     * @var int
     */
    protected $users;
    /**
     * Where people are live, only those whose location is known.
     *
     * @var list<LiveUsersLocation>
     */
    protected $locations;
    /**
     * Everyone live, located or not.
     *
     * @return int
     */
    public function getUsers(): int
    {
        return $this->users;
    }
    /**
     * Everyone live, located or not.
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
    /**
     * Where people are live, only those whose location is known.
     *
     * @return list<LiveUsersLocation>
     */
    public function getLocations(): array
    {
        return $this->locations;
    }
    /**
     * Where people are live, only those whose location is known.
     *
     * @param list<LiveUsersLocation> $locations
     *
     * @return self
     */
    public function setLocations(array $locations): self
    {
        $this->initialized['locations'] = true;
        $this->locations = $locations;
        return $this;
    }
}