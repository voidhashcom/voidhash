<?php

namespace Voidhash\Generated\Core\Model;

class ReplaceExperimentVariantsBodyJsonEncodingVariantsItem
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
     * An existing arm's id, `exp_var_...`, to keep that arm; omitted, a new arm is made.
     *
     * @var string|null
     */
    protected $id;
    /**
     * The arm's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Whether this is the control arm; exactly one arm is.
     *
     * @var bool
     */
    protected $isControl;
    /**
     * A share of end users, in percent from 0 to 100 in steps of 0.01: a flag's rollout, or the share of traffic a variant or an experiment's arm gets.
     *
     * @var float
     */
    protected $weightPercentage;
    /**
     * The paywall the arm shows at each location, at most one per location.
     *
     * @var list<ExperimentPlacement>
     */
    protected $placements;
    /**
     * The value the arm gives each feature flag, one per flag; a flag one arm names, every arm must. Omitted, an arm that exists keeps the values it has and a new arm gives none; an empty list clears them.
     *
     * @var list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem>|null
     */
    protected $flagValues;
    /**
     * An existing arm's id, `exp_var_...`, to keep that arm; omitted, a new arm is made.
     *
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }
    /**
     * An existing arm's id, `exp_var_...`, to keep that arm; omitted, a new arm is made.
     *
     * @param string|null $id
     *
     * @return self
     */
    public function setId(?string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The arm's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The arm's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Whether this is the control arm; exactly one arm is.
     *
     * @return bool
     */
    public function getIsControl(): bool
    {
        return $this->isControl;
    }
    /**
     * Whether this is the control arm; exactly one arm is.
     *
     * @param bool $isControl
     *
     * @return self
     */
    public function setIsControl(bool $isControl): self
    {
        $this->initialized['isControl'] = true;
        $this->isControl = $isControl;
        return $this;
    }
    /**
     * A share of end users, in percent from 0 to 100 in steps of 0.01: a flag's rollout, or the share of traffic a variant or an experiment's arm gets.
     *
     * @return float
     */
    public function getWeightPercentage(): float
    {
        return $this->weightPercentage;
    }
    /**
     * A share of end users, in percent from 0 to 100 in steps of 0.01: a flag's rollout, or the share of traffic a variant or an experiment's arm gets.
     *
     * @param float $weightPercentage
     *
     * @return self
     */
    public function setWeightPercentage(float $weightPercentage): self
    {
        $this->initialized['weightPercentage'] = true;
        $this->weightPercentage = $weightPercentage;
        return $this;
    }
    /**
     * The paywall the arm shows at each location, at most one per location.
     *
     * @return list<ExperimentPlacement>
     */
    public function getPlacements(): array
    {
        return $this->placements;
    }
    /**
     * The paywall the arm shows at each location, at most one per location.
     *
     * @param list<ExperimentPlacement> $placements
     *
     * @return self
     */
    public function setPlacements(array $placements): self
    {
        $this->initialized['placements'] = true;
        $this->placements = $placements;
        return $this;
    }
    /**
     * The value the arm gives each feature flag, one per flag; a flag one arm names, every arm must. Omitted, an arm that exists keeps the values it has and a new arm gives none; an empty list clears them.
     *
     * @return list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem>|null
     */
    public function getFlagValues(): ?array
    {
        return $this->flagValues;
    }
    /**
     * The value the arm gives each feature flag, one per flag; a flag one arm names, every arm must. Omitted, an arm that exists keeps the values it has and a new arm gives none; an empty list clears them.
     *
     * @param list<ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem>|null $flagValues
     *
     * @return self
     */
    public function setFlagValues(?array $flagValues): self
    {
        $this->initialized['flagValues'] = true;
        $this->flagValues = $flagValues;
        return $this;
    }
}