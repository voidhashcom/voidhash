<?php

namespace Voidhash\Generated\Core\Model;

class AutomationStatsJsonEncodingStepsItemPortsItem
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
     * The exit's key.
     *
     * @var string
     */
    protected $port;
    /**
     * How many runs left by it.
     *
     * @var int
     */
    protected $count;
    /**
     * The exit's key.
     *
     * @return string
     */
    public function getPort(): string
    {
        return $this->port;
    }
    /**
     * The exit's key.
     *
     * @param string $port
     *
     * @return self
     */
    public function setPort(string $port): self
    {
        $this->initialized['port'] = true;
        $this->port = $port;
        return $this;
    }
    /**
     * How many runs left by it.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many runs left by it.
     *
     * @param int $count
     *
     * @return self
     */
    public function setCount(int $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
}