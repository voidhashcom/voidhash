<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportWarningReachLimited
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
     * How many objects or object-days reach is read for.
     *
     * @var int
     */
    protected $limit;
    /**
     * What `limit` counts: `object`s, or `object_day`s.
     *
     * @var string
     */
    protected $per;
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
     * How many objects or object-days reach is read for.
     *
     * @return int
     */
    public function getLimit(): int
    {
        return $this->limit;
    }
    /**
     * How many objects or object-days reach is read for.
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
    /**
     * What `limit` counts: `object`s, or `object_day`s.
     *
     * @return string
     */
    public function getPer(): string
    {
        return $this->per;
    }
    /**
     * What `limit` counts: `object`s, or `object_day`s.
     *
     * @param string $per
     *
     * @return self
     */
    public function setPer(string $per): self
    {
        $this->initialized['per'] = true;
        $this->per = $per;
        return $this;
    }
}