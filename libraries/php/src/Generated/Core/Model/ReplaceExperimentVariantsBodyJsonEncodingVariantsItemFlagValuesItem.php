<?php

namespace Voidhash\Generated\Core\Model;

class ReplaceExperimentVariantsBodyJsonEncodingVariantsItemFlagValuesItem
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
     * The feature flag, `ff_...`: one of the project's own, not archived.
     *
     * @var string
     */
    protected $featureFlagId;
    /**
     * Whether the flag is on for the end users in the arm.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The key of the flag's variant the arm's end users get; omitted or null, a flag with variants splits them as it does itself. Not allowed when `isEnabled` is false.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * The feature flag, `ff_...`: one of the project's own, not archived.
     *
     * @return string
     */
    public function getFeatureFlagId(): string
    {
        return $this->featureFlagId;
    }
    /**
     * The feature flag, `ff_...`: one of the project's own, not archived.
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
     * Whether the flag is on for the end users in the arm.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the flag is on for the end users in the arm.
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
     * The key of the flag's variant the arm's end users get; omitted or null, a flag with variants splits them as it does itself. Not allowed when `isEnabled` is false.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The key of the flag's variant the arm's end users get; omitted or null, a flag with variants splits them as it does itself. Not allowed when `isEnabled` is false.
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
}