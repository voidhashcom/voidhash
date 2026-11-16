<?php

namespace Voidhash\Generated\Core\Model;

class ApiSdkRateLimitedErrorJsonEncoding
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
     * What went wrong, written for a developer reading logs. It can change, so do not parse it.
     *
     * @var string
     */
    protected $message;
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
     * What went wrong, written for a developer reading logs. It can change, so do not parse it.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What went wrong, written for a developer reading logs. It can change, so do not parse it.
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