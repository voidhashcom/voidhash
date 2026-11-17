<?php

namespace Voidhash\Generated\Core\Model;

class LocationProblem
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
     * The part of an interface the problem is about: `input`, `output`, `outcome` or `action`.
     *
     * @var string
     */
    protected $part;
    /**
     * The name of the input, output, outcome or app action.
     *
     * @var string
     */
    protected $name;
    /**
     * The locations whose interface can be changed to fix it.
     *
     * @var list<string>
     */
    protected $locationIds;
    /**
     * What is wrong and what to change, for a person to read.
     *
     * @var string
     */
    protected $message;
    /**
     * The part of an interface the problem is about: `input`, `output`, `outcome` or `action`.
     *
     * @return string
     */
    public function getPart(): string
    {
        return $this->part;
    }
    /**
     * The part of an interface the problem is about: `input`, `output`, `outcome` or `action`.
     *
     * @param string $part
     *
     * @return self
     */
    public function setPart(string $part): self
    {
        $this->initialized['part'] = true;
        $this->part = $part;
        return $this;
    }
    /**
     * The name of the input, output, outcome or app action.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The name of the input, output, outcome or app action.
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
     * The locations whose interface can be changed to fix it.
     *
     * @return list<string>
     */
    public function getLocationIds(): array
    {
        return $this->locationIds;
    }
    /**
     * The locations whose interface can be changed to fix it.
     *
     * @param list<string> $locationIds
     *
     * @return self
     */
    public function setLocationIds(array $locationIds): self
    {
        $this->initialized['locationIds'] = true;
        $this->locationIds = $locationIds;
        return $this;
    }
    /**
     * What is wrong and what to change, for a person to read.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What is wrong and what to change, for a person to read.
     *
     * @param string $message
     *
     * @return self
     */
    public function setMessage(string $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
}