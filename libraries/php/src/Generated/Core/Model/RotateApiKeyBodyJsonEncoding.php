<?php

namespace Voidhash\Generated\Core\Model;

class RotateApiKeyBodyJsonEncoding
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
     * Seconds the previous secret keeps working so deployments can switch over, up to 604,800 (7 days). Omit to stop it at once.
     *
     * @var int|null
     */
    protected $overlapSeconds;
    /**
     * Seconds the previous secret keeps working so deployments can switch over, up to 604,800 (7 days). Omit to stop it at once.
     *
     * @return int|null
     */
    public function getOverlapSeconds(): ?int
    {
        return $this->overlapSeconds;
    }
    /**
     * Seconds the previous secret keeps working so deployments can switch over, up to 604,800 (7 days). Omit to stop it at once.
     *
     * @param int|null $overlapSeconds
     *
     * @return self
     */
    public function setOverlapSeconds(?int $overlapSeconds): self
    {
        $this->initialized['overlapSeconds'] = true;
        $this->overlapSeconds = $overlapSeconds;
        return $this;
    }
}