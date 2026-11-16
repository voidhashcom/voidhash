<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartMarkersResultMarkersItem
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
     * When it changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $at;
    /**
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign.
     *
     * @var string
     */
    protected $kind;
    /**
     * What changed, as people read it.
     *
     * @var string
     */
    protected $label;
    /**
     * When it changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getAt(): string
    {
        return $this->at;
    }
    /**
     * When it changed, as an ISO 8601 timestamp.
     *
     * @param string $at
     *
     * @return self
     */
    public function setAt(string $at): self
    {
        $this->initialized['at'] = true;
        $this->at = $at;
        return $this;
    }
    /**
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign.
     *
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
     * What changed, as people read it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * What changed, as people read it.
     *
     * @param string $label
     *
     * @return self
     */
    public function setLabel(string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
}