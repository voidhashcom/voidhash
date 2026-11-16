<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEnvironmentOverrideJsonEncoding
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
     * Whether the end user gets the flag on or off.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The `key` of the variant the end user always gets; null when the override fixes no variant.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * Why the override exists; null when it has no note.
     *
     * @var string|null
     */
    protected $note;
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
    /**
     * Whether the end user gets the flag on or off.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the end user gets the flag on or off.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * The `key` of the variant the end user always gets; null when the override fixes no variant.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The `key` of the variant the end user always gets; null when the override fixes no variant.
     *
     * @param string|null $variantKey
     *
     * @return self
     */
    public function setVariantKey(?string $variantKey): self
    {
        $this->initialized['variantKey'] = true;
        $this->variantKey = $variantKey;
        return $this;
    }
    /**
     * Why the override exists; null when it has no note.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why the override exists; null when it has no note.
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