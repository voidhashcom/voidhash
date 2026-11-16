<?php

namespace Voidhash\Generated\Core\Model;

class UpdateConnectedAppBodyJsonEncoding
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
     * `true` limits the app to reading; `false` lifts the limit.
     *
     * @var bool|null
     */
    protected $isReadOnly;
    /**
     * `true` limits the app to reading; `false` lifts the limit.
     *
     * @return bool|null
     */
    public function getIsReadOnly(): ?bool
    {
        return $this->isReadOnly;
    }
    /**
     * `true` limits the app to reading; `false` lifts the limit.
     *
     * @param bool|null $isReadOnly
     *
     * @return self
     */
    public function setIsReadOnly(?bool $isReadOnly): self
    {
        $this->initialized['isReadOnly'] = true;
        $this->isReadOnly = $isReadOnly;
        return $this;
    }
}