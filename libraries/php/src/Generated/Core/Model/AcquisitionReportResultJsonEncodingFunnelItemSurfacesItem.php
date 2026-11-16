<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem
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
     * Where the step happened: `web`, `ios`, `android` or `unknown`.
     *
     * @var string
     */
    protected $surface;
    /**
     * How many reached the step there.
     *
     * @var int
     */
    protected $count;
    /**
     * Where the step happened: `web`, `ios`, `android` or `unknown`.
     *
     * @return string
     */
    public function getSurface(): string
    {
        return $this->surface;
    }
    /**
     * Where the step happened: `web`, `ios`, `android` or `unknown`.
     *
     * @param string $surface
     *
     * @return self
     */
    public function setSurface(string $surface): self
    {
        $this->initialized['surface'] = true;
        $this->surface = $surface;
        return $this;
    }
    /**
     * How many reached the step there.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many reached the step there.
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