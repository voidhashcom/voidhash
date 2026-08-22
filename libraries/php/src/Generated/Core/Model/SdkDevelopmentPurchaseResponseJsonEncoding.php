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
     * @var bool
     */
    protected $accepted;
    /**
     * @var string|null
     */
    protected $warning;
    /**
     * @return bool
     */
    public function getAccepted(): bool
    {
        return $this->accepted;
    }
    /**
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
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
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