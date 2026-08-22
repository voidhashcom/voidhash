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
     * @var string
     */
    protected $distinctId;
    /**
     * @var string|null
     */
    protected $email;
    /**
     * @var SdkPersonJsonEncodingEntitlements
     */
    protected $entitlements;
    /**
     * @var string|null
     */
    protected $name;
    /**
     * @var string
     */
    protected $personId;
    /**
     * @var SdkPersonJsonEncodingPurchases
     */
    protected $purchases;
    /**
     * @var SdkPersonJsonEncodingSnapshotContext
     */
    protected $snapshotContext;
    /**
     * @var SdkPersonJsonEncodingSubscriptions
     */
    protected $subscriptions;
    /**
     * @return string
     */
    public function getDistinctId(): string
    {
        return $this->distinctId;
    }
    /**
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
     * @return string|null
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }
    /**
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
     * @return SdkPersonJsonEncodingEntitlements
     */
    public function getEntitlements(): SdkPersonJsonEncodingEntitlements
    {
        return $this->entitlements;
    }
    /**
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
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
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
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
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
     * @return SdkPersonJsonEncodingPurchases
     */
    public function getPurchases(): SdkPersonJsonEncodingPurchases
    {
        return $this->purchases;
    }
    /**
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
     * @return SdkPersonJsonEncodingSnapshotContext
     */
    public function getSnapshotContext(): SdkPersonJsonEncodingSnapshotContext
    {
        return $this->snapshotContext;
    }
    /**
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
     * @return SdkPersonJsonEncodingSubscriptions
     */
    public function getSubscriptions(): SdkPersonJsonEncodingSubscriptions
    {
        return $this->subscriptions;
    }
    /**
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