<?php

namespace Voidhash\Generated\Core\Model;

class PermissionDeniedErrorJsonEncoding
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
     * The error: `type` is `permission_denied`, and `code` says why. Codes: `permission_denied` when the credential lacks a permission, `person_credential_required` when only a signed-in person can do it, or another the operation names.
     *
     * @var PermissionDeniedErrorJsonEncodingError
     */
    protected $error;
    /**
     * The error: `type` is `permission_denied`, and `code` says why. Codes: `permission_denied` when the credential lacks a permission, `person_credential_required` when only a signed-in person can do it, or another the operation names.
     *
     * @return PermissionDeniedErrorJsonEncodingError
     */
    public function getError(): PermissionDeniedErrorJsonEncodingError
    {
        return $this->error;
    }
    /**
     * The error: `type` is `permission_denied`, and `code` says why. Codes: `permission_denied` when the credential lacks a permission, `person_credential_required` when only a signed-in person can do it, or another the operation names.
     *
     * @param PermissionDeniedErrorJsonEncodingError $error
     *
     * @return self
     */
    public function setError(PermissionDeniedErrorJsonEncodingError $error): self
    {
        $this->initialized['error'] = true;
        $this->error = $error;
        return $this;
    }
}