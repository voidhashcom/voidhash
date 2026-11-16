<?php

namespace Voidhash\Generated\Core\Model;

class PersonPurchasePaymentSource
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
     * The payment source's slug.
     *
     * @var string
     */
    protected $slug;
    /**
     * The payment source's own id for the purchase or subscription.
     *
     * @var string
     */
    protected $recordId;
    /**
     * The payment source's slug.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The payment source's slug.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * The payment source's own id for the purchase or subscription.
     *
     * @return string
     */
    public function getRecordId(): string
    {
        return $this->recordId;
    }
    /**
     * The payment source's own id for the purchase or subscription.
     *
     * @param string $recordId
     *
     * @return self
     */
    public function setRecordId(string $recordId): self
    {
        $this->initialized['recordId'] = true;
        $this->recordId = $recordId;
        return $this;
    }
}