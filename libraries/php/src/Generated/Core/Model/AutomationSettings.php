<?php

namespace Voidhash\Generated\Core\Model;

class AutomationSettings
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
     * Whether a person may enter again: `once` per person, `every_time`, or after `cooldown` has passed since they last entered.
     *
     * @var string
     */
    protected $reentry;
    /**
     * A length of time.
     *
     * @var AutomationDuration
     */
    protected $cooldown;
    /**
     * Events that take a person out of the automation, such as buying what it was nudging them to buy.
     *
     * @var list<string>|null
     */
    protected $exitOn;
    /**
     * Whether a person may enter again: `once` per person, `every_time`, or after `cooldown` has passed since they last entered.
     *
     * @return string
     */
    public function getReentry(): string
    {
        return $this->reentry;
    }
    /**
     * Whether a person may enter again: `once` per person, `every_time`, or after `cooldown` has passed since they last entered.
     *
     * @param string $reentry
     *
     * @return self
     */
    public function setReentry(string $reentry): self
    {
        $this->initialized['reentry'] = true;
        $this->reentry = $reentry;
        return $this;
    }
    /**
     * A length of time.
     *
     * @return AutomationDuration
     */
    public function getCooldown(): AutomationDuration
    {
        return $this->cooldown;
    }
    /**
     * A length of time.
     *
     * @param AutomationDuration $cooldown
     *
     * @return self
     */
    public function setCooldown(AutomationDuration $cooldown): self
    {
        $this->initialized['cooldown'] = true;
        $this->cooldown = $cooldown;
        return $this;
    }
    /**
     * Events that take a person out of the automation, such as buying what it was nudging them to buy.
     *
     * @return list<string>|null
     */
    public function getExitOn(): ?array
    {
        return $this->exitOn;
    }
    /**
     * Events that take a person out of the automation, such as buying what it was nudging them to buy.
     *
     * @param list<string>|null $exitOn
     *
     * @return self
     */
    public function setExitOn(?array $exitOn): self
    {
        $this->initialized['exitOn'] = true;
        $this->exitOn = $exitOn;
        return $this;
    }
}