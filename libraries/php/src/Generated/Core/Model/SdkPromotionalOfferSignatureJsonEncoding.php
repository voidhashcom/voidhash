<?php

namespace Voidhash\Generated\Core\Model;

class SdkPromotionalOfferSignatureJsonEncoding
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
     * The offer's identifier in App Store Connect.
     *
     * @var string
     */
    protected $offerIdentifier;
    /**
     * The id of the In-App Purchase key that signed the offer.
     *
     * @var string
     */
    protected $keyIdentifier;
    /**
     * A lowercase UUID, new for every signature.
     *
     * @var string
     */
    protected $nonce;
    /**
     * The Base64 DER ECDSA signature.
     *
     * @var string
     */
    protected $signature;
    /**
     * When the offer was signed, in milliseconds since the Unix epoch.
     *
     * @var mixed
     */
    protected $timestamp;
    /**
     * The lowercase app account token the signature was made for; the purchase must set it.
     *
     * @var string
     */
    protected $appAccountToken;
    /**
     * The offer signed as the compact JWS StoreKit's `Product.PurchaseOption.promotionalOffer(_:compactJWS:)` takes, preferred over the legacy fields. Absent when the server cannot sign one, such as when the In-App Purchase key's issuer id is missing.
     *
     * @var string
     */
    protected $signatureJws;
    /**
     * The offer's identifier in App Store Connect.
     *
     * @return string
     */
    public function getOfferIdentifier(): string
    {
        return $this->offerIdentifier;
    }
    /**
     * The offer's identifier in App Store Connect.
     *
     * @param string $offerIdentifier
     *
     * @return self
     */
    public function setOfferIdentifier(string $offerIdentifier): self
    {
        $this->initialized['offerIdentifier'] = true;
        $this->offerIdentifier = $offerIdentifier;
        return $this;
    }
    /**
     * The id of the In-App Purchase key that signed the offer.
     *
     * @return string
     */
    public function getKeyIdentifier(): string
    {
        return $this->keyIdentifier;
    }
    /**
     * The id of the In-App Purchase key that signed the offer.
     *
     * @param string $keyIdentifier
     *
     * @return self
     */
    public function setKeyIdentifier(string $keyIdentifier): self
    {
        $this->initialized['keyIdentifier'] = true;
        $this->keyIdentifier = $keyIdentifier;
        return $this;
    }
    /**
     * A lowercase UUID, new for every signature.
     *
     * @return string
     */
    public function getNonce(): string
    {
        return $this->nonce;
    }
    /**
     * A lowercase UUID, new for every signature.
     *
     * @param string $nonce
     *
     * @return self
     */
    public function setNonce(string $nonce): self
    {
        $this->initialized['nonce'] = true;
        $this->nonce = $nonce;
        return $this;
    }
    /**
     * The Base64 DER ECDSA signature.
     *
     * @return string
     */
    public function getSignature(): string
    {
        return $this->signature;
    }
    /**
     * The Base64 DER ECDSA signature.
     *
     * @param string $signature
     *
     * @return self
     */
    public function setSignature(string $signature): self
    {
        $this->initialized['signature'] = true;
        $this->signature = $signature;
        return $this;
    }
    /**
     * When the offer was signed, in milliseconds since the Unix epoch.
     *
     * @return mixed
     */
    public function getTimestamp()
    {
        return $this->timestamp;
    }
    /**
     * When the offer was signed, in milliseconds since the Unix epoch.
     *
     * @param mixed $timestamp
     *
     * @return self
     */
    public function setTimestamp($timestamp): self
    {
        $this->initialized['timestamp'] = true;
        $this->timestamp = $timestamp;
        return $this;
    }
    /**
     * The lowercase app account token the signature was made for; the purchase must set it.
     *
     * @return string
     */
    public function getAppAccountToken(): string
    {
        return $this->appAccountToken;
    }
    /**
     * The lowercase app account token the signature was made for; the purchase must set it.
     *
     * @param string $appAccountToken
     *
     * @return self
     */
    public function setAppAccountToken(string $appAccountToken): self
    {
        $this->initialized['appAccountToken'] = true;
        $this->appAccountToken = $appAccountToken;
        return $this;
    }
    /**
     * The offer signed as the compact JWS StoreKit's `Product.PurchaseOption.promotionalOffer(_:compactJWS:)` takes, preferred over the legacy fields. Absent when the server cannot sign one, such as when the In-App Purchase key's issuer id is missing.
     *
     * @return string
     */
    public function getSignatureJws(): string
    {
        return $this->signatureJws;
    }
    /**
     * The offer signed as the compact JWS StoreKit's `Product.PurchaseOption.promotionalOffer(_:compactJWS:)` takes, preferred over the legacy fields. Absent when the server cannot sign one, such as when the In-App Purchase key's issuer id is missing.
     *
     * @param string $signatureJws
     *
     * @return self
     */
    public function setSignatureJws(string $signatureJws): self
    {
        $this->initialized['signatureJws'] = true;
        $this->signatureJws = $signatureJws;
        return $this;
    }
}