<?php

namespace Voidhash\Generated\Core\Model;

class ApiWebhookDeliveryNotFoundErrorJsonEncoding
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
     * @var string
     */
    protected $tag;
    /**
     * @var string
     */
    protected $deliveryId;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
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
     * @return string
     */
    public function getDeliveryId(): string
    {
        return $this->deliveryId;
    }
    /**
     * @param string $deliveryId
     *
     * @return self
     */
    public function setDeliveryId(string $deliveryId): self
    {
        $this->initialized['deliveryId'] = true;
        $this->deliveryId = $deliveryId;
        return $this;
    }
}