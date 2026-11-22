<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationDefaultAnswerJsonEncodingWithdrawnBuild
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
     * The withdrawn build's release id.
     *
     * @var string
     */
    protected $releaseId;
    /**
     * The withdrawn build's number.
     *
     * @var int
     */
    protected $buildNumber;
    /**
     * The withdrawn build's release id.
     *
     * @return string
     */
    public function getReleaseId(): string
    {
        return $this->releaseId;
    }
    /**
     * The withdrawn build's release id.
     *
     * @param string $releaseId
     *
     * @return self
     */
    public function setReleaseId(string $releaseId): self
    {
        $this->initialized['releaseId'] = true;
        $this->releaseId = $releaseId;
        return $this;
    }
    /**
     * The withdrawn build's number.
     *
     * @return int
     */
    public function getBuildNumber(): int
    {
        return $this->buildNumber;
    }
    /**
     * The withdrawn build's number.
     *
     * @param int $buildNumber
     *
     * @return self
     */
    public function setBuildNumber(int $buildNumber): self
    {
        $this->initialized['buildNumber'] = true;
        $this->buildNumber = $buildNumber;
        return $this;
    }
}