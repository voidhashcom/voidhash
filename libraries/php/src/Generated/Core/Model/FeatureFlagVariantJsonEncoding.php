<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagVariantJsonEncoding
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
     * The variant's id, `ff_var_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The variant's key: what evaluation reports as `variantKey`, and what an override pins.
     *
     * @var string
     */
    protected $key;
    /**
     * A name for the variant shown in the dashboard; null when it has none, and always for a `json` flag.
     *
     * @var string|null
     */
    protected $label;
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @var mixed
     */
    protected $value;
    /**
     * A share of end users, in percent from 0 to 100 in steps of 0.01: a flag's rollout, or the share of traffic a variant or an experiment's arm gets.
     *
     * @var float
     */
    protected $weightPercentage;
    /**
     * The variant's id, `ff_var_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The variant's id, `ff_var_...`.
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
     * The variant's key: what evaluation reports as `variantKey`, and what an override pins.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The variant's key: what evaluation reports as `variantKey`, and what an override pins.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * A name for the variant shown in the dashboard; null when it has none, and always for a `json` flag.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * A name for the variant shown in the dashboard; null when it has none, and always for a `json` flag.
     *
     * @param string|null $label
     *
     * @return self
     */
    public function setLabel(?string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @param mixed $value
     *
     * @return self
     */
    public function setValue($value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
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
}