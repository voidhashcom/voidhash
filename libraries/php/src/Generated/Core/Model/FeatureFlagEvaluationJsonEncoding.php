<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagEvaluationJsonEncoding
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
     * The flag, `ff_...`.
     *
     * @var string
     */
    protected $featureFlagId;
    /**
     * The flag's key.
     *
     * @var string
     */
    protected $key;
    /**
     * Whether the flag is on for the end user.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The key of the variant the end user gets; null when the flag is off or has no variants.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * The variant's value; null without a variant.
     *
     * @var mixed|null
     */
    protected $value;
    /**
     * Why the flag evaluated as it did: `disabled`, the environment's switch is off; `override`, an override fixed it; `experiment`, a running A/B test set it for the end user's arm; `rule`, the rule named in `ruleId` matched the end user; `default`, no rule did and the fallthrough decided; `no_identity`, there was no person or distinct id to place them in a share by.
     *
     * @var string
     */
    protected $reason;
    /**
     * The rule that decided, by its id; null unless `reason` is `rule`.
     *
     * @var string|null
     */
    protected $ruleId;
    /**
     * The flag, `ff_...`.
     *
     * @return string
     */
    public function getFeatureFlagId(): string
    {
        return $this->featureFlagId;
    }
    /**
     * The flag, `ff_...`.
     *
     * @param string $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * The flag's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The flag's key.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * Whether the flag is on for the end user.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the flag is on for the end user.
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
     * The key of the variant the end user gets; null when the flag is off or has no variants.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The key of the variant the end user gets; null when the flag is off or has no variants.
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
     * The variant's value; null without a variant.
     *
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
     * The variant's value; null without a variant.
     *
     * @param mixed $value
     *
     * @return self
     */
    public function setValue($value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * Why the flag evaluated as it did: `disabled`, the environment's switch is off; `override`, an override fixed it; `experiment`, a running A/B test set it for the end user's arm; `rule`, the rule named in `ruleId` matched the end user; `default`, no rule did and the fallthrough decided; `no_identity`, there was no person or distinct id to place them in a share by.
     *
     * @return string
     */
    public function getReason(): string
    {
        return $this->reason;
    }
    /**
     * Why the flag evaluated as it did: `disabled`, the environment's switch is off; `override`, an override fixed it; `experiment`, a running A/B test set it for the end user's arm; `rule`, the rule named in `ruleId` matched the end user; `default`, no rule did and the fallthrough decided; `no_identity`, there was no person or distinct id to place them in a share by.
     *
     * @param string $reason
     *
     * @return self
     */
    public function setReason(string $reason): self
    {
        $this->initialized['reason'] = true;
        $this->reason = $reason;
        return $this;
    }
    /**
     * The rule that decided, by its id; null unless `reason` is `rule`.
     *
     * @return string|null
     */
    public function getRuleId(): ?string
    {
        return $this->ruleId;
    }
    /**
     * The rule that decided, by its id; null unless `reason` is `rule`.
     *
     * @param string|null $ruleId
     *
     * @return self
     */
    public function setRuleId(?string $ruleId): self
    {
        $this->initialized['ruleId'] = true;
        $this->ruleId = $ruleId;
        return $this;
    }
}