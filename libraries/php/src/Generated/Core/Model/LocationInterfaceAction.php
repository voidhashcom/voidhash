<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceAction
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
     * The revision of the interface that added this part.
     *
     * @var int
     */
    protected $addedIn;
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @var bool|null
     */
    protected $isDeprecated;
    /**
     * @var list<LocationInterfaceSignatureField>
     */
    protected $args;
    /**
     * @var list<LocationInterfaceSignatureField>
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
     * The revision of the interface that added this part.
     *
     * @return int
     */
    public function getAddedIn(): int
    {
        return $this->addedIn;
    }
    /**
     * The revision of the interface that added this part.
     *
     * @param int $addedIn
     *
     * @return self
     */
    public function setAddedIn(int $addedIn): self
    {
        $this->initialized['addedIn'] = true;
        $this->addedIn = $addedIn;
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
     * @return list<LocationInterfaceSignatureField>
     */
    public function getArgs(): array
    {
        return $this->args;
    }
    /**
     * @param list<LocationInterfaceSignatureField> $args
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
     * @return list<LocationInterfaceSignatureField>
     */
    public function getReply(): array
    {
        return $this->reply;
    }
    /**
     * @param list<LocationInterfaceSignatureField> $reply
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