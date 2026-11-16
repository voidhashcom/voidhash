<?php

namespace Voidhash\Generated\Core\Model;

class DevSessionBuild
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
     * The state of the run's newest build.
     *
     * @var string
     */
    protected $state;
    /**
     * Why the build failed.
     *
     * @var string
     */
    protected $message;
    /**
     * The state of the run's newest build.
     *
     * @return string
     */
    public function getState(): string
    {
        return $this->state;
    }
    /**
     * The state of the run's newest build.
     *
     * @param string $state
     *
     * @return self
     */
    public function setState(string $state): self
    {
        $this->initialized['state'] = true;
        $this->state = $state;
        return $this;
    }
    /**
     * Why the build failed.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * Why the build failed.
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