<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingFunnelItem
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
     * The step: `visits`, `app_installs`, `signups`, `trials` or `payers`.
     *
     * @var string
     */
    protected $step;
    /**
     * People, or visits, that reached the step.
     *
     * @var int
     */
    protected $count;
    /**
     * The step's count by the surface it happened on.
     *
     * @var list<AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem>
     */
    protected $surfaces;
    /**
     * The step: `visits`, `app_installs`, `signups`, `trials` or `payers`.
     *
     * @return string
     */
    public function getStep(): string
    {
        return $this->step;
    }
    /**
     * The step: `visits`, `app_installs`, `signups`, `trials` or `payers`.
     *
     * @param string $step
     *
     * @return self
     */
    public function setStep(string $step): self
    {
        $this->initialized['step'] = true;
        $this->step = $step;
        return $this;
    }
    /**
     * People, or visits, that reached the step.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * People, or visits, that reached the step.
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
    /**
     * The step's count by the surface it happened on.
     *
     * @return list<AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem>
     */
    public function getSurfaces(): array
    {
        return $this->surfaces;
    }
    /**
     * The step's count by the surface it happened on.
     *
     * @param list<AcquisitionReportResultJsonEncodingFunnelItemSurfacesItem> $surfaces
     *
     * @return self
     */
    public function setSurfaces(array $surfaces): self
    {
        $this->initialized['surfaces'] = true;
        $this->surfaces = $surfaces;
        return $this;
    }
}