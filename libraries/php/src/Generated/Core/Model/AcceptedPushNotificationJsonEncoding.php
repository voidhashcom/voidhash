<?php

namespace Voidhash\Generated\Core\Model;

class AcceptedPushNotificationJsonEncoding
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
     * The push notification's id, `push_send_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
     *
     * @var string
     */
    protected $status;
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @var int
     */
    protected $deviceCount;
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @var list<string>
     */
    protected $unresolvedDistinctIds;
    /**
     * The push notification's id, `push_send_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The push notification's id, `push_send_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where a push notification's deliveries stand: `pending` before the first attempt, `in_progress` while any delivery is unsettled, then `succeeded` when every device received it, `failed` when none did, `partial_failed` when some did, or `no_recipients` when it reached no device.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @return int
     */
    public function getDeviceCount(): int
    {
        return $this->deviceCount;
    }
    /**
     * How many devices it goes to: the recipients' devices of an enabled push service, each counted once.
     *
     * @param int $deviceCount
     *
     * @return self
     */
    public function setDeviceCount(int $deviceCount): self
    {
        $this->initialized['deviceCount'] = true;
        $this->deviceCount = $deviceCount;
        return $this;
    }
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @return list<string>
     */
    public function getUnresolvedDistinctIds(): array
    {
        return $this->unresolvedDistinctIds;
    }
    /**
     * The requested distinct ids that named no person; nothing was sent for them.
     *
     * @param list<string> $unresolvedDistinctIds
     *
     * @return self
     */
    public function setUnresolvedDistinctIds(array $unresolvedDistinctIds): self
    {
        $this->initialized['unresolvedDistinctIds'] = true;
        $this->unresolvedDistinctIds = $unresolvedDistinctIds;
        return $this;
    }
}