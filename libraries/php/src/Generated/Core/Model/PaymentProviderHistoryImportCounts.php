<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderHistoryImportCounts
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
     * Store objects found so far.
     *
     * @var int
     */
    protected $total;
    /**
     * Objects found but not yet processed.
     *
     * @var int
     */
    protected $pending;
    /**
     * Objects recorded, by this import or already before it.
     *
     * @var int
     */
    protected $applied;
    /**
     * Objects that call for no change, such as a cancellation a webhook recorded.
     *
     * @var int
     */
    protected $ignored;
    /**
     * Objects waiting for a product mapping or for the purchase they refer to.
     *
     * @var int
     */
    protected $parked;
    /**
     * Objects that could not be read from the store or recorded.
     *
     * @var int
     */
    protected $failed;
    /**
     * Store objects found so far.
     *
     * @return int
     */
    public function getTotal(): int
    {
        return $this->total;
    }
    /**
     * Store objects found so far.
     *
     * @param int $total
     *
     * @return self
     */
    public function setTotal(int $total): self
    {
        $this->initialized['total'] = true;
        $this->total = $total;
        return $this;
    }
    /**
     * Objects found but not yet processed.
     *
     * @return int
     */
    public function getPending(): int
    {
        return $this->pending;
    }
    /**
     * Objects found but not yet processed.
     *
     * @param int $pending
     *
     * @return self
     */
    public function setPending(int $pending): self
    {
        $this->initialized['pending'] = true;
        $this->pending = $pending;
        return $this;
    }
    /**
     * Objects recorded, by this import or already before it.
     *
     * @return int
     */
    public function getApplied(): int
    {
        return $this->applied;
    }
    /**
     * Objects recorded, by this import or already before it.
     *
     * @param int $applied
     *
     * @return self
     */
    public function setApplied(int $applied): self
    {
        $this->initialized['applied'] = true;
        $this->applied = $applied;
        return $this;
    }
    /**
     * Objects that call for no change, such as a cancellation a webhook recorded.
     *
     * @return int
     */
    public function getIgnored(): int
    {
        return $this->ignored;
    }
    /**
     * Objects that call for no change, such as a cancellation a webhook recorded.
     *
     * @param int $ignored
     *
     * @return self
     */
    public function setIgnored(int $ignored): self
    {
        $this->initialized['ignored'] = true;
        $this->ignored = $ignored;
        return $this;
    }
    /**
     * Objects waiting for a product mapping or for the purchase they refer to.
     *
     * @return int
     */
    public function getParked(): int
    {
        return $this->parked;
    }
    /**
     * Objects waiting for a product mapping or for the purchase they refer to.
     *
     * @param int $parked
     *
     * @return self
     */
    public function setParked(int $parked): self
    {
        $this->initialized['parked'] = true;
        $this->parked = $parked;
        return $this;
    }
    /**
     * Objects that could not be read from the store or recorded.
     *
     * @return int
     */
    public function getFailed(): int
    {
        return $this->failed;
    }
    /**
     * Objects that could not be read from the store or recorded.
     *
     * @param int $failed
     *
     * @return self
     */
    public function setFailed(int $failed): self
    {
        $this->initialized['failed'] = true;
        $this->failed = $failed;
        return $this;
    }
}