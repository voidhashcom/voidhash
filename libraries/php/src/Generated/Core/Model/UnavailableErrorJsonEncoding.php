<?php

namespace Voidhash\Generated\Core\Model;

class UnavailableErrorJsonEncoding
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
     * The error: `type` is `unavailable`, and `code` says why. Codes name what is unavailable, such as `file_storage_unavailable`.
     *
     * @var UnavailableErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `unavailable`, and `code` says why. Codes name what is unavailable, such as `file_storage_unavailable`.
     *
     * @return UnavailableErrorJsonEncodingError
     */
    public function getError(): UnavailableErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `unavailable`, and `code` says why. Codes name what is unavailable, such as `file_storage_unavailable`.
     *
     * @param UnavailableErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(UnavailableErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}