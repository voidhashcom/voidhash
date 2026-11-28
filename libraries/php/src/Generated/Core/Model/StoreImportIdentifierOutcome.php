<?php

namespace Voidhash\Generated\Core\Model;

class StoreImportIdentifierOutcome
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
     * The App Store transaction id as it was added; null in a Google Play import.
     *
     * @var string|null
     */
    protected $transactionId;
    /**
     * The Google Play purchase token as it was added; null in an App Store import.
     *
     * @var string|null
     */
    protected $purchaseToken;
    /**
     * Your id for its buyer as it was added; null without one.
     *
     * @var string|null
     */
    protected $appUserId;
    /**
     * `pending` until it is looked up; `imported`; `already_known` when Voidhash already recorded the purchase, which is left as it is; `waiting_for_product` until its store product is mapped to a product; `not_found` when the store has no such purchase for this app; `other_environment` when the store has it in the other environment (a Google Play license tester's purchase belongs to `test`); `no_longer_available` when Google Play no longer answers for a purchase that ended long ago; `not_paid` when Google Play has not been paid for it, so it grants nothing; `other_app` when an App Store transaction belongs to another app; `invalid` when it is not an identifier of the store or its records could not be verified.
     *
     * @var string
     */
    protected $outcome;
    /**
     * Why, in words, for anything but `pending` and `imported`; for `imported`, anything to act on, such as a Google Play purchase still waiting for acknowledgement; otherwise null.
     *
     * @var string|null
     */
    protected $note;
    /**
     * The App Store transaction id as it was added; null in a Google Play import.
     *
     * @return string|null
     */
    public function getTransactionId(): ?string
    {
        return $this->transactionId;
    }
    /**
     * The App Store transaction id as it was added; null in a Google Play import.
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
     * The Google Play purchase token as it was added; null in an App Store import.
     *
     * @return string|null
     */
    public function getPurchaseToken(): ?string
    {
        return $this->purchaseToken;
    }
    /**
     * The Google Play purchase token as it was added; null in an App Store import.
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
     * Your id for its buyer as it was added; null without one.
     *
     * @return string|null
     */
    public function getAppUserId(): ?string
    {
        return $this->appUserId;
    }
    /**
     * Your id for its buyer as it was added; null without one.
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
    /**
     * `pending` until it is looked up; `imported`; `already_known` when Voidhash already recorded the purchase, which is left as it is; `waiting_for_product` until its store product is mapped to a product; `not_found` when the store has no such purchase for this app; `other_environment` when the store has it in the other environment (a Google Play license tester's purchase belongs to `test`); `no_longer_available` when Google Play no longer answers for a purchase that ended long ago; `not_paid` when Google Play has not been paid for it, so it grants nothing; `other_app` when an App Store transaction belongs to another app; `invalid` when it is not an identifier of the store or its records could not be verified.
     *
     * @return string
     */
    public function getOutcome(): string
    {
        return $this->outcome;
    }
    /**
     * `pending` until it is looked up; `imported`; `already_known` when Voidhash already recorded the purchase, which is left as it is; `waiting_for_product` until its store product is mapped to a product; `not_found` when the store has no such purchase for this app; `other_environment` when the store has it in the other environment (a Google Play license tester's purchase belongs to `test`); `no_longer_available` when Google Play no longer answers for a purchase that ended long ago; `not_paid` when Google Play has not been paid for it, so it grants nothing; `other_app` when an App Store transaction belongs to another app; `invalid` when it is not an identifier of the store or its records could not be verified.
     *
     * @param string $outcome
     *
     * @return self
     */
    public function setOutcome(string $outcome): self
    {
        $this->initialized['outcome'] = true;
        $this->outcome = $outcome;
        return $this;
    }
    /**
     * Why, in words, for anything but `pending` and `imported`; for `imported`, anything to act on, such as a Google Play purchase still waiting for acknowledgement; otherwise null.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why, in words, for anything but `pending` and `imported`; for `imported`, anything to act on, such as a Google Play purchase still waiting for acknowledgement; otherwise null.
     *
     * @param string|null $note
     *
     * @return self
     */
    public function setNote(?string $note): self
    {
        $this->initialized['note'] = true;
        $this->note = $note;
        return $this;
    }
}