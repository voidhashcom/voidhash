<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagIdentityRef
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
     * How the end user is named: by their `person_id`, a `distinct_id` your app knows them by, their `email`, or an `external_id`.
     *
     * @var string
     */
    protected $identityType;
    /**
     * The end user's identity of that type.
     *
     * @var string
     */
    protected $identityValue;
    /**
     * How the end user is named: by their `person_id`, a `distinct_id` your app knows them by, their `email`, or an `external_id`.
     *
     * @return string
     */
    public function getIdentityType(): string
    {
        return $this->identityType;
    }
    /**
     * How the end user is named: by their `person_id`, a `distinct_id` your app knows them by, their `email`, or an `external_id`.
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
     * The end user's identity of that type.
     *
     * @return string
     */
    public function getIdentityValue(): string
    {
        return $this->identityValue;
    }
    /**
     * The end user's identity of that type.
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
}