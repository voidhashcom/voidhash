<?php

namespace Voidhash\Generated\Core\Model;

class MetaMeasurementSettingsJsonEncodingConversionsWithheld
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
     * Purchases of people whose `$ad_data_sharing` trait is not `true`.
     *
     * @var int
     */
    protected $noAdDataSharing;
    /**
     * Purchases of people with no email, `$fbc` or `$fbp` for Meta to match them by.
     *
     * @var int
     */
    protected $noMatchKey;
    /**
     * Purchases of people who are erased, deleted or being erased.
     *
     * @var int
     */
    protected $personGone;
    /**
     * Purchases that were refunded or revoked.
     *
     * @var int
     */
    protected $reversed;
    /**
     * Purchases of people whose `$ad_data_sharing` trait is not `true`.
     *
     * @return int
     */
    public function getNoAdDataSharing(): int
    {
        return $this->noAdDataSharing;
    }
    /**
     * Purchases of people whose `$ad_data_sharing` trait is not `true`.
     *
     * @param int $noAdDataSharing
     *
     * @return self
     */
    public function setNoAdDataSharing(int $noAdDataSharing): self
    {
        $this->initialized['noAdDataSharing'] = true;
        $this->noAdDataSharing = $noAdDataSharing;
        return $this;
    }
    /**
     * Purchases of people with no email, `$fbc` or `$fbp` for Meta to match them by.
     *
     * @return int
     */
    public function getNoMatchKey(): int
    {
        return $this->noMatchKey;
    }
    /**
     * Purchases of people with no email, `$fbc` or `$fbp` for Meta to match them by.
     *
     * @param int $noMatchKey
     *
     * @return self
     */
    public function setNoMatchKey(int $noMatchKey): self
    {
        $this->initialized['noMatchKey'] = true;
        $this->noMatchKey = $noMatchKey;
        return $this;
    }
    /**
     * Purchases of people who are erased, deleted or being erased.
     *
     * @return int
     */
    public function getPersonGone(): int
    {
        return $this->personGone;
    }
    /**
     * Purchases of people who are erased, deleted or being erased.
     *
     * @param int $personGone
     *
     * @return self
     */
    public function setPersonGone(int $personGone): self
    {
        $this->initialized['personGone'] = true;
        $this->personGone = $personGone;
        return $this;
    }
    /**
     * Purchases that were refunded or revoked.
     *
     * @return int
     */
    public function getReversed(): int
    {
        return $this->reversed;
    }
    /**
     * Purchases that were refunded or revoked.
     *
     * @param int $reversed
     *
     * @return self
     */
    public function setReversed(int $reversed): self
    {
        $this->initialized['reversed'] = true;
        $this->reversed = $reversed;
        return $this;
    }
}