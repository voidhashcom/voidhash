<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderConnectionCheck
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
     * What the check found: `working`, `failing` (something to fix, which `message` names), `pending` (waiting on the store, such as Google Play applying a new permission, which can take a day or more) or `unverified` (the store didn't answer).
     *
     * @var string
     */
    protected $status;
    /**
     * Why, as a stable code: `working`, `credentials_rejected`, `private_key_invalid`, `app_not_found`, `app_apple_id_mismatch`, `account_mismatch`, `permission_pending`, `permission_missing`, `api_disabled`, `store_unavailable`, `incomplete`, among others.
     *
     * @var string
     */
    protected $code;
    /**
     * What the check found and what to do about it, for a person to read.
     *
     * @var string
     */
    protected $message;
    /**
     * @var string
     */
    protected $checkedAt;
    /**
     * What the check found: `working`, `failing` (something to fix, which `message` names), `pending` (waiting on the store, such as Google Play applying a new permission, which can take a day or more) or `unverified` (the store didn't answer).
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * What the check found: `working`, `failing` (something to fix, which `message` names), `pending` (waiting on the store, such as Google Play applying a new permission, which can take a day or more) or `unverified` (the store didn't answer).
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * Why, as a stable code: `working`, `credentials_rejected`, `private_key_invalid`, `app_not_found`, `app_apple_id_mismatch`, `account_mismatch`, `permission_pending`, `permission_missing`, `api_disabled`, `store_unavailable`, `incomplete`, among others.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * Why, as a stable code: `working`, `credentials_rejected`, `private_key_invalid`, `app_not_found`, `app_apple_id_mismatch`, `account_mismatch`, `permission_pending`, `permission_missing`, `api_disabled`, `store_unavailable`, `incomplete`, among others.
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
     * What the check found and what to do about it, for a person to read.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What the check found and what to do about it, for a person to read.
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
    /**
     * @return string
     */
    public function getCheckedAt(): string
    {
        return $this->checkedAt;
    }
    /**
     * @param string $checkedAt
     *
     * @return self
     */
    public function setCheckedAt(string $checkedAt): self
    {
        $this->initialized['checkedAt'] = true;
        $this->checkedAt = $checkedAt;
        return $this;
    }
}