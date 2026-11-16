<?php

namespace Voidhash\Generated\Core\Model;

class PutFeatureFlagOverrideBodyJsonEncoding
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
     * Whether the end user gets the flag on (`true`) or off (`false`).
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The `key` of the variant the end user always gets, only with `isEnabled: true`; for an experiment's flag, an arm's id. Omitted or null, the flag is on without a variant.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * Why the override exists, such as who is testing what.
     *
     * @var string|null
     */
    protected $note;
    /**
     * Whether the end user gets the flag on (`true`) or off (`false`).
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the end user gets the flag on (`true`) or off (`false`).
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
     * The `key` of the variant the end user always gets, only with `isEnabled: true`; for an experiment's flag, an arm's id. Omitted or null, the flag is on without a variant.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The `key` of the variant the end user always gets, only with `isEnabled: true`; for an experiment's flag, an arm's id. Omitted or null, the flag is on without a variant.
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
     * Why the override exists, such as who is testing what.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why the override exists, such as who is testing what.
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