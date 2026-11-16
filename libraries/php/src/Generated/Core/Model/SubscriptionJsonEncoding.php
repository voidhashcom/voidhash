<?php

namespace Voidhash\Generated\Core\Model;

class SubscriptionJsonEncoding
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
    protected $subjectType;
    /**
     * @var string
     */
    protected $subjectId;
    /**
     * @var string
     */
    protected $participant;
    /**
     * @var string
     */
    protected $reason;
    /**
     * @return string
     */
    public function getSubjectType(): string
    {
        return $this->subjectType;
    }
    /**
     * @param string $subjectType
     *
     * @return self
     */
    public function setSubjectType(string $subjectType): self
    {
        $this->initialized['subjectType'] = true;
        $this->subjectType = $subjectType;
        return $this;
    }
    /**
     * @return string
     */
    public function getSubjectId(): string
    {
        return $this->subjectId;
    }
    /**
     * @param string $subjectId
     *
     * @return self
     */
    public function setSubjectId(string $subjectId): self
    {
        $this->initialized['subjectId'] = true;
        $this->subjectId = $subjectId;
        return $this;
    }
    /**
     * @return string
     */
    public function getParticipant(): string
    {
        return $this->participant;
    }
    /**
     * @param string $participant
     *
     * @return self
     */
    public function setParticipant(string $participant): self
    {
        $this->initialized['participant'] = true;
        $this->participant = $participant;
        return $this;
    }
    /**
     * @return string
     */
    public function getReason(): string
    {
        return $this->reason;
    }
    /**
     * @param string $reason
     *
     * @return self
     */
    public function setReason(string $reason): self
    {
        $this->initialized['reason'] = true;
        $this->reason = $reason;
        return $this;
    }
}