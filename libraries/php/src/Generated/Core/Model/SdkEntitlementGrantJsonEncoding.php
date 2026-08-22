<?php

namespace Voidhash\Generated\Core\Model;

class SdkEntitlementGrantJsonEncoding
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
     * @var string|null
     */
    protected $expiresAt;
    /**
     * @var string
     */
    protected $perkId;
    /**
     * @var string
     */
    protected $source;
    /**
     * @var string|null
     */
    protected $sourceId;
    /**
     * @var string
     */
    protected $sourcePersonId;
    /**
     * @var string
     */
    protected $status;
    /**
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * @param string|null $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(?string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getPerkId(): string
    {
        return $this->perkId;
    }
    /**
     * @param string $perkId
     *
     * @return self
     */
    public function setPerkId(string $perkId): self
    {
        $this->initialized['perkId'] = true;
        $this->perkId = $perkId;
        return $this;
    }
    /**
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }
    /**
     * @param string|null $sourceId
     *
     * @return self
     */
    public function setSourceId(?string $sourceId): self
    {
        $this->initialized['sourceId'] = true;
        $this->sourceId = $sourceId;
        return $this;
    }
    /**
     * @return string
     */
    public function getSourcePersonId(): string
    {
        return $this->sourcePersonId;
    }
    /**
     * @param string $sourcePersonId
     *
     * @return self
     */
    public function setSourcePersonId(string $sourcePersonId): self
    {
        $this->initialized['sourcePersonId'] = true;
        $this->sourcePersonId = $sourcePersonId;
        return $this;
    }
    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
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
}