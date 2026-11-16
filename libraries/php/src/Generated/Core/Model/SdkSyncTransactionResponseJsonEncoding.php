<?php

namespace Voidhash\Generated\Core\Model;

class SdkSyncTransactionResponseJsonEncoding
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
     * Always `true`: the transaction was verified and recorded.
     *
     * @var bool
     */
    protected $accepted;
    /**
     * Whether the store product is not linked to a product yet. The purchase is kept and grants its perks once the store product is linked.
     *
     * @var bool
     */
    protected $pendingProductLink;
    /**
     * Always `true`: the transaction was verified and recorded.
     *
     * @return bool
     */
    public function getAccepted(): bool
    {
        return $this->accepted;
    }
    /**
     * Always `true`: the transaction was verified and recorded.
     *
     * @param bool $accepted
     *
     * @return self
     */
    public function setAccepted(bool $accepted): self
    {
        $this->initialized['accepted'] = true;
        $this->accepted = $accepted;
        return $this;
    }
    /**
     * Whether the store product is not linked to a product yet. The purchase is kept and grants its perks once the store product is linked.
     *
     * @return bool
     */
    public function getPendingProductLink(): bool
    {
        return $this->pendingProductLink;
    }
    /**
     * Whether the store product is not linked to a product yet. The purchase is kept and grants its perks once the store product is linked.
     *
     * @param bool $pendingProductLink
     *
     * @return self
     */
    public function setPendingProductLink(bool $pendingProductLink): self
    {
        $this->initialized['pendingProductLink'] = true;
        $this->pendingProductLink = $pendingProductLink;
        return $this;
    }
}