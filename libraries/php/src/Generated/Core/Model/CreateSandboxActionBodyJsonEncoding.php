<?php

namespace Voidhash\Generated\Core\Model;

class CreateSandboxActionBodyJsonEncoding
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
     * An id the caller chooses for the action; repeating an action with the same id applies it once.
     *
     * @var string
     */
    protected $actionId;
    /**
     * The store event: `refund` or `revoke` a purchase; `renew` a subscription for another billing period, `expire` it, `revoke` it, or start a three-day `grace_period` as after a failed renewal.
     *
     * @var string
     */
    protected $action;
    /**
     * Whether `targetId` names a `purchase` or a `subscription`.
     *
     * @var string
     */
    protected $targetType;
    /**
     * The id of the sandbox purchase (`pur_...`) or subscription (`sub_...`).
     *
     * @var string
     */
    protected $targetId;
    /**
     * An id the caller chooses for the action; repeating an action with the same id applies it once.
     *
     * @return string
     */
    public function getActionId(): string
    {
        return $this->actionId;
    }
    /**
     * An id the caller chooses for the action; repeating an action with the same id applies it once.
     *
     * @param string $actionId
     *
     * @return self
     */
    public function setActionId(string $actionId): self
    {
        $this->initialized['actionId'] = true;
        $this->actionId = $actionId;
        return $this;
    }
    /**
     * The store event: `refund` or `revoke` a purchase; `renew` a subscription for another billing period, `expire` it, `revoke` it, or start a three-day `grace_period` as after a failed renewal.
     *
     * @return string
     */
    public function getAction(): string
    {
        return $this->action;
    }
    /**
     * The store event: `refund` or `revoke` a purchase; `renew` a subscription for another billing period, `expire` it, `revoke` it, or start a three-day `grace_period` as after a failed renewal.
     *
     * @param string $action
     *
     * @return self
     */
    public function setAction(string $action): self
    {
        $this->initialized['action'] = true;
        $this->action = $action;
        return $this;
    }
    /**
     * Whether `targetId` names a `purchase` or a `subscription`.
     *
     * @return string
     */
    public function getTargetType(): string
    {
        return $this->targetType;
    }
    /**
     * Whether `targetId` names a `purchase` or a `subscription`.
     *
     * @param string $targetType
     *
     * @return self
     */
    public function setTargetType(string $targetType): self
    {
        $this->initialized['targetType'] = true;
        $this->targetType = $targetType;
        return $this;
    }
    /**
     * The id of the sandbox purchase (`pur_...`) or subscription (`sub_...`).
     *
     * @return string
     */
    public function getTargetId(): string
    {
        return $this->targetId;
    }
    /**
     * The id of the sandbox purchase (`pur_...`) or subscription (`sub_...`).
     *
     * @param string $targetId
     *
     * @return self
     */
    public function setTargetId(string $targetId): self
    {
        $this->initialized['targetId'] = true;
        $this->targetId = $targetId;
        return $this;
    }
}