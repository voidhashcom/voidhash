<?php

namespace Voidhash\Generated\Core\Model;

class ApiSdkServiceErrorJsonEncoding
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
     * The error's machine-readable code. Branch on it, never on the message.
     *
     * @var string
     */
    protected $tag;
    /**
     * A short reason, usually `Internal server error`; the details are logged on our side. Retry with backoff.
     *
     * @var string
     */
    protected $cause;
    /**
     * The error's machine-readable code. Branch on it, never on the message.
     *
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * The error's machine-readable code. Branch on it, never on the message.
     *
     * @param string $tag
     *
     * @return self
     */
    public function setTag(string $tag): self
    {
        $this->initialized['tag'] = true;
        $this->tag = $tag;
        return $this;
    }
    /**
     * A short reason, usually `Internal server error`; the details are logged on our side. Retry with backoff.
     *
     * @return string
     */
    public function getCause(): string
    {
        return $this->cause;
    }
    /**
     * A short reason, usually `Internal server error`; the details are logged on our side. Retry with backoff.
     *
     * @param string $cause
     *
     * @return self
     */
    public function setCause(string $cause): self
    {
        $this->initialized['cause'] = true;
        $this->cause = $cause;
        return $this;
    }
}