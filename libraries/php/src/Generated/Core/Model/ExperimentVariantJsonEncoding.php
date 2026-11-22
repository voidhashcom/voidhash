<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentVariantJsonEncoding
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
     * The arm's id, `exp_var_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The arm's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Whether this is the control arm, the one everyone sees while the experiment is paused. Exactly one arm is the control.
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
     * The paywall the arm shows at each location, at most one per location, with the builds it shows there.
     *
     * @var list<ExperimentArmPlacement>
     */
    protected $placements;
    /**
     * The value the arm gives each feature flag the experiment sets, one per flag; empty when it sets none.
     *
     * @var list<ExperimentFlagValue>
     */
    protected $flagValues;
    /**
     * Locations the arm stopped showing a paywall at while the experiment was paused, each with its record of changes; they serve nothing and are not in `placements`. Empty unless that happened.
     *
     * @var list<ExperimentArmStoppedPlacement>
     */
    protected $stoppedPlacements;
    /**
     * The arm's id, `exp_var_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The arm's id, `exp_var_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
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
     * Whether this is the control arm, the one everyone sees while the experiment is paused. Exactly one arm is the control.
     *
     * @return bool
     */
    public function getIsControl(): bool
    {
        return $this->isControl;
    }
    /**
     * Whether this is the control arm, the one everyone sees while the experiment is paused. Exactly one arm is the control.
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
     * The paywall the arm shows at each location, at most one per location, with the builds it shows there.
     *
     * @return list<ExperimentArmPlacement>
     */
    public function getPlacements(): array
    {
        return $this->placements;
    }
    /**
     * The paywall the arm shows at each location, at most one per location, with the builds it shows there.
     *
     * @param list<ExperimentArmPlacement> $placements
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
     * The value the arm gives each feature flag the experiment sets, one per flag; empty when it sets none.
     *
     * @return list<ExperimentFlagValue>
     */
    public function getFlagValues(): array
    {
        return $this->flagValues;
    }
    /**
     * The value the arm gives each feature flag the experiment sets, one per flag; empty when it sets none.
     *
     * @param list<ExperimentFlagValue> $flagValues
     *
     * @return self
     */
    public function setFlagValues(array $flagValues): self
    {
        $this->initialized['flagValues'] = true;
        $this->flagValues = $flagValues;
        return $this;
    }
    /**
     * Locations the arm stopped showing a paywall at while the experiment was paused, each with its record of changes; they serve nothing and are not in `placements`. Empty unless that happened.
     *
     * @return list<ExperimentArmStoppedPlacement>
     */
    public function getStoppedPlacements(): array
    {
        return $this->stoppedPlacements;
    }
    /**
     * Locations the arm stopped showing a paywall at while the experiment was paused, each with its record of changes; they serve nothing and are not in `placements`. Empty unless that happened.
     *
     * @param list<ExperimentArmStoppedPlacement> $stoppedPlacements
     *
     * @return self
     */
    public function setStoppedPlacements(array $stoppedPlacements): self
    {
        $this->initialized['stoppedPlacements'] = true;
        $this->stoppedPlacements = $stoppedPlacements;
        return $this;
    }
}