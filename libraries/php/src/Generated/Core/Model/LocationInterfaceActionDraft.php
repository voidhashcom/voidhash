<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceActionDraft
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
    protected $name;
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @var bool|null
     */
    protected $isDeprecated;
    /**
     * @var list<FlowInterfaceActionField>
     */
    protected $args;
    /**
     * @var list<FlowInterfaceActionField>
     */
    protected $reply;
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
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
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @return bool|null
     */
    public function getIsDeprecated(): ?bool
    {
        return $this->isDeprecated;
    }
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @param bool|null $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(?bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
    /**
     * @return list<FlowInterfaceActionField>
     */
    public function getArgs(): array
    {
        return $this->args;
    }
    /**
     * @param list<FlowInterfaceActionField> $args
     *
     * @return self
     */
    public function setArgs(array $args): self
    {
        $this->initialized['args'] = true;
        $this->args = $args;
        return $this;
    }
    /**
     * @return list<FlowInterfaceActionField>
     */
    public function getReply(): array
    {
        return $this->reply;
    }
    /**
     * @param list<FlowInterfaceActionField> $reply
     *
     * @return self
     */
    public function setReply(array $reply): self
    {
        $this->initialized['reply'] = true;
        $this->reply = $reply;
        return $this;
    }
}