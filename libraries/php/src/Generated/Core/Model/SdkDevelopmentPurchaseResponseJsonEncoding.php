<?php

namespace Voidhash\Generated\Core\Model;

class SdkDevelopmentPurchaseResponseJsonEncoding
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
     * Always `true`: the simulated purchase was recorded.
     *
     * @var bool
     */
    protected $accepted;
    /**
     * A note about how the purchase was simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
     * @var string|null
     */
    protected $warning;
    /**
     * Always `true`: the simulated purchase was recorded.
     *
     * @return bool
     */
    public function getAccepted(): bool
    {
        return $this->accepted;
    }
    /**
     * Always `true`: the simulated purchase was recorded.
     *
     * @param bool $accepted
     *
     * @return self
     */
    public function setAccepted(bool $accepted): self
    {
        $this->initialized['accepted'] = true;
        $this->accepted = $accepted;
        return $this;
    }
    /**
     * A note about how the purchase was simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
     * A note about how the purchase was simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
     * @param string|null $warning
     *
     * @return self
     */
    public function setWarning(?string $warning): self
    {
        $this->initialized['warning'] = true;
        $this->warning = $warning;
        return $this;
    }
}