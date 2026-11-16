<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningTooManyObjects
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
     * How many objects the report covers.
     *
     * @var int
     */
    protected $limit;
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
     * How many objects the report covers.
     *
     * @return int
     */
    public function getLimit(): int
    {
        return $this->limit;
    }
    /**
     * How many objects the report covers.
     *
     * @param int $limit
     *
     * @return self
     */
    public function setLimit(int $limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
}