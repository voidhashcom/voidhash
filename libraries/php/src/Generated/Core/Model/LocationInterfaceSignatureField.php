<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceSignatureField
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
     * Carries what the end user typed into a secure input, such as a password, or a value worked out from it. The app receives a secret argument and must keep it out of logs and analytics; a flow keeps a secret reply field away from everything but the app. Absent means false.
     *
     * @var bool|null
     */
    protected $isSecret;
    /**
     * The revision of the interface that added this part.
     *
     * @var int
     */
    protected $addedIn;
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
     * Carries what the end user typed into a secure input, such as a password, or a value worked out from it. The app receives a secret argument and must keep it out of logs and analytics; a flow keeps a secret reply field away from everything but the app. Absent means false.
     *
     * @return bool|null
     */
    public function getIsSecret(): ?bool
    {
        return $this->isSecret;
    }
    /**
     * Carries what the end user typed into a secure input, such as a password, or a value worked out from it. The app receives a secret argument and must keep it out of logs and analytics; a flow keeps a secret reply field away from everything but the app. Absent means false.
     *
     * @param bool|null $isSecret
     *
     * @return self
     */
    public function setIsSecret(?bool $isSecret): self
    {
        $this->initialized['isSecret'] = true;
        $this->isSecret = $isSecret;
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
}