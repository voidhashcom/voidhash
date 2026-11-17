<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceOutput
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
     * @var string
     */
    protected $type;
    /**
     * What an app reads when the flow never set the output. A list output's default is an array of strings.
     *
     * @var mixed
     */
    protected $default;
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
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * What an app reads when the flow never set the output. A list output's default is an array of strings.
     *
     * @return mixed
     */
    public function getDefault()
    {
        return $this->default;
    }
    /**
     * What an app reads when the flow never set the output. A list output's default is an array of strings.
     *
     * @param mixed $default
     *
     * @return self
     */
    public function setDefault($default): self
    {
        $this->initialized['default'] = true;
        $this->default = $default;
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
}