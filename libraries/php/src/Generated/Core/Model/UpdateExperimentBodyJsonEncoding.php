<?php

namespace Voidhash\Generated\Core\Model;

class UpdateExperimentBodyJsonEncoding
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
     * The new name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new description; null clears it.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The new hypothesis; null clears it.
     *
     * @var string|null
     */
    protected $hypothesis;
    /**
     * The event that counts as a conversion, such as `$subscription.created` (a new subscription, trial starts included) or `$purchase.completed` (any purchase, one-time and consumable ones included). Null counts `purchase_completed`, which Voidhash itself never sends, so set it explicitly. Only while the experiment is a draft.
     *
     * @var string|null
     */
    protected $primaryMetricEventName;
    /**
     * Further events to watch, replacing the ones set before. Only while the experiment is a draft.
     *
     * @var list<string>|null
     */
    protected $secondaryMetricEventNames;
    /**
     * The new name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The new description; null clears it.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new description; null clears it.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The new hypothesis; null clears it.
     *
     * @return string|null
     */
    public function getHypothesis(): ?string
    {
        return $this->hypothesis;
    }
    /**
     * The new hypothesis; null clears it.
     *
     * @param string|null $hypothesis
     *
     * @return self
     */
    public function setHypothesis(?string $hypothesis): self
    {
        $this->initialized['hypothesis'] = true;
        $this->hypothesis = $hypothesis;
        return $this;
    }
    /**
     * The event that counts as a conversion, such as `$subscription.created` (a new subscription, trial starts included) or `$purchase.completed` (any purchase, one-time and consumable ones included). Null counts `purchase_completed`, which Voidhash itself never sends, so set it explicitly. Only while the experiment is a draft.
     *
     * @return string|null
     */
    public function getPrimaryMetricEventName(): ?string
    {
        return $this->primaryMetricEventName;
    }
    /**
     * The event that counts as a conversion, such as `$subscription.created` (a new subscription, trial starts included) or `$purchase.completed` (any purchase, one-time and consumable ones included). Null counts `purchase_completed`, which Voidhash itself never sends, so set it explicitly. Only while the experiment is a draft.
     *
     * @param string|null $primaryMetricEventName
     *
     * @return self
     */
    public function setPrimaryMetricEventName(?string $primaryMetricEventName): self
    {
        $this->initialized['primaryMetricEventName'] = true;
        $this->primaryMetricEventName = $primaryMetricEventName;
        return $this;
    }
    /**
     * Further events to watch, replacing the ones set before. Only while the experiment is a draft.
     *
     * @return list<string>|null
     */
    public function getSecondaryMetricEventNames(): ?array
    {
        return $this->secondaryMetricEventNames;
    }
    /**
     * Further events to watch, replacing the ones set before. Only while the experiment is a draft.
     *
     * @param list<string>|null $secondaryMetricEventNames
     *
     * @return self
     */
    public function setSecondaryMetricEventNames(?array $secondaryMetricEventNames): self
    {
        $this->initialized['secondaryMetricEventNames'] = true;
        $this->secondaryMetricEventNames = $secondaryMetricEventNames;
        return $this;
    }
}