<?php

namespace Voidhash\Generated\Core\Model;

class EvaluateProjectFeatureFlagsBodyJsonEncoding
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
    protected $distinctId;
    /**
     * @var string|null
     */
    protected $email;
    /**
     * @var list<string>|null
     */
    protected $externalIds;
    /**
     * @var list<string>|null
     */
    protected $keys;
    /**
     * @var string|null
     */
    protected $personId;
    /**
     * @var string|null
     */
    protected $projectId;
    /**
     * @return string|null
     */
    public function getDistinctId(): ?string
    {
        return $this->distinctId;
    }
    /**
     * @param string|null $distinctId
     *
     * @return self
     */
    public function setDistinctId(?string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
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
     * @return list<string>|null
     */
    public function getExternalIds(): ?array
    {
        return $this->externalIds;
    }
    /**
     * @param list<string>|null $externalIds
     *
     * @return self
     */
    public function setExternalIds(?array $externalIds): self
    {
        $this->initialized['externalIds'] = true;
        $this->externalIds = $externalIds;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getKeys(): ?array
    {
        return $this->keys;
    }
    /**
     * @param list<string>|null $keys
     *
     * @return self
     */
    public function setKeys(?array $keys): self
    {
        $this->initialized['keys'] = true;
        $this->keys = $keys;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * @param string|null $personId
     *
     * @return self
     */
    public function setPersonId(?string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }
    /**
     * @param string|null $projectId
     *
     * @return self
     */
    public function setProjectId(?string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
}