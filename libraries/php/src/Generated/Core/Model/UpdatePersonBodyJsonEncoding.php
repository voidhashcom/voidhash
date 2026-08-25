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
     * @var string|null
     */
    protected $email;
    /**
     * @var string|null
     */
    protected $name;
    /**
     * @var array<string, mixed>
     */
    protected $setOnce;
    /**
     * @var array<string, mixed>
     */
    protected $traits;
    /**
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
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
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
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
     * @return array<string, mixed>
     */
    public function getSetOnce(): iterable
    {
        return $this->setOnce;
    }
    /**
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
    /**
     * @return array<string, mixed>
     */
    public function getTraits(): iterable
    {
        return $this->traits;
    }
    /**
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