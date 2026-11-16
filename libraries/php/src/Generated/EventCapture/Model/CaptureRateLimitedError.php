<?php

namespace Voidhash\Generated\EventCapture\Model;

class CaptureRateLimitedError
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
     * The machine-readable error code, always `rate_limited`: the project's request limit is reached, capture is turned off for it, or a batch holds more than 100 events.
     *
     * @var string
     */
    protected $code;
    /**
     * How long to wait before retrying, in milliseconds, when the limit says; the `Retry-After` header carries it in seconds.
     *
     * @var int|null
     */
    protected $retryAfterMs;
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
     * The machine-readable error code, always `rate_limited`: the project's request limit is reached, capture is turned off for it, or a batch holds more than 100 events.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * The machine-readable error code, always `rate_limited`: the project's request limit is reached, capture is turned off for it, or a batch holds more than 100 events.
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
    /**
     * How long to wait before retrying, in milliseconds, when the limit says; the `Retry-After` header carries it in seconds.
     *
     * @return int|null
     */
    public function getRetryAfterMs(): ?int
    {
        return $this->retryAfterMs;
    }
    /**
     * How long to wait before retrying, in milliseconds, when the limit says; the `Retry-After` header carries it in seconds.
     *
     * @param int|null $retryAfterMs
     *
     * @return self
     */
    public function setRetryAfterMs(?int $retryAfterMs): self
    {
        $this->initialized['retryAfterMs'] = true;
        $this->retryAfterMs = $retryAfterMs;
        return $this;
    }
}