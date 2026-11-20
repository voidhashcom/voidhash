<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderProductMoveRefusal
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
     * The `code` of the error `move` would fail with: `store_product_already_on_product`, `product_type_mismatch`, `product_duration_mismatch`, `store_product_already_mapped`, `target_mapping_has_purchases` or `revenue_history_not_ready`.
     *
     * @var string
     */
    protected $code;
    /**
     * Why, written for the person reading it.
     *
     * @var string
     */
    protected $message;
    /**
     * The `code` of the error `move` would fail with: `store_product_already_on_product`, `product_type_mismatch`, `product_duration_mismatch`, `store_product_already_mapped`, `target_mapping_has_purchases` or `revenue_history_not_ready`.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * The `code` of the error `move` would fail with: `store_product_already_on_product`, `product_type_mismatch`, `product_duration_mismatch`, `store_product_already_mapped`, `target_mapping_has_purchases` or `revenue_history_not_ready`.
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
     * Why, written for the person reading it.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * Why, written for the person reading it.
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