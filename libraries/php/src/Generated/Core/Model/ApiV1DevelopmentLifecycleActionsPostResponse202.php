<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1DevelopmentLifecycleActionsPostResponse202
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
    protected $actionId;
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
}