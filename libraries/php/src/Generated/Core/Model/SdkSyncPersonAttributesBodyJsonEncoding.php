<?php

namespace Voidhash\Generated\Core\Model;

class SdkSyncPersonAttributesBodyJsonEncoding
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
     * A person's traits: names mapped to a string, number, boolean or null.
     *
     * @var array<string, mixed>
     */
    protected $setOnce;
    /**
     * A stable id the SDK gives this write, so a retried or echoed copy of it is applied only once.
     *
     * @var string|null
     */
    protected $clientEventId;
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
    /**
     * A stable id the SDK gives this write, so a retried or echoed copy of it is applied only once.
     *
     * @return string|null
     */
    public function getClientEventId(): ?string
    {
        return $this->clientEventId;
    }
    /**
     * A stable id the SDK gives this write, so a retried or echoed copy of it is applied only once.
     *
     * @param string|null $clientEventId
     *
     * @return self
     */
    public function setClientEventId(?string $clientEventId): self
    {
        $this->initialized['clientEventId'] = true;
        $this->clientEventId = $clientEventId;
        return $this;
    }
}