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
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign; or `annotation`, a note someone put on the day, only when `options.knownMarkerKinds` names it. More kinds may be added, each only for a caller that names it.
     *
     * @var string
     */
    protected $kind;
    /**
     * What changed, as people read it; an annotation's title.
     *
     * @var string
     */
    protected $label;
    /**
     * An `annotation` marker's note; absent on every other kind.
     *
     * @var AnalyticsChartMarkersResultMarkersItemAnnotation|null
     */
    protected $annotation;
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
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign; or `annotation`, a note someone put on the day, only when `options.knownMarkerKinds` names it. More kinds may be added, each only for a caller that names it.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What changed: a paywall release, a new app version, a feature flag's rollout or state, or an ad campaign; or `annotation`, a note someone put on the day, only when `options.knownMarkerKinds` names it. More kinds may be added, each only for a caller that names it.
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
     * What changed, as people read it; an annotation's title.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * What changed, as people read it; an annotation's title.
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
    /**
     * An `annotation` marker's note; absent on every other kind.
     *
     * @return AnalyticsChartMarkersResultMarkersItemAnnotation|null
     */
    public function getAnnotation(): ?AnalyticsChartMarkersResultMarkersItemAnnotation
    {
        return $this->annotation;
    }
    /**
     * An `annotation` marker's note; absent on every other kind.
     *
     * @param AnalyticsChartMarkersResultMarkersItemAnnotation|null $annotation
     *
     * @return self
     */
    public function setAnnotation(?AnalyticsChartMarkersResultMarkersItemAnnotation $annotation): self
    {
        $this->initialized['annotation'] = true;
        $this->annotation = $annotation;
        return $this;
    }
}