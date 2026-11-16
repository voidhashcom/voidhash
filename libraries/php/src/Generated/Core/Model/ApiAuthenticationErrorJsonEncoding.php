<?php

namespace Voidhash\Generated\Core\Model;

class ApiAuthenticationErrorJsonEncoding
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
     * Why the credential was refused: a code such as `invalid_api_key`, `expired_api_key` or `credential_not_accepted`, or the same text as `message`.
     *
     * @var string
     */
    protected $cause;
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
     * Why the credential was refused: a code such as `invalid_api_key`, `expired_api_key` or `credential_not_accepted`, or the same text as `message`.
     *
     * @return string
     */
    public function getCause(): string
    {
        return $this->cause;
    }
    /**
     * Why the credential was refused: a code such as `invalid_api_key`, `expired_api_key` or `credential_not_accepted`, or the same text as `message`.
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