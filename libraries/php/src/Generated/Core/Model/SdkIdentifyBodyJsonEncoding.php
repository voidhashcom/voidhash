<?php

namespace Voidhash\Generated\Core\Model;

class SdkIdentifyBodyJsonEncoding
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
     * The distinct id to identify the end user as, such as your own user id. It cannot start with the anonymous prefix `vh_anon_`.
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
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @var array<string, mixed>
     */
    protected $traits;
    /**
     * The distinct id to identify the end user as, such as your own user id. It cannot start with the anonymous prefix `vh_anon_`.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id to identify the end user as, such as your own user id. It cannot start with the anonymous prefix `vh_anon_`.
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
    /**
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @return array<string, mixed>
     */
    public function getTraits(): iterable
    {
        return $this->traits;
    }
    /**
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @param array<string, mixed> $traits
     *
     * @return self
     */
    public function setTraits(iterable $traits): self
    {
        $this->initialized['traits'] = true;
        $this->traits = $traits;
        return $this;
    }
}