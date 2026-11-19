<?php

namespace Voidhash\Generated\Core\Model;

class SdkSyncAndroidTransactionBody
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
     * A Google Play purchase.
     *
     * @var string
     */
    protected $platform;
    /**
     * Google Play's opaque purchase token, up to 1024 characters.
     *
     * @var string
     */
    protected $purchaseToken;
    /**
     * Why the SDK reports the transaction: `purchase` for a purchase the end user just made, which goes to this user even when the store account's earlier purchase belongs to another user; `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for the user who owns it. On the App Store, `purchase` and `restore` need `signedTransaction`; without it, or for a purchase the store did not make in the last 24 hours, the server treats the report as `sync`.
     *
     * @var string|null
     */
    protected $intent;
    /**
     * Whether the SDK started this purchase itself, so the server acknowledges it with Google Play once it is recorded. Leave out or `false` for a purchase the app's own billing integration made: the server never acknowledges those.
     *
     * @var bool|null
     */
    protected $isStartedBySdk;
    /**
     * The paywall a purchase was made on. The server checks the showing and derives the rest; a context it cannot use is dropped and the purchase still records.
     *
     * @var SdkPurchasePaywallContext
     */
    protected $paywallContext;
    /**
     * A Google Play purchase.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * A Google Play purchase.
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
     * Google Play's opaque purchase token, up to 1024 characters.
     *
     * @return string
     */
    public function getPurchaseToken(): string
    {
        return $this->purchaseToken;
    }
    /**
     * Google Play's opaque purchase token, up to 1024 characters.
     *
     * @param string $purchaseToken
     *
     * @return self
     */
    public function setPurchaseToken(string $purchaseToken): self
    {
        $this->initialized['purchaseToken'] = true;
        $this->purchaseToken = $purchaseToken;
        return $this;
    }
    /**
     * Why the SDK reports the transaction: `purchase` for a purchase the end user just made, which goes to this user even when the store account's earlier purchase belongs to another user; `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for the user who owns it. On the App Store, `purchase` and `restore` need `signedTransaction`; without it, or for a purchase the store did not make in the last 24 hours, the server treats the report as `sync`.
     *
     * @return string|null
     */
    public function getIntent(): ?string
    {
        return $this->intent;
    }
    /**
     * Why the SDK reports the transaction: `purchase` for a purchase the end user just made, which goes to this user even when the store account's earlier purchase belongs to another user; `restore` for a restore the end user asked for, which may share or move a purchase another user owns as the project's paid access sharing setting allows; `sync` (the default) for anything else, which records it for the user who owns it. On the App Store, `purchase` and `restore` need `signedTransaction`; without it, or for a purchase the store did not make in the last 24 hours, the server treats the report as `sync`.
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
     * Whether the SDK started this purchase itself, so the server acknowledges it with Google Play once it is recorded. Leave out or `false` for a purchase the app's own billing integration made: the server never acknowledges those.
     *
     * @return bool|null
     */
    public function getIsStartedBySdk(): ?bool
    {
        return $this->isStartedBySdk;
    }
    /**
     * Whether the SDK started this purchase itself, so the server acknowledges it with Google Play once it is recorded. Leave out or `false` for a purchase the app's own billing integration made: the server never acknowledges those.
     *
     * @param bool|null $isStartedBySdk
     *
     * @return self
     */
    public function setIsStartedBySdk(?bool $isStartedBySdk): self
    {
        $this->initialized['isStartedBySdk'] = true;
        $this->isStartedBySdk = $isStartedBySdk;
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