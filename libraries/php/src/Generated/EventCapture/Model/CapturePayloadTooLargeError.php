<?php

namespace Voidhash\Generated\EventCapture\Model;

class CapturePayloadTooLargeError
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
     * The error's name. Branch on `code` instead.
     *
     * @var string
     */
    protected $tag;
    /**
     * What went wrong, for people. It can change, so do not parse it.
     *
     * @var string
     */
    protected $error;
    /**
     * The machine-readable error code, always `payload_too_large`: the body is over 5 MB, sent or decompressed, or an event is too large to store.
     *
     * @var string
     */
    protected $code;
    /**
     * The error's name. Branch on `code` instead.
     *
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * The error's name. Branch on `code` instead.
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
     * What went wrong, for people. It can change, so do not parse it.
     *
     * @return string
     */
    public function getError(): string
    {
        return $this->error;
    }
    /**
     * What went wrong, for people. It can change, so do not parse it.
     *
     * @param string $error
     *
     * @return self
     */
    public function setError(string $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
    /**
     * The machine-readable error code, always `payload_too_large`: the body is over 5 MB, sent or decompressed, or an event is too large to store.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * The machine-readable error code, always `payload_too_large`: the body is over 5 MB, sent or decompressed, or an event is too large to store.
     *
     * @param string $code
     *
     * @return self
     */
    public function setCode(string $code): self
    {
        $this->initialized['code'] = true;
        $this->code = $code;
        return $this;
    }
}