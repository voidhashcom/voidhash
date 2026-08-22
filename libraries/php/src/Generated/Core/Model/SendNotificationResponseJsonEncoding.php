<?php

namespace Voidhash\Generated\Core\Model;

class SendNotificationResponseJsonEncoding
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
     * @var string
     */
    protected $pushNotificationSendId;
    /**
     * @var mixed
     */
    protected $deviceCount;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var list<string>
     */
    protected $unresolvedDistinctIds;
    /**
     * @return string
     */
    public function getPushNotificationSendId(): string
    {
        return $this->pushNotificationSendId;
    }
    /**
     * @param string $pushNotificationSendId
     *
     * @return self
     */
    public function setPushNotificationSendId(string $pushNotificationSendId): self
    {
        $this->initialized['pushNotificationSendId'] = true;
        $this->pushNotificationSendId = $pushNotificationSendId;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getDeviceCount()
    {
        return $this->deviceCount;
    }
    /**
     * @param mixed $deviceCount
     *
     * @return self
     */
    public function setDeviceCount($deviceCount): self
    {
        $this->initialized['deviceCount'] = true;
        $this->deviceCount = $deviceCount;
        return $this;
    }
    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
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
     * @return list<string>
     */
    public function getUnresolvedDistinctIds(): array
    {
        return $this->unresolvedDistinctIds;
    }
    /**
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