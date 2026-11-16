<?php

namespace Voidhash\Generated\Core\Model;

class InvalidRequestErrorJsonEncoding
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
     * The error: `type` is `invalid_request`, and `code` says why. Codes: `invalid_body`, `invalid_query`, `invalid_path` or `invalid_headers` when the request does not match the operation's schema, `invalid_cursor` for a cursor the list did not return, or a rule of the operation, such as `billing_period_required`.
     *
     * @var InvalidRequestErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `invalid_request`, and `code` says why. Codes: `invalid_body`, `invalid_query`, `invalid_path` or `invalid_headers` when the request does not match the operation's schema, `invalid_cursor` for a cursor the list did not return, or a rule of the operation, such as `billing_period_required`.
     *
     * @return InvalidRequestErrorJsonEncodingError
     */
    public function getError(): InvalidRequestErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `invalid_request`, and `code` says why. Codes: `invalid_body`, `invalid_query`, `invalid_path` or `invalid_headers` when the request does not match the operation's schema, `invalid_cursor` for a cursor the list did not return, or a rule of the operation, such as `billing_period_required`.
     *
     * @param InvalidRequestErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(InvalidRequestErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}