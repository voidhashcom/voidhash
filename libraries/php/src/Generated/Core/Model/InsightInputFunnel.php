<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputFunnel
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
     * The order steps must happen in: `sequential` (in order, anything between), `strict` (nothing between) or `any`. `sequential` unless given.
     *
     * @var string
     */
    protected $order;
    /**
     * How long after the first step the last may come, in `windowUnit`s; 14 unless given.
     *
     * @var int
     */
    protected $windowValue;
    /**
     * The unit of `windowValue`: minute, hour, day or week; `day` unless given.
     *
     * @var string
     */
    protected $windowUnit;
    /**
     * What a step's conversion is a share of: the first step (`total`) or the step before (`previous`).
     *
     * @var string
     */
    protected $reference;
    /**
     * What the funnel shows: people through each step, the time they took, or conversion over time.
     *
     * @var string
     */
    protected $view;
    /**
     * Steps side by side (`columns`) or one under another (`rows`).
     *
     * @var string
     */
    protected $layout;
    /**
     * Events that take a person out when done between two steps, at most 10.
     *
     * @var list<FunnelExclusionSteps>
     */
    protected $exclusions;
    /**
     * With a split, which value groups a person: the one on their first step, their last step reached, one every step shares, or the one on `attributionStep`.
     *
     * @var string
     */
    protected $attribution;
    /**
     * The step `step` attribution reads, by its index from 0.
     *
     * @var int
     */
    protected $attributionStep;
    /**
     * The order steps must happen in: `sequential` (in order, anything between), `strict` (nothing between) or `any`. `sequential` unless given.
     *
     * @return string
     */
    public function getOrder(): string
    {
        return $this->order;
    }
    /**
     * The order steps must happen in: `sequential` (in order, anything between), `strict` (nothing between) or `any`. `sequential` unless given.
     *
     * @param string $order
     *
     * @return self
     */
    public function setOrder(string $order): self
    {
        $this->initialized['order'] = true;
        $this->order = $order;
        return $this;
    }
    /**
     * How long after the first step the last may come, in `windowUnit`s; 14 unless given.
     *
     * @return int
     */
    public function getWindowValue(): int
    {
        return $this->windowValue;
    }
    /**
     * How long after the first step the last may come, in `windowUnit`s; 14 unless given.
     *
     * @param int $windowValue
     *
     * @return self
     */
    public function setWindowValue(int $windowValue): self
    {
        $this->initialized['windowValue'] = true;
        $this->windowValue = $windowValue;
        return $this;
    }
    /**
     * The unit of `windowValue`: minute, hour, day or week; `day` unless given.
     *
     * @return string
     */
    public function getWindowUnit(): string
    {
        return $this->windowUnit;
    }
    /**
     * The unit of `windowValue`: minute, hour, day or week; `day` unless given.
     *
     * @param string $windowUnit
     *
     * @return self
     */
    public function setWindowUnit(string $windowUnit): self
    {
        $this->initialized['windowUnit'] = true;
        $this->windowUnit = $windowUnit;
        return $this;
    }
    /**
     * What a step's conversion is a share of: the first step (`total`) or the step before (`previous`).
     *
     * @return string
     */
    public function getReference(): string
    {
        return $this->reference;
    }
    /**
     * What a step's conversion is a share of: the first step (`total`) or the step before (`previous`).
     *
     * @param string $reference
     *
     * @return self
     */
    public function setReference(string $reference): self
    {
        $this->initialized['reference'] = true;
        $this->reference = $reference;
        return $this;
    }
    /**
     * What the funnel shows: people through each step, the time they took, or conversion over time.
     *
     * @return string
     */
    public function getView(): string
    {
        return $this->view;
    }
    /**
     * What the funnel shows: people through each step, the time they took, or conversion over time.
     *
     * @param string $view
     *
     * @return self
     */
    public function setView(string $view): self
    {
        $this->initialized['view'] = true;
        $this->view = $view;
        return $this;
    }
    /**
     * Steps side by side (`columns`) or one under another (`rows`).
     *
     * @return string
     */
    public function getLayout(): string
    {
        return $this->layout;
    }
    /**
     * Steps side by side (`columns`) or one under another (`rows`).
     *
     * @param string $layout
     *
     * @return self
     */
    public function setLayout(string $layout): self
    {
        $this->initialized['layout'] = true;
        $this->layout = $layout;
        return $this;
    }
    /**
     * Events that take a person out when done between two steps, at most 10.
     *
     * @return list<FunnelExclusionSteps>
     */
    public function getExclusions(): array
    {
        return $this->exclusions;
    }
    /**
     * Events that take a person out when done between two steps, at most 10.
     *
     * @param list<FunnelExclusionSteps> $exclusions
     *
     * @return self
     */
    public function setExclusions(array $exclusions): self
    {
        $this->initialized['exclusions'] = true;
        $this->exclusions = $exclusions;
        return $this;
    }
    /**
     * With a split, which value groups a person: the one on their first step, their last step reached, one every step shares, or the one on `attributionStep`.
     *
     * @return string
     */
    public function getAttribution(): string
    {
        return $this->attribution;
    }
    /**
     * With a split, which value groups a person: the one on their first step, their last step reached, one every step shares, or the one on `attributionStep`.
     *
     * @param string $attribution
     *
     * @return self
     */
    public function setAttribution(string $attribution): self
    {
        $this->initialized['attribution'] = true;
        $this->attribution = $attribution;
        return $this;
    }
    /**
     * The step `step` attribution reads, by its index from 0.
     *
     * @return int
     */
    public function getAttributionStep(): int
    {
        return $this->attributionStep;
    }
    /**
     * The step `step` attribution reads, by its index from 0.
     *
     * @param int $attributionStep
     *
     * @return self
     */
    public function setAttributionStep(int $attributionStep): self
    {
        $this->initialized['attributionStep'] = true;
        $this->attributionStep = $attributionStep;
        return $this;
    }
}