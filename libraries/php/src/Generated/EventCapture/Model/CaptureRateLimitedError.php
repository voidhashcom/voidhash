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
     * @var string
     */
    protected $tag;
    /**
     * @var string
     */
    protected $error;
    /**
     * @var string
     */
    protected $code;
    /**
     * @var int|null
     */
    protected $retryAfterMs;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
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
     * @return string
     */
    public function getError(): string
    {
        return $this->error;
    }
    /**
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
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
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
     * @return int|null
     */
    public function getRetryAfterMs(): ?int
    {
        return $this->retryAfterMs;
    }
    /**
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