<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePersonBodyJsonEncoding
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
     * The new email address.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The new name.
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
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @var array<string, mixed>
     */
    protected $setOnce;
    /**
     * The new email address.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * The new email address.
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
     * The new name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name.
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
    /**
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @return array<string, mixed>
     */
    public function getSetOnce(): iterable
    {
        return $this->setOnce;
    }
    /**
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @param array<string, mixed> $setOnce
     *
     * @return self
     */
    public function setSetOnce(iterable $setOnce): self
    {
        $this->initialized['setOnce'] = true;
        $this->setOnce = $setOnce;
        return $this;
    }
}