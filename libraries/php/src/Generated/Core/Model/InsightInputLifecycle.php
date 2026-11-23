<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputLifecycle
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
     * Groups shown as people (`count`) or as shares of the active (`percentage`).
     *
     * @var string
     */
    protected $valueMode;
    /**
     * Groups hidden from the chart: new, returning, resurrecting, dormant.
     *
     * @var list<string>
     */
    protected $hidden;
    /**
     * Groups shown as people (`count`) or as shares of the active (`percentage`).
     *
     * @return string
     */
    public function getValueMode(): string
    {
        return $this->valueMode;
    }
    /**
     * Groups shown as people (`count`) or as shares of the active (`percentage`).
     *
     * @param string $valueMode
     *
     * @return self
     */
    public function setValueMode(string $valueMode): self
    {
        $this->initialized['valueMode'] = true;
        $this->valueMode = $valueMode;
        return $this;
    }
    /**
     * Groups hidden from the chart: new, returning, resurrecting, dormant.
     *
     * @return list<string>
     */
    public function getHidden(): array
    {
        return $this->hidden;
    }
    /**
     * Groups hidden from the chart: new, returning, resurrecting, dormant.
     *
     * @param list<string> $hidden
     *
     * @return self
     */
    public function setHidden(array $hidden): self
    {
        $this->initialized['hidden'] = true;
        $this->hidden = $hidden;
        return $this;
    }
}