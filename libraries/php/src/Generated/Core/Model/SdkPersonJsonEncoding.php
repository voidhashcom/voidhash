<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncoding
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
     * The distinct id the person is known by.
     *
     * @var string
     */
    protected $distinctId;
    /**
     * The person's email address; null when unknown.
     *
     * @var string|null
     */
    protected $email;
    /**
     * The person's access to perks.
     *
     * @var SdkPersonJsonEncodingEntitlements
     */
    protected $entitlements;
    /**
     * The person's name; null when unknown.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The person's id, `person_...`.
     *
     * @var string
     */
    protected $personId;
    /**
     * The person's purchases.
     *
     * @var SdkPersonJsonEncodingPurchases
     */
    protected $purchases;
    /**
     * Which persons this response is built from.
     *
     * @var SdkPersonJsonEncodingSnapshotContext
     */
    protected $snapshotContext;
    /**
     * The person's subscriptions.
     *
     * @var SdkPersonJsonEncodingSubscriptions
     */
    protected $subscriptions;
    /**
     * The distinct id the person is known by.
     *
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
     * The distinct id the person is known by.
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
    /**
     * The person's email address; null when unknown.
     *
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
     * The person's email address; null when unknown.
     *
     * @param string|null $email
     *
     * @return self
     */
    public function setEmail(?string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * The person's access to perks.
     *
     * @return SdkPersonJsonEncodingEntitlements
     */
    public function getEntitlements(): SdkPersonJsonEncodingEntitlements
    {
        return $this->entitlements;
    }
    /**
     * The person's access to perks.
     *
     * @param SdkPersonJsonEncodingEntitlements $entitlements
     *
     * @return self
     */
    public function setEntitlements(SdkPersonJsonEncodingEntitlements $entitlements): self
    {
        $this->initialized['entitlements'] = true;
        $this->entitlements = $entitlements;
        return $this;
    }
    /**
     * The person's name; null when unknown.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The person's name; null when unknown.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The person's id, `person_...`.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person's id, `person_...`.
     *
     * @param string $personId
     *
     * @return self
     */
    public function setPersonId(string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * The person's purchases.
     *
     * @return SdkPersonJsonEncodingPurchases
     */
    public function getPurchases(): SdkPersonJsonEncodingPurchases
    {
        return $this->purchases;
    }
    /**
     * The person's purchases.
     *
     * @param SdkPersonJsonEncodingPurchases $purchases
     *
     * @return self
     */
    public function setPurchases(SdkPersonJsonEncodingPurchases $purchases): self
    {
        $this->initialized['purchases'] = true;
        $this->purchases = $purchases;
        return $this;
    }
    /**
     * Which persons this response is built from.
     *
     * @return SdkPersonJsonEncodingSnapshotContext
     */
    public function getSnapshotContext(): SdkPersonJsonEncodingSnapshotContext
    {
        return $this->snapshotContext;
    }
    /**
     * Which persons this response is built from.
     *
     * @param SdkPersonJsonEncodingSnapshotContext $snapshotContext
     *
     * @return self
     */
    public function setSnapshotContext(SdkPersonJsonEncodingSnapshotContext $snapshotContext): self
    {
        $this->initialized['snapshotContext'] = true;
        $this->snapshotContext = $snapshotContext;
        return $this;
    }
    /**
     * The person's subscriptions.
     *
     * @return SdkPersonJsonEncodingSubscriptions
     */
    public function getSubscriptions(): SdkPersonJsonEncodingSubscriptions
    {
        return $this->subscriptions;
    }
    /**
     * The person's subscriptions.
     *
     * @param SdkPersonJsonEncodingSubscriptions $subscriptions
     *
     * @return self
     */
    public function setSubscriptions(SdkPersonJsonEncodingSubscriptions $subscriptions): self
    {
        $this->initialized['subscriptions'] = true;
        $this->subscriptions = $subscriptions;
        return $this;
    }
}