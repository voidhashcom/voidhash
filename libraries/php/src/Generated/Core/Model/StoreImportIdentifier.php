<?php

namespace Voidhash\Generated\Core\Model;

class StoreImportIdentifier
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
     * For an App Store import: any App Store transaction id of the purchase, usually its original transaction id; the App Store reads the whole subscription from it.
     *
     * @var string|null
     */
    protected $transactionId;
    /**
     * For a Google Play import: the purchase's Google Play purchase token, as Google Play Billing gave it to the app. For a subscription that was upgraded, downgraded or resubscribed, the latest token says the most; earlier tokens are recorded as ended.
     *
     * @var string|null
     */
    protected $purchaseToken;
    /**
     * Your id for the person who bought it, the distinct id your app identifies them with. Without it the purchase is recorded for an anonymous person until your app reports it.
     *
     * @var string|null
     */
    protected $appUserId;
    /**
     * For an App Store import: any App Store transaction id of the purchase, usually its original transaction id; the App Store reads the whole subscription from it.
     *
     * @return string|null
     */
    public function getTransactionId(): ?string
    {
        return $this->transactionId;
    }
    /**
     * For an App Store import: any App Store transaction id of the purchase, usually its original transaction id; the App Store reads the whole subscription from it.
     *
     * @param string|null $transactionId
     *
     * @return self
     */
    public function setTransactionId(?string $transactionId): self
    {
        $this->initialized['transactionId'] = true;
        $this->transactionId = $transactionId;
        return $this;
    }
    /**
     * For a Google Play import: the purchase's Google Play purchase token, as Google Play Billing gave it to the app. For a subscription that was upgraded, downgraded or resubscribed, the latest token says the most; earlier tokens are recorded as ended.
     *
     * @return string|null
     */
    public function getPurchaseToken(): ?string
    {
        return $this->purchaseToken;
    }
    /**
     * For a Google Play import: the purchase's Google Play purchase token, as Google Play Billing gave it to the app. For a subscription that was upgraded, downgraded or resubscribed, the latest token says the most; earlier tokens are recorded as ended.
     *
     * @param string|null $purchaseToken
     *
     * @return self
     */
    public function setPurchaseToken(?string $purchaseToken): self
    {
        $this->initialized['purchaseToken'] = true;
        $this->purchaseToken = $purchaseToken;
        return $this;
    }
    /**
     * Your id for the person who bought it, the distinct id your app identifies them with. Without it the purchase is recorded for an anonymous person until your app reports it.
     *
     * @return string|null
     */
    public function getAppUserId(): ?string
    {
        return $this->appUserId;
    }
    /**
     * Your id for the person who bought it, the distinct id your app identifies them with. Without it the purchase is recorded for an anonymous person until your app reports it.
     *
     * @param string|null $appUserId
     *
     * @return self
     */
    public function setAppUserId(?string $appUserId): self
    {
        $this->initialized['appUserId'] = true;
        $this->appUserId = $appUserId;
        return $this;
    }
}