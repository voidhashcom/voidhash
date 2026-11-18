<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativeEventJsonEncoding
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
     * The event's key, the camel case of its name in the designer.
     *
     * @var string
     */
    protected $key;
    /**
     * The fields the event carries, by key; empty when it carries none.
     *
     * @var list<SchemaNativePayloadFieldJsonEncoding>
     */
    protected $payload;
    /**
     * The event's key, the camel case of its name in the designer.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The event's key, the camel case of its name in the designer.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The fields the event carries, by key; empty when it carries none.
     *
     * @return list<SchemaNativePayloadFieldJsonEncoding>
     */
    public function getPayload(): array
    {
        return $this->payload;
    }
    /**
     * The fields the event carries, by key; empty when it carries none.
     *
     * @param list<SchemaNativePayloadFieldJsonEncoding> $payload
     *
     * @return self
     */
    public function setPayload(array $payload): self
    {
        $this->initialized['payload'] = true;
        $this->payload = $payload;
        return $this;
    }
}