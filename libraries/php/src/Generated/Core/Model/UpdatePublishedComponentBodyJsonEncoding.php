<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePublishedComponentBodyJsonEncoding
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
     * `true` deprecates the whole component; `false` lifts its deprecation.
     *
     * @var bool|null
     */
    protected $isDeprecated;
    /**
     * Why the component is deprecated, for installers; only with `isDeprecated: true`.
     *
     * @var string|null
     */
    protected $deprecationMessage;
    /**
     * Transfers the component to this project of the organization; only an organization admin can.
     *
     * @var string|null
     */
    protected $ownerProjectId;
    /**
     * `true` deprecates the whole component; `false` lifts its deprecation.
     *
     * @return bool|null
     */
    public function getIsDeprecated(): ?bool
    {
        return $this->isDeprecated;
    }
    /**
     * `true` deprecates the whole component; `false` lifts its deprecation.
     *
     * @param bool|null $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(?bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
    /**
     * Why the component is deprecated, for installers; only with `isDeprecated: true`.
     *
     * @return string|null
     */
    public function getDeprecationMessage(): ?string
    {
        return $this->deprecationMessage;
    }
    /**
     * Why the component is deprecated, for installers; only with `isDeprecated: true`.
     *
     * @param string|null $deprecationMessage
     *
     * @return self
     */
    public function setDeprecationMessage(?string $deprecationMessage): self
    {
        $this->initialized['deprecationMessage'] = true;
        $this->deprecationMessage = $deprecationMessage;
        return $this;
    }
    /**
     * Transfers the component to this project of the organization; only an organization admin can.
     *
     * @return string|null
     */
    public function getOwnerProjectId(): ?string
    {
        return $this->ownerProjectId;
    }
    /**
     * Transfers the component to this project of the organization; only an organization admin can.
     *
     * @param string|null $ownerProjectId
     *
     * @return self
     */
    public function setOwnerProjectId(?string $ownerProjectId): self
    {
        $this->initialized['ownerProjectId'] = true;
        $this->ownerProjectId = $ownerProjectId;
        return $this;
    }
}