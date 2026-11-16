<?php

namespace Voidhash\Generated\Core\Model;

class UnauthenticatedErrorJsonEncoding
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
     * The error: `type` is `unauthenticated`, and `code` says why. Codes: `missing_credential`, `malformed_authorization`, `invalid_api_key`, `expired_api_key`, `invalid_token`, `session_ended`, `publishable_key_not_allowed` or `credential_not_accepted`.
     *
     * @var UnauthenticatedErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `unauthenticated`, and `code` says why. Codes: `missing_credential`, `malformed_authorization`, `invalid_api_key`, `expired_api_key`, `invalid_token`, `session_ended`, `publishable_key_not_allowed` or `credential_not_accepted`.
     *
     * @return UnauthenticatedErrorJsonEncodingError
     */
    public function getError(): UnauthenticatedErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `unauthenticated`, and `code` says why. Codes: `missing_credential`, `malformed_authorization`, `invalid_api_key`, `expired_api_key`, `invalid_token`, `session_ended`, `publishable_key_not_allowed` or `credential_not_accepted`.
     *
     * @param UnauthenticatedErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(UnauthenticatedErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}