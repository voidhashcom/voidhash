<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionReportResultJsonEncodingConvertedOn
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
     * The reported payers, unattributed included, by payment surface.
     *
     * @var list<AcquisitionPaymentSurface>
     */
    protected $surfaces;
    /**
     * Payers whose journey crossed surfaces.
     *
     * @var int
     */
    protected $crossSurfacePayers;
    /**
     * The five most common paths of cross-surface payers.
     *
     * @var list<AcquisitionReportResultJsonEncodingConvertedOnJourneysItem>
     */
    protected $journeys;
    /**
     * The reported payers, unattributed included, by payment surface.
     *
     * @return list<AcquisitionPaymentSurface>
     */
    public function getSurfaces(): array
    {
        return $this->surfaces;
    }
    /**
     * The reported payers, unattributed included, by payment surface.
     *
     * @param list<AcquisitionPaymentSurface> $surfaces
     *
     * @return self
     */
    public function setSurfaces(array $surfaces): self
    {
        $this->initialized['surfaces'] = true;
        $this->surfaces = $surfaces;
        return $this;
    }
    /**
     * Payers whose journey crossed surfaces.
     *
     * @return int
     */
    public function getCrossSurfacePayers(): int
    {
        return $this->crossSurfacePayers;
    }
    /**
     * Payers whose journey crossed surfaces.
     *
     * @param int $crossSurfacePayers
     *
     * @return self
     */
    public function setCrossSurfacePayers(int $crossSurfacePayers): self
    {
        $this->initialized['crossSurfacePayers'] = true;
        $this->crossSurfacePayers = $crossSurfacePayers;
        return $this;
    }
    /**
     * The five most common paths of cross-surface payers.
     *
     * @return list<AcquisitionReportResultJsonEncodingConvertedOnJourneysItem>
     */
    public function getJourneys(): array
    {
        return $this->journeys;
    }
    /**
     * The five most common paths of cross-surface payers.
     *
     * @param list<AcquisitionReportResultJsonEncodingConvertedOnJourneysItem> $journeys
     *
     * @return self
     */
    public function setJourneys(array $journeys): self
    {
        $this->initialized['journeys'] = true;
        $this->journeys = $journeys;
        return $this;
    }
}