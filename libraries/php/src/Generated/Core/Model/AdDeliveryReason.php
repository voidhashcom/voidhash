<?php

namespace Voidhash\Generated\Core\Model;

class AdDeliveryReason
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
     * Voidhash's code for the reason, such as `learning_limited` or `rejected`.
     *
     * @var string
     */
    protected $code;
    /**
     * `blocking` when it stops delivery, `limiting` when it only reduces it.
     *
     * @var string
     */
    protected $severity;
    /**
     * The platform's own text.
     *
     * @var string
     */
    protected $message;
    /**
     * Voidhash's code for the reason, such as `learning_limited` or `rejected`.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * Voidhash's code for the reason, such as `learning_limited` or `rejected`.
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
     * `blocking` when it stops delivery, `limiting` when it only reduces it.
     *
     * @return string
     */
    public function getSeverity(): string
    {
        return $this->severity;
    }
    /**
     * `blocking` when it stops delivery, `limiting` when it only reduces it.
     *
     * @param string $severity
     *
     * @return self
     */
    public function setSeverity(string $severity): self
    {
        $this->initialized['severity'] = true;
        $this->severity = $severity;
        return $this;
    }
    /**
     * The platform's own text.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * The platform's own text.
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
}