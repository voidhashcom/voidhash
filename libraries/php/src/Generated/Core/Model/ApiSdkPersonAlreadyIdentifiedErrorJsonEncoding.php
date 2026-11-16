<?php

namespace Voidhash\Generated\Core\Model;

class ApiSdkPersonAlreadyIdentifiedErrorJsonEncoding
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
     * The distinct id the request identified as, which already belongs to another identified person; the two are not merged.
     *
     * @var string
     */
    protected $distinctId;
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
     * The distinct id the request identified as, which already belongs to another identified person; the two are not merged.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id the request identified as, which already belongs to another identified person; the two are not merged.
     *
     * @param string $distinctId
     *
     * @return self
     */
    public function setDistinctId(string $distinctId): self
    {
        $this->initialized['distinctId'] = true;
        $this->distinctId = $distinctId;
        return $this;
    }
}