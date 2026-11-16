<?php

namespace Voidhash\Generated\Core\Model;

class AutomationIssue
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
     * `error` stops the automation being activated; `warning` does not.
     *
     * @var string
     */
    protected $severity;
    /**
     * A stable code, for clients to branch on.
     *
     * @var string
     */
    protected $code;
    /**
     * Where in the definition, such as `trigger.config.event` or `nodes.welcome.config.title`.
     *
     * @var string
     */
    protected $path;
    /**
     * The step the issue is about; null when it is about no one step.
     *
     * @var string|null
     */
    protected $nodeId;
    /**
     * What is wrong, in words.
     *
     * @var string
     */
    protected $message;
    /**
     * `error` stops the automation being activated; `warning` does not.
     *
     * @return string
     */
    public function getSeverity(): string
    {
        return $this->severity;
    }
    /**
     * `error` stops the automation being activated; `warning` does not.
     *
     * @param string $severity
     *
     * @return self
     */
    public function setSeverity(string $severity): self
    {
        $this->initialized['severity'] = true;
        $this->severity = $severity;
        return $this;
    }
    /**
     * A stable code, for clients to branch on.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * A stable code, for clients to branch on.
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
     * Where in the definition, such as `trigger.config.event` or `nodes.welcome.config.title`.
     *
     * @return string
     */
    public function getPath(): string
    {
        return $this->path;
    }
    /**
     * Where in the definition, such as `trigger.config.event` or `nodes.welcome.config.title`.
     *
     * @param string $path
     *
     * @return self
     */
    public function setPath(string $path): self
    {
        $this->initialized['path'] = true;
        $this->path = $path;
        return $this;
    }
    /**
     * The step the issue is about; null when it is about no one step.
     *
     * @return string|null
     */
    public function getNodeId(): ?string
    {
        return $this->nodeId;
    }
    /**
     * The step the issue is about; null when it is about no one step.
     *
     * @param string|null $nodeId
     *
     * @return self
     */
    public function setNodeId(?string $nodeId): self
    {
        $this->initialized['nodeId'] = true;
        $this->nodeId = $nodeId;
        return $this;
    }
    /**
     * What is wrong, in words.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What is wrong, in words.
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
}