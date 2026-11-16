<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningReachUnavailable
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
}