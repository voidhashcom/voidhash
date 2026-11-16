<?php

namespace Voidhash\Generated\Core\Model;

class AutomationReviewJsonEncoding
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
     * Whether the draft can be activated: it has no `error` issues.
     *
     * @var bool
     */
    protected $isReady;
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @var list<AutomationIssue>
     */
    protected $issues;
    /**
     * Who a schedule would enroll now; null for automations people enter on their own.
     *
     * @var AutomationReviewJsonEncodingAudience|null
     */
    protected $audience;
    /**
     * Whether the draft can be activated: it has no `error` issues.
     *
     * @return bool
     */
    public function getIsReady(): bool
    {
        return $this->isReady;
    }
    /**
     * Whether the draft can be activated: it has no `error` issues.
     *
     * @param bool $isReady
     *
     * @return self
     */
    public function setIsReady(bool $isReady): self
    {
        $this->initialized['isReady'] = true;
        $this->isReady = $isReady;
        return $this;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @return list<AutomationIssue>
     */
    public function getIssues(): array
    {
        return $this->issues;
    }
    /**
     * What is wrong with the definition. Any `error` stops it being activated; a `warning` does not.
     *
     * @param list<AutomationIssue> $issues
     *
     * @return self
     */
    public function setIssues(array $issues): self
    {
        $this->initialized['issues'] = true;
        $this->issues = $issues;
        return $this;
    }
    /**
     * Who a schedule would enroll now; null for automations people enter on their own.
     *
     * @return AutomationReviewJsonEncodingAudience|null
     */
    public function getAudience(): ?AutomationReviewJsonEncodingAudience
    {
        return $this->audience;
    }
    /**
     * Who a schedule would enroll now; null for automations people enter on their own.
     *
     * @param AutomationReviewJsonEncodingAudience|null $audience
     *
     * @return self
     */
    public function setAudience(?AutomationReviewJsonEncodingAudience $audience): self
    {
        $this->initialized['audience'] = true;
        $this->audience = $audience;
        return $this;
    }
}