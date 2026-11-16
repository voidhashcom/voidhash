<?php

namespace Voidhash\Generated\Core\Model;

class CreateFeedbackBodyJsonEncoding
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
     * The product area the feedback is about.
     *
     * @var string
     */
    protected $topic;
    /**
     * How the person feels, from 1 (unhappy) to 4 (delighted); omit when not given.
     *
     * @var int|null
     */
    protected $sentiment;
    /**
     * The feedback itself, at least one character.
     *
     * @var string
     */
    protected $message;
    /**
     * The organization it concerns; ignored unless the person is a member.
     *
     * @var string|null
     */
    protected $organizationId;
    /**
     * The project it concerns, which also names its organization; ignored unless the person can use it.
     *
     * @var string|null
     */
    protected $projectId;
    /**
     * The product area the feedback is about.
     *
     * @return string
     */
    public function getTopic(): string
    {
        return $this->topic;
    }
    /**
     * The product area the feedback is about.
     *
     * @param string $topic
     *
     * @return self
     */
    public function setTopic(string $topic): self
    {
        $this->initialized['topic'] = true;
        $this->topic = $topic;
        return $this;
    }
    /**
     * How the person feels, from 1 (unhappy) to 4 (delighted); omit when not given.
     *
     * @return int|null
     */
    public function getSentiment(): ?int
    {
        return $this->sentiment;
    }
    /**
     * How the person feels, from 1 (unhappy) to 4 (delighted); omit when not given.
     *
     * @param int|null $sentiment
     *
     * @return self
     */
    public function setSentiment(?int $sentiment): self
    {
        $this->initialized['sentiment'] = true;
        $this->sentiment = $sentiment;
        return $this;
    }
    /**
     * The feedback itself, at least one character.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * The feedback itself, at least one character.
     *
     * @param string $message
     *
     * @return self
     */
    public function setMessage(string $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
    /**
     * The organization it concerns; ignored unless the person is a member.
     *
     * @return string|null
     */
    public function getOrganizationId(): ?string
    {
        return $this->organizationId;
    }
    /**
     * The organization it concerns; ignored unless the person is a member.
     *
     * @param string|null $organizationId
     *
     * @return self
     */
    public function setOrganizationId(?string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * The project it concerns, which also names its organization; ignored unless the person can use it.
     *
     * @return string|null
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }
    /**
     * The project it concerns, which also names its organization; ignored unless the person can use it.
     *
     * @param string|null $projectId
     *
     * @return self
     */
    public function setProjectId(?string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
}