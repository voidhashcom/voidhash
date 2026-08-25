<?php

namespace Voidhash\Generated\Core\Model;

class DevelopmentLifecycleActionBody
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
     * @var string
     */
    protected $action;
    /**
     * @var string
     */
    protected $actionId;
    /**
     * @var string|null
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $targetId;
    /**
     * @var string
     */
    protected $targetType;
    /**
     * @return string
     */
    public function getAction(): string
    {
        return $this->action;
    }
    /**
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
     * @return string
     */
    public function getActionId(): string
    {
        return $this->actionId;
    }
    /**
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
     * @return string|null
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }
    /**
     * @param string|null $projectId
     *
     * @return self
     */
    public function setProjectId(?string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * @return string
     */
    public function getTargetId(): string
    {
        return $this->targetId;
    }
    /**
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
    /**
     * @return string
     */
    public function getTargetType(): string
    {
        return $this->targetType;
    }
    /**
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
}