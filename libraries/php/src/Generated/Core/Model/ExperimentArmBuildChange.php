<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentArmBuildChange
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
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @var string
     */
    protected $environment;
    /**
     * The paywall the arm showed before, `pw_...`; null when it showed none of its own.
     *
     * @var string|null
     */
    protected $fromPaywallId;
    /**
     * The number of the build the arm kept before; null when it showed no paywall, or followed the paywall's deployed build.
     *
     * @var int|null
     */
    protected $fromBuildNumber;
    /**
     * The paywall the arm shows since, `pw_...`; null when it stopped showing one here.
     *
     * @var string|null
     */
    protected $toPaywallId;
    /**
     * The number of the build the arm keeps since; null when it stopped showing one.
     *
     * @var int|null
     */
    protected $toBuildNumber;
    /**
     * @var string
     */
    protected $changedAt;
    /**
     * The team member who changed it, `user_...`; null for a project key.
     *
     * @var string|null
     */
    protected $changedByUserId;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * The paywall the arm showed before, `pw_...`; null when it showed none of its own.
     *
     * @return string|null
     */
    public function getFromPaywallId(): ?string
    {
        return $this->fromPaywallId;
    }
    /**
     * The paywall the arm showed before, `pw_...`; null when it showed none of its own.
     *
     * @param string|null $fromPaywallId
     *
     * @return self
     */
    public function setFromPaywallId(?string $fromPaywallId): self
    {
        $this->initialized['fromPaywallId'] = true;
        $this->fromPaywallId = $fromPaywallId;
        return $this;
    }
    /**
     * The number of the build the arm kept before; null when it showed no paywall, or followed the paywall's deployed build.
     *
     * @return int|null
     */
    public function getFromBuildNumber(): ?int
    {
        return $this->fromBuildNumber;
    }
    /**
     * The number of the build the arm kept before; null when it showed no paywall, or followed the paywall's deployed build.
     *
     * @param int|null $fromBuildNumber
     *
     * @return self
     */
    public function setFromBuildNumber(?int $fromBuildNumber): self
    {
        $this->initialized['fromBuildNumber'] = true;
        $this->fromBuildNumber = $fromBuildNumber;
        return $this;
    }
    /**
     * The paywall the arm shows since, `pw_...`; null when it stopped showing one here.
     *
     * @return string|null
     */
    public function getToPaywallId(): ?string
    {
        return $this->toPaywallId;
    }
    /**
     * The paywall the arm shows since, `pw_...`; null when it stopped showing one here.
     *
     * @param string|null $toPaywallId
     *
     * @return self
     */
    public function setToPaywallId(?string $toPaywallId): self
    {
        $this->initialized['toPaywallId'] = true;
        $this->toPaywallId = $toPaywallId;
        return $this;
    }
    /**
     * The number of the build the arm keeps since; null when it stopped showing one.
     *
     * @return int|null
     */
    public function getToBuildNumber(): ?int
    {
        return $this->toBuildNumber;
    }
    /**
     * The number of the build the arm keeps since; null when it stopped showing one.
     *
     * @param int|null $toBuildNumber
     *
     * @return self
     */
    public function setToBuildNumber(?int $toBuildNumber): self
    {
        $this->initialized['toBuildNumber'] = true;
        $this->toBuildNumber = $toBuildNumber;
        return $this;
    }
    /**
     * @return string
     */
    public function getChangedAt(): string
    {
        return $this->changedAt;
    }
    /**
     * @param string $changedAt
     *
     * @return self
     */
    public function setChangedAt(string $changedAt): self
    {
        $this->initialized['changedAt'] = true;
        $this->changedAt = $changedAt;
        return $this;
    }
    /**
     * The team member who changed it, `user_...`; null for a project key.
     *
     * @return string|null
     */
    public function getChangedByUserId(): ?string
    {
        return $this->changedByUserId;
    }
    /**
     * The team member who changed it, `user_...`; null for a project key.
     *
     * @param string|null $changedByUserId
     *
     * @return self
     */
    public function setChangedByUserId(?string $changedByUserId): self
    {
        $this->initialized['changedByUserId'] = true;
        $this->changedByUserId = $changedByUserId;
        return $this;
    }
}