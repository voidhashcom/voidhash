<?php

namespace Voidhash\Generated\Core\Model;

class SandboxStateJsonEncoding
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
     * The person the state is of.
     *
     * @var string
     */
    protected $personId;
    /**
     * The person's perk grants in the test environment, one per perk. Stripe test mode and payment source test purchases grant them as well as sandbox purchases.
     *
     * @var list<SandboxGrantJsonEncoding>
     */
    protected $grants;
    /**
     * The person's one-time sandbox purchases.
     *
     * @var list<SandboxPurchaseJsonEncoding>
     */
    protected $purchases;
    /**
     * The person's sandbox subscriptions.
     *
     * @var list<SandboxSubscriptionJsonEncoding>
     */
    protected $subscriptions;
    /**
     * The person the state is of.
     *
     * @return string
     */
    public function getPersonId(): string
    {
        return $this->personId;
    }
    /**
     * The person the state is of.
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
     * The person's perk grants in the test environment, one per perk. Stripe test mode and payment source test purchases grant them as well as sandbox purchases.
     *
     * @return list<SandboxGrantJsonEncoding>
     */
    public function getGrants(): array
    {
        return $this->grants;
    }
    /**
     * The person's perk grants in the test environment, one per perk. Stripe test mode and payment source test purchases grant them as well as sandbox purchases.
     *
     * @param list<SandboxGrantJsonEncoding> $grants
     *
     * @return self
     */
    public function setGrants(array $grants): self
    {
        $this->initialized['grants'] = true;
        $this->grants = $grants;
        return $this;
    }
    /**
     * The person's one-time sandbox purchases.
     *
     * @return list<SandboxPurchaseJsonEncoding>
     */
    public function getPurchases(): array
    {
        return $this->purchases;
    }
    /**
     * The person's one-time sandbox purchases.
     *
     * @param list<SandboxPurchaseJsonEncoding> $purchases
     *
     * @return self
     */
    public function setPurchases(array $purchases): self
    {
        $this->initialized['purchases'] = true;
        $this->purchases = $purchases;
        return $this;
    }
    /**
     * The person's sandbox subscriptions.
     *
     * @return list<SandboxSubscriptionJsonEncoding>
     */
    public function getSubscriptions(): array
    {
        return $this->subscriptions;
    }
    /**
     * The person's sandbox subscriptions.
     *
     * @param list<SandboxSubscriptionJsonEncoding> $subscriptions
     *
     * @return self
     */
    public function setSubscriptions(array $subscriptions): self
    {
        $this->initialized['subscriptions'] = true;
        $this->subscriptions = $subscriptions;
        return $this;
    }
}