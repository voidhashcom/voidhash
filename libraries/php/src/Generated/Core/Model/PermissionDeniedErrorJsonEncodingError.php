<?php

namespace Voidhash\Generated\Core\Model;

class PermissionDeniedErrorJsonEncodingError
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
     * The broad outcome, which matches the HTTP status.
     *
     * @var string
     */
    protected $type;
    /**
     * The machine-readable reason, such as `product_not_found`. Codes are stable: branch on `type` and `code`, never on `message`.
     *
     * @var string
     */
    protected $code;
    /**
     * What went wrong, written for the person reading it. It can change, so do not parse it.
     *
     * @var string
     */
    protected $message;
    /**
     * The request field the error concerns, when there is one.
     *
     * @var string|null
     */
    protected $param;
    /**
     * The broad outcome, which matches the HTTP status.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The broad outcome, which matches the HTTP status.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The machine-readable reason, such as `product_not_found`. Codes are stable: branch on `type` and `code`, never on `message`.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * The machine-readable reason, such as `product_not_found`. Codes are stable: branch on `type` and `code`, never on `message`.
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
     * What went wrong, written for the person reading it. It can change, so do not parse it.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What went wrong, written for the person reading it. It can change, so do not parse it.
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
     * The request field the error concerns, when there is one.
     *
     * @return string|null
     */
    public function getParam(): ?string
    {
        return $this->param;
    }
    /**
     * The request field the error concerns, when there is one.
     *
     * @param string|null $param
     *
     * @return self
     */
    public function setParam(?string $param): self
    {
        $this->initialized['param'] = true;
        $this->param = $param;
        return $this;
    }
}