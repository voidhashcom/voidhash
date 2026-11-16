<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsPresetTimeRange
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
     * A window ending now: `today`, `last_7d`, `last_30d`, `last_90d`, `last_365d`, or month, quarter or year to date (`mtd`, `qtd`, `ytd`). `today` and the to-date windows start at midnight in the query's time zone; the `last_` windows are the exact span before now.
     *
     * @var string
     */
    protected $preset;
    /**
     * A window ending now: `today`, `last_7d`, `last_30d`, `last_90d`, `last_365d`, or month, quarter or year to date (`mtd`, `qtd`, `ytd`). `today` and the to-date windows start at midnight in the query's time zone; the `last_` windows are the exact span before now.
     *
     * @return string
     */
    public function getPreset(): string
    {
        return $this->preset;
    }
    /**
     * A window ending now: `today`, `last_7d`, `last_30d`, `last_90d`, `last_365d`, or month, quarter or year to date (`mtd`, `qtd`, `ytd`). `today` and the to-date windows start at midnight in the query's time zone; the `last_` windows are the exact span before now.
     *
     * @param string $preset
     *
     * @return self
     */
    public function setPreset(string $preset): self
    {
        $this->initialized['preset'] = true;
        $this->preset = $preset;
        return $this;
    }
}