<?php

namespace Voidhash\Generated\Core\Model;

class ApiSdkTransactionRejectedErrorJsonEncoding
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
     * The error's machine-readable code. Branch on it, never on the message.
     *
     * @var string
     */
    protected $tag;
    /**
     * Why the store transaction was refused, for diagnostics. Sending it again cannot succeed.
     *
     * @var string
     */
    protected $reason;
    /**
     * The error's machine-readable code. Branch on it, never on the message.
     *
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * The error's machine-readable code. Branch on it, never on the message.
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
     * Why the store transaction was refused, for diagnostics. Sending it again cannot succeed.
     *
     * @return string
     */
    public function getReason(): string
    {
        return $this->reason;
    }
    /**
     * Why the store transaction was refused, for diagnostics. Sending it again cannot succeed.
     *
     * @param string $reason
     *
     * @return self
     */
    public function setReason(string $reason): self
    {
        $this->initialized['reason'] = true;
        $this->reason = $reason;
        return $this;
    }
}