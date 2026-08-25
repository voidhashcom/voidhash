<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentBackingFlagJsonEncoding
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
     * @var bool
     */
    protected $enabled;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string
     */
    protected $key;
    /**
     * @var mixed
     */
    protected $rolloutBps;
    /**
     * @return bool
     */
    public function getEnabled(): bool
    {
        return $this->enabled;
    }
    /**
     * @param bool $enabled
     *
     * @return self
     */
    public function setEnabled(bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getRolloutBps()
    {
        return $this->rolloutBps;
    }
    /**
     * @param mixed $rolloutBps
     *
     * @return self
     */
    public function setRolloutBps($rolloutBps): self
    {
        $this->initialized['rolloutBps'] = true;
        $this->rolloutBps = $rolloutBps;
        return $this;
    }
}