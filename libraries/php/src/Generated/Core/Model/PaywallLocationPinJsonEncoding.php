<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationPinJsonEncoding
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
     * The pin's id, `pw_loc_pin_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The location the end user is pinned at, `pw_loc_...`.
     *
     * @var string
     */
    protected $paywallLocationId;
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @var string
     */
    protected $environment;
    /**
     * How the pinned end user is named: by their `person_id`, a `distinct_id` your app knows them by, or their `email`, compared ignoring case.
     *
     * @var string
     */
    protected $identityType;
    /**
     * The end user's identity of that type; an email is stored in lowercase.
     *
     * @var string
     */
    protected $identityValue;
    /**
     * The paywall the end user is shown here, `pw_...`: its deployed build.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * Why the pin exists; null when it has no note.
     *
     * @var string|null
     */
    protected $note;
    /**
     * When the end user was first pinned here, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The pin's id, `pw_loc_pin_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The pin's id, `pw_loc_pin_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The location the end user is pinned at, `pw_loc_...`.
     *
     * @return string
     */
    public function getPaywallLocationId(): string
    {
        return $this->paywallLocationId;
    }
    /**
     * The location the end user is pinned at, `pw_loc_...`.
     *
     * @param string $paywallLocationId
     *
     * @return self
     */
    public function setPaywallLocationId(string $paywallLocationId): self
    {
        $this->initialized['paywallLocationId'] = true;
        $this->paywallLocationId = $paywallLocationId;
        return $this;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The environment: `production`, or `test`, which a test key reads. Test follows production until a location is given a test showing of its own.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * How the pinned end user is named: by their `person_id`, a `distinct_id` your app knows them by, or their `email`, compared ignoring case.
     *
     * @return string
     */
    public function getIdentityType(): string
    {
        return $this->identityType;
    }
    /**
     * How the pinned end user is named: by their `person_id`, a `distinct_id` your app knows them by, or their `email`, compared ignoring case.
     *
     * @param string $identityType
     *
     * @return self
     */
    public function setIdentityType(string $identityType): self
    {
        $this->initialized['identityType'] = true;
        $this->identityType = $identityType;
        return $this;
    }
    /**
     * The end user's identity of that type; an email is stored in lowercase.
     *
     * @return string
     */
    public function getIdentityValue(): string
    {
        return $this->identityValue;
    }
    /**
     * The end user's identity of that type; an email is stored in lowercase.
     *
     * @param string $identityValue
     *
     * @return self
     */
    public function setIdentityValue(string $identityValue): self
    {
        $this->initialized['identityValue'] = true;
        $this->identityValue = $identityValue;
        return $this;
    }
    /**
     * The paywall the end user is shown here, `pw_...`: its deployed build.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall the end user is shown here, `pw_...`: its deployed build.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * Why the pin exists; null when it has no note.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why the pin exists; null when it has no note.
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
    /**
     * When the end user was first pinned here, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the end user was first pinned here, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}