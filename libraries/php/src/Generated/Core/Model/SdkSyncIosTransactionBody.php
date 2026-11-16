<?php

namespace Voidhash\Generated\Core\Model;

class SdkSyncIosTransactionBody
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
     * An App Store transaction.
     *
     * @var string
     */
    protected $platform;
    /**
     * StoreKit's transaction id, a decimal integer.
     *
     * @var string
     */
    protected $transactionId;
    /**
     * Why the SDK reports the transaction: `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for this user.
     *
     * @var string|null
     */
    protected $intent;
    /**
     * The paywall a purchase was made on. The server checks the showing and derives the rest; a context it cannot use is dropped and the purchase still records.
     *
     * @var SdkPurchasePaywallContext
     */
    protected $paywallContext;
    /**
     * An App Store transaction.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * An App Store transaction.
     *
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * StoreKit's transaction id, a decimal integer.
     *
     * @return string
     */
    public function getTransactionId(): string
    {
        return $this->transactionId;
    }
    /**
     * StoreKit's transaction id, a decimal integer.
     *
     * @param string $transactionId
     *
     * @return self
     */
    public function setTransactionId(string $transactionId): self
    {
        $this->initialized['transactionId'] = true;
        $this->transactionId = $transactionId;
        return $this;
    }
    /**
     * Why the SDK reports the transaction: `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for this user.
     *
     * @return string|null
     */
    public function getIntent(): ?string
    {
        return $this->intent;
    }
    /**
     * Why the SDK reports the transaction: `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for this user.
     *
     * @param string|null $intent
     *
     * @return self
     */
    public function setIntent(?string $intent): self
    {
        $this->initialized['intent'] = true;
        $this->intent = $intent;
        return $this;
    }
    /**
     * The paywall a purchase was made on. The server checks the showing and derives the rest; a context it cannot use is dropped and the purchase still records.
     *
     * @return SdkPurchasePaywallContext
     */
    public function getPaywallContext(): SdkPurchasePaywallContext
    {
        return $this->paywallContext;
    }
    /**
     * The paywall a purchase was made on. The server checks the showing and derives the rest; a context it cannot use is dropped and the purchase still records.
     *
     * @param SdkPurchasePaywallContext $paywallContext
     *
     * @return self
     */
    public function setPaywallContext(SdkPurchasePaywallContext $paywallContext): self
    {
        $this->initialized['paywallContext'] = true;
        $this->paywallContext = $paywallContext;
        return $this;
    }
}