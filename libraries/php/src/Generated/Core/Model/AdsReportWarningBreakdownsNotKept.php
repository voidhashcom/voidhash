<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningBreakdownsNotKept
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
     * What the warning is about.
     *
     * @var string
     */
    protected $code;
    /**
     * The first day breakdowns are kept for, `YYYY-MM-DD`.
     *
     * @var string
     */
    protected $keptFrom;
    /**
     * What the warning is about.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * What the warning is about.
     *
     * @param string $code
     *
     * @return self
     */
    public function setCode(string $code): self
    {
        $this->initialized['code'] = true;
        $this->code = $code;
        return $this;
    }
    /**
     * The first day breakdowns are kept for, `YYYY-MM-DD`.
     *
     * @return string
     */
    public function getKeptFrom(): string
    {
        return $this->keptFrom;
    }
    /**
     * The first day breakdowns are kept for, `YYYY-MM-DD`.
     *
     * @param string $keptFrom
     *
     * @return self
     */
    public function setKeptFrom(string $keptFrom): self
    {
        $this->initialized['keptFrom'] = true;
        $this->keptFrom = $keptFrom;
        return $this;
    }
}