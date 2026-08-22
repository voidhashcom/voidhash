<?php

namespace Voidhash\Generated\Core\Model;

class ApiWebhookEndpointNotFoundErrorJsonEncoding
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
    protected $endpointId;
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
    public function getEndpointId(): string
    {
        return $this->endpointId;
    }
    /**
     * @param string $endpointId
     *
     * @return self
     */
    public function setEndpointId(string $endpointId): self
    {
        $this->initialized['endpointId'] = true;
        $this->endpointId = $endpointId;
        return $this;
    }
}