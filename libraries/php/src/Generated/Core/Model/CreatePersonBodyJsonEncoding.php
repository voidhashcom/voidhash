<?php

namespace Voidhash\Generated\Core\Model;

class CreatePersonBodyJsonEncoding
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
     * The distinct id your app knows the person by, such as your own user id. A person who already has it is updated instead.
     *
     * @var string
     */
    protected $distinctId;
    /**
     * The person's email address.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The person's name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The distinct id your app knows the person by, such as your own user id. A person who already has it is updated instead.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id your app knows the person by, such as your own user id. A person who already has it is updated instead.
     *
     * @param string $distinctId
     *
     * @return self
     */
    public function setDistinctId(string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
    /**
     * The person's email address.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * The person's email address.
     *
     * @param string|null $email
     *
     * @return self
     */
    public function setEmail(?string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * The person's name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The person's name.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
}