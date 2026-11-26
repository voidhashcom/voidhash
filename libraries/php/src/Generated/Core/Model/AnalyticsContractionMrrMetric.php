<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsContractionMrrMetric
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
     * @var string
     */
    protected $kind;
    /**
     * What each subscription's price counts: `net_of_tax` unless given, `gross` with tax, or `proceeds` without tax and the store's commission.
     *
     * @var string|null
     */
    protected $basis;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * What each subscription's price counts: `net_of_tax` unless given, `gross` with tax, or `proceeds` without tax and the store's commission.
     *
     * @return string|null
     */
    public function getBasis(): ?string
    {
        return $this->basis;
    }
    /**
     * What each subscription's price counts: `net_of_tax` unless given, `gross` with tax, or `proceeds` without tax and the store's commission.
     *
     * @param string|null $basis
     *
     * @return self
     */
    public function setBasis(?string $basis): self
    {
        $this->initialized['basis'] = true;
        $this->basis = $basis;
        return $this;
    }
}