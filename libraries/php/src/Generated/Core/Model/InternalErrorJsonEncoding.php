<?php

namespace Voidhash\Generated\Core\Model;

class InternalErrorJsonEncoding
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
     * The error: `type` is `internal`, and `code` says why. Codes: `internal_error`, or `authentication_unavailable` when the credential could not be checked.
     *
     * @var InternalErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `internal`, and `code` says why. Codes: `internal_error`, or `authentication_unavailable` when the credential could not be checked.
     *
     * @return InternalErrorJsonEncodingError
     */
    public function getError(): InternalErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `internal`, and `code` says why. Codes: `internal_error`, or `authentication_unavailable` when the credential could not be checked.
     *
     * @param InternalErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(InternalErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}