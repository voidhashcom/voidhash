<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentResultsJsonEncoding
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
     * The experiment, `exp_...`.
     *
     * @var string
     */
    protected $experimentId;
    /**
     * The event counted as a conversion.
     *
     * @var string
     */
    protected $primaryMetricEventName;
    /**
     * How each arm performed, including arms nobody was shown yet; all zero while the experiment is a draft.
     *
     * @var list<ExperimentVariantResultJsonEncoding>
     */
    protected $variants;
    /**
     * The experiment, `exp_...`.
     *
     * @return string
     */
    public function getExperimentId(): string
    {
        return $this->experimentId;
    }
    /**
     * The experiment, `exp_...`.
     *
     * @param string $experimentId
     *
     * @return self
     */
    public function setExperimentId(string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * The event counted as a conversion.
     *
     * @return string
     */
    public function getPrimaryMetricEventName(): string
    {
        return $this->primaryMetricEventName;
    }
    /**
     * The event counted as a conversion.
     *
     * @param string $primaryMetricEventName
     *
     * @return self
     */
    public function setPrimaryMetricEventName(string $primaryMetricEventName): self
    {
        $this->initialized['primaryMetricEventName'] = true;
        $this->primaryMetricEventName = $primaryMetricEventName;
        return $this;
    }
    /**
     * How each arm performed, including arms nobody was shown yet; all zero while the experiment is a draft.
     *
     * @return list<ExperimentVariantResultJsonEncoding>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * How each arm performed, including arms nobody was shown yet; all zero while the experiment is a draft.
     *
     * @param list<ExperimentVariantResultJsonEncoding> $variants
     *
     * @return self
     */
    public function setVariants(array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
}