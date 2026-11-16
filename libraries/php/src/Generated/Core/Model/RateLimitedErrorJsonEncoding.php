<?php

namespace Voidhash\Generated\Core\Model;

class RateLimitedErrorJsonEncoding
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
     * The error: `type` is `rate_limited`, and `code` says why. Codes name the limit, such as `voidql_quota` or `invitation_limit_reached`.
     *
     * @var RateLimitedErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `rate_limited`, and `code` says why. Codes name the limit, such as `voidql_quota` or `invitation_limit_reached`.
     *
     * @return RateLimitedErrorJsonEncodingError
     */
    public function getError(): RateLimitedErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `rate_limited`, and `code` says why. Codes name the limit, such as `voidql_quota` or `invitation_limit_reached`.
     *
     * @param RateLimitedErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(RateLimitedErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}